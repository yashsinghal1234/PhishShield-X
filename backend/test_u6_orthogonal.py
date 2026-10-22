"""
Rapid Test for U6 Cosine Head Margin Schedule & Learning Rate.
"""

import os
import sys
import numpy as np
import tensorflow as tf
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from url_edl import create_edl_loss, EpochTracker, compute_evidential_outputs, MAX_LEN

data = np.load(os.path.join(CURRENT_DIR, "url_data_cache_6000.npz"), allow_pickle=True)
X_seq, X_tab, y = data["X_seq"], data["X_tab"], data["y"]
X_seq_ood, X_tab_ood = data["X_seq_ood"], data["X_tab_ood"]

skf = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
train_idx, val_idx = next(skf.split(X_seq, y))

train_s, val_s = X_seq[train_idx], X_seq[val_idx]
scaler = StandardScaler()
train_t = scaler.fit_transform(X_tab[train_idx])
val_t = scaler.transform(X_tab[val_idx])
ood_t = scaler.transform(X_tab_ood)
train_y, val_y = y[train_idx], y[val_idx]

class STracker(tf.keras.callbacks.Callback):
    def on_epoch_end(self, epoch, logs=None):
        preds = self.model.predict(self.model.val_data, verbose=0)
        S = np.sum(preds, axis=-1)
        acc = accuracy_score(self.model.val_y, np.argmax(preds, axis=1))
        print(f"   [Ep {epoch+1}] Val Acc: {acc*100:.2f}% | Mean S: {np.mean(S):.2f}", flush=True)

class AnnealedCosineHead(tf.keras.layers.Layer):
    def __init__(self, num_classes=2, scale=10.0, target_margin=0.32, epoch_var=None, total_epochs=8, **kwargs):
        super().__init__(**kwargs)
        self.num_classes = num_classes
        self.scale = scale
        self.target_margin = target_margin
        self.epoch_var = epoch_var
        self.total_epochs = total_epochs

    def build(self, input_shape):
        # Orthogonal class directions
        self.w = self.add_weight(
            shape=(input_shape[-1], self.num_classes),
            initializer=tf.keras.initializers.Orthogonal(),
            trainable=True,
            name="class_directions"
        )
        super().build(input_shape)

    def call(self, h):
        h_norm = tf.nn.l2_normalize(h, axis=-1)
        w_norm = tf.nn.l2_normalize(self.w, axis=0)
        cos_sim = tf.matmul(h_norm, w_norm)
        # Smooth margin warmup: starts at 0.0 in epochs 1-2, ramps to target_margin by epoch 6
        if self.epoch_var is not None:
            warmup = tf.maximum(0.0, (self.epoch_var - 2.0) / (float(self.total_epochs) - 2.0))
            m_t = self.target_margin * warmup
        else:
            m_t = 0.0
        return self.scale * tf.nn.relu(cos_sim - m_t)

from tensorflow.keras.layers import Input, Embedding, Conv1D, MaxPooling1D, Dense, Dropout, Flatten, Lambda, concatenate

inp_l = Input(shape=(MAX_LEN,))
l = Embedding(110, 32)(inp_l)
l = Conv1D(32, 3, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(l)
l = MaxPooling1D(6)(l)
l = Flatten()(l)
l_dense = Dense(32, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(l)
l_dense = Dropout(0.2)(l_dense)

inp_t = Input(shape=(34,))
t_dense = Dense(32, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(inp_t)
t_dense = Dropout(0.2)(t_dense)

fused = concatenate([l_dense, t_dense])
h = Dense(48, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(fused)
h = Dropout(0.2)(h)
# Linear bottleneck projection for clean angular representation
h_feat = Dense(32, activation=None, kernel_regularizer=tf.keras.regularizers.l2(5e-4))(h)

epoch_var = tf.Variable(1.0, trainable=False, dtype=tf.float32)
ev = AnnealedCosineHead(scale=10.0, target_margin=0.10, epoch_var=epoch_var, total_epochs=8)(h_feat)
alpha = Lambda(lambda e: e + 1.0)(ev)

model = tf.keras.models.Model(inputs=[inp_l, inp_t], outputs=alpha)
model.val_data = [val_s, val_t]
model.val_y = val_y
model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=5e-4, clipnorm=1.0),
    loss=create_edl_loss(epoch_var, total_epochs=8)
)

print("Starting U6 Annealed Orthogonal Cosine Head Training...", flush=True)
model.fit(
    [train_s, train_t], train_y,
    epochs=8, batch_size=64,
    callbacks=[EpochTracker(epoch_var), STracker()],
    verbose=0
)

alpha_val = model.predict([val_s, val_t], verbose=0)
alpha_ood = model.predict([X_seq_ood, ood_t], verbose=0)
_, _, u_id = compute_evidential_outputs(alpha_val)
_, _, u_ood = compute_evidential_outputs(alpha_ood)
acc = accuracy_score(val_y, np.argmax(alpha_val, axis=1))

print(f"\n==> Final U6: Acc: {acc*100:.2f}% | u_ID: {np.mean(u_id):.4f} (med: {np.median(u_id):.4f}) | u_OOD: {np.mean(u_ood):.4f} (med: {np.median(u_ood):.4f}) | Ratio: {np.mean(u_ood)/np.mean(u_id):.3f}x")
