"""
Test U6 Cosine Head + Outlier Exposure (OE) combined.
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

from url_edl import create_edl_oe_loss, EpochTracker, compute_evidential_outputs, MAX_LEN, NUM_CLASSES

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

# 5% outliers for OE
n_outliers = int(0.05 * len(train_y))
ood_train_idx = np.random.choice(len(X_seq_ood), size=n_outliers, replace=True)
oe_seq = np.concatenate([train_s, X_seq_ood[ood_train_idx]], axis=0)
oe_tab = np.concatenate([train_t, ood_t[ood_train_idx]], axis=0)
oe_y = np.concatenate([train_y, -1 * np.ones(n_outliers, dtype=np.int32)], axis=0)
perm = np.random.permutation(len(oe_y))
oe_seq, oe_tab, oe_y = oe_seq[perm], oe_tab[perm], oe_y[perm]

class AnnealedCosineHead(tf.keras.layers.Layer):
    def __init__(self, num_classes=2, scale=10.0, target_margin=0.15, epoch_var=None, total_epochs=8, **kwargs):
        super().__init__(**kwargs)
        self.num_classes = num_classes
        self.scale = scale
        self.target_margin = target_margin
        self.epoch_var = epoch_var
        self.total_epochs = total_epochs

    def build(self, input_shape):
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
        if self.epoch_var is not None:
            warmup = tf.maximum(0.0, (self.epoch_var - 2.0) / (float(self.total_epochs) - 2.0))
            m_t = self.target_margin * warmup
        else:
            m_t = 0.0
        return self.scale * tf.nn.relu(cos_sim - m_t)

from tensorflow.keras.layers import Input, Embedding, Conv1D, MaxPooling1D, Dense, Dropout, Flatten, Lambda, concatenate
from url_edl import kl_divergence_uniform

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
h_feat = Dense(32, activation=None, kernel_regularizer=tf.keras.regularizers.l2(5e-4))(h)

epoch_var = tf.Variable(1.0, trainable=False, dtype=tf.float32)
ev = AnnealedCosineHead(scale=10.0, target_margin=0.15, epoch_var=epoch_var, total_epochs=8)(h_feat)
alpha = Lambda(lambda e: e + 1.0)(ev)

model = tf.keras.models.Model(inputs=[inp_l, inp_t], outputs=alpha)

def create_edl_oe_loss_annealed(epoch_var, total_epochs=8, ood_weight=0.03):
    def loss_fn(y_true, alpha):
        y_flat = tf.reshape(y_true, [-1])
        is_id = tf.cast(y_flat >= 0, tf.float32)
        is_ood = 1.0 - is_id
        
        y_safe = tf.maximum(0, tf.cast(y_flat, tf.int32))
        y_one_hot = tf.one_hot(y_safe, depth=NUM_CLASSES)
        alpha_c = tf.clip_by_value(alpha, 1.0, 1e4)
        S = tf.reduce_sum(alpha_c, axis=-1, keepdims=True)
        p = alpha_c / S
        
        err = tf.reduce_sum(tf.square(y_one_hot - p), axis=-1, keepdims=True)
        var = tf.reduce_sum(p * (1.0 - p) / (S + 1.0), axis=-1, keepdims=True)
        alpha_tilde = y_one_hot + (1.0 - y_one_hot) * alpha_c
        kl_id = kl_divergence_uniform(alpha_tilde)
        
        anneal = tf.minimum(1.0, epoch_var / (float(total_epochs) / 2.0))
        loss_id = is_id * tf.reshape(err + var + anneal * kl_id, [-1])
        
        kl_ood = kl_divergence_uniform(alpha_c)
        loss_ood = is_ood * tf.reshape(kl_ood, [-1])
        
        num_id = tf.maximum(1.0, tf.reduce_sum(is_id))
        num_ood = tf.maximum(1.0, tf.reduce_sum(is_ood))
        
        return (tf.reduce_sum(loss_id) / num_id) + ood_weight * anneal * (tf.reduce_sum(loss_ood) / num_ood)
    return loss_fn

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=5e-4, clipnorm=1.0),
    loss=create_edl_oe_loss_annealed(epoch_var, total_epochs=8, ood_weight=0.04)
)

print("Starting U6 Cosine + OE Training...", flush=True)
model.fit(
    [oe_seq, oe_tab], oe_y,
    epochs=8, batch_size=64,
    callbacks=[EpochTracker(epoch_var)],
    verbose=0
)

alpha_val = model.predict([val_s, val_t], verbose=0)
alpha_ood = model.predict([X_seq_ood, ood_t], verbose=0)
_, _, u_id = compute_evidential_outputs(alpha_val)
_, _, u_ood = compute_evidential_outputs(alpha_ood)
acc = accuracy_score(val_y, np.argmax(alpha_val, axis=1))

print(f"\n==> U6 (Cosine + OE): Acc: {acc*100:.2f}% | u_ID: {np.mean(u_id):.4f} (med: {np.median(u_id):.4f}) | u_OOD: {np.mean(u_ood):.4f} (med: {np.median(u_ood):.4f}) | Ratio: {np.mean(u_ood)/np.mean(u_id):.3f}x")
