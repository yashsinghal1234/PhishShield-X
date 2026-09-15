import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input, Embedding, Conv2D, MaxPooling2D,
    Conv1D, MaxPooling1D, Dense, Dropout,
    Flatten, concatenate, Layer
)
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score

# Load datasets
data_id = np.load("data/quishing_id_dataset.npz" if os.path.exists("data/quishing_id_dataset.npz") else "backend/data/quishing_id_dataset.npz")
data_ood = np.load("data/quishing_ood_dataset.npz" if os.path.exists("data/quishing_ood_dataset.npz") else "backend/data/quishing_ood_dataset.npz")

X_imgs_id, X_seqs_id, y_id = data_id["images"], data_id["sequences"], data_id["labels"]
X_imgs_ood, X_seqs_ood = data_ood["images"], data_ood["sequences"]

IMG_SHAPE = (64, 64, 1)
MAX_LEN = 180
VOCAB_SIZE = 110
FEATURE_DIM = 32
NUM_CLASSES = 2

split = 2400
X_v_train, X_v_val = X_imgs_id[:split], X_imgs_id[split:]
X_s_train, X_s_val = X_seqs_id[:split], X_seqs_id[split:]
y_train, y_val = y_id[:split], y_id[split:]

def kl_divergence_uniform(alpha):
    beta = tf.ones((1, NUM_CLASSES), dtype=tf.float32)
    S_alpha = tf.reduce_sum(alpha, axis=-1, keepdims=True)
    S_beta = tf.reduce_sum(beta, axis=-1, keepdims=True)
    lnB = tf.math.lgamma(S_alpha) - tf.reduce_sum(tf.math.lgamma(alpha), axis=-1, keepdims=True)
    lnB_uni = tf.reduce_sum(tf.math.lgamma(beta), axis=-1, keepdims=True) - tf.math.lgamma(S_beta)
    dg0 = tf.math.digamma(S_alpha)
    dg1 = tf.math.digamma(alpha)
    return tf.reduce_sum((alpha - beta) * (dg1 - dg0), axis=-1, keepdims=True) + lnB + lnB_uni

def create_edl_loss(epoch_var, total_epochs=8):
    def loss_fn(y_true, alpha):
        y_flat = tf.reshape(y_true, [-1])
        y_one_hot = tf.one_hot(tf.cast(y_flat, tf.int32), depth=NUM_CLASSES)
        alpha_c = tf.clip_by_value(alpha, 1.0, 1e4)
        S = tf.reduce_sum(alpha_c, axis=-1, keepdims=True)
        p = alpha_c / S
        err = tf.reduce_sum(tf.square(y_one_hot - p), axis=-1, keepdims=True)
        var = tf.reduce_sum(p * (1.0 - p) / (S + 1.0), axis=-1, keepdims=True)
        alpha_tilde = y_one_hot + (1.0 - y_one_hot) * alpha_c
        kl = kl_divergence_uniform(alpha_tilde)
        anneal = tf.minimum(1.0, epoch_var / (float(total_epochs) / 2.0))
        return tf.reduce_mean(err + var + anneal * kl)
    return loss_fn

class EpochTracker(tf.keras.callbacks.Callback):
    def __init__(self, epoch_var):
        super().__init__()
        self.epoch_var = epoch_var
    def on_epoch_begin(self, epoch, logs=None):
        self.epoch_var.assign(float(epoch + 1))

class CosineEvidenceHead(Layer):
    """
    Cosine-Normalized Evidential Head (Deng et al., 2023 / Charpentier et al., 2020):
    Evidence e_k = scale * ReLU(cos(h, w_k) - margin)
    Enforces that only inputs whose representations align within the angular cone of training classes emit evidence.
    Novel / out-of-distribution inputs that do not align emit zero evidence (alpha -> [1, 1], u -> 1.0).
    """
    def __init__(self, num_classes=2, scale=10.0, margin=0.2, **kwargs):
        super().__init__(**kwargs)
        self.num_classes = num_classes
        self.scale = scale
        self.margin = margin

    def build(self, input_shape):
        self.w = self.add_weight(
            shape=(input_shape[-1], self.num_classes),
            initializer="glorot_uniform",
            trainable=True,
            name="class_directions"
        )
        super().build(input_shape)

    def call(self, h):
        # L2-normalize feature vector h and weight vectors w
        h_norm = tf.nn.l2_normalize(h, axis=-1)
        w_norm = tf.nn.l2_normalize(self.w, axis=0)
        # Cosine similarity in [-1, 1]
        cos_sim = tf.matmul(h_norm, w_norm)
        # Evidence with angular margin threshold
        evidence = self.scale * tf.nn.relu(cos_sim - self.margin)
        return evidence

def build_cosine_edl_model(scale=10.0, margin=0.2):
    inp_v = Input(shape=IMG_SHAPE)
    v = Conv2D(16, (3, 3), padding="same", activation="relu")(inp_v)
    v = MaxPooling2D((4, 4))(v)
    v = Flatten()(v)
    v_dense = Dense(FEATURE_DIM, activation="relu")(v)
    v_dense = Dropout(0.2)(v_dense)

    inp_l = Input(shape=(MAX_LEN,))
    l = Embedding(VOCAB_SIZE, 32)(inp_l)
    l = Conv1D(FEATURE_DIM, 3, padding="same", activation="relu")(l)
    l = MaxPooling1D(6)(l)
    l = Flatten()(l)
    l_dense = Dense(FEATURE_DIM, activation="relu")(l)
    l_dense = Dropout(0.2)(l_dense)

    fused = concatenate([v_dense, l_dense])
    h = Dense(48, activation="relu")(fused)
    h = Dropout(0.2)(h)
    h = Dense(32, activation="relu")(h)
    
    evidence = CosineEvidenceHead(num_classes=2, scale=scale, margin=margin)(h)
    alpha = tf.keras.layers.Lambda(lambda e: e + 1.0)(evidence)
    return Model(inputs=[inp_v, inp_l], outputs=alpha)

print("=== TESTING COSINE-NORMALIZED EVIDENTIAL HEAD ===")
for margin in [0.0, 0.15, 0.3]:
    for scale in [8.0, 12.0]:
        epoch_var = tf.Variable(1.0, trainable=False, dtype=tf.float32)
        model = build_cosine_edl_model(scale=scale, margin=margin)
        model.compile(optimizer=tf.keras.optimizers.Adam(0.001), loss=create_edl_loss(epoch_var, 8))
        model.fit([X_v_train, X_s_train], y_train, epochs=8, batch_size=64, callbacks=[EpochTracker(epoch_var)], verbose=0)
        
        alpha_val = model.predict([X_v_val, X_s_val], verbose=0)
        alpha_ood = model.predict([X_imgs_ood, X_seqs_ood], verbose=0)
        
        u_id = 2.0 / np.sum(alpha_val, axis=-1)
        u_ood = 2.0 / np.sum(alpha_ood, axis=-1)
        acc = accuracy_score(y_val, np.argmax(alpha_val, axis=1))
        
        print(f"Margin: {margin:.2f} | Scale: {scale:4.1f} | Acc: {acc*100:.2f}% | ID u: {np.mean(u_id):.4f} (med: {np.median(u_id):.4f}) | OOD u: {np.mean(u_ood):.4f} (med: {np.median(u_ood):.4f}) | OOD/ID: {np.mean(u_ood)/np.mean(u_id):.2f}x")
