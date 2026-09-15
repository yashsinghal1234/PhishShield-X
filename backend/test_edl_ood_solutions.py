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
from tensorflow.keras.regularizers import l2
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

# Split ID
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

# --- Method A: Standard Dense + ReLU ---
def build_model_A():
    inp_v = Input(shape=IMG_SHAPE)
    v = Conv2D(16, (3, 3), padding="same", activation="relu", kernel_regularizer=l2(1e-4))(inp_v)
    v = MaxPooling2D((4, 4))(v)
    v = Flatten()(v)
    v_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=l2(1e-4))(v)
    v_dense = Dropout(0.2)(v_dense)

    inp_l = Input(shape=(MAX_LEN,))
    l = Embedding(VOCAB_SIZE, 32)(inp_l)
    l = Conv1D(FEATURE_DIM, 3, padding="same", activation="relu", kernel_regularizer=l2(1e-4))(l)
    l = MaxPooling1D(6)(l)
    l = Flatten()(l)
    l_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=l2(1e-4))(l)
    l_dense = Dropout(0.2)(l_dense)

    fused = concatenate([v_dense, l_dense])
    h = Dense(48, activation="relu", kernel_regularizer=l2(1e-4))(fused)
    h = Dropout(0.2)(h)
    h = Dense(32, activation="relu", kernel_regularizer=l2(1e-4))(h)
    
    evidence = Dense(2, activation="relu", kernel_regularizer=l2(1e-4))(h)
    alpha = tf.keras.layers.Lambda(lambda e: e + 1.0)(evidence)
    return Model(inputs=[inp_v, inp_l], outputs=alpha)

# --- Method B: Dirichlet Prior Regularization with Out-of-Distribution Exposure ---
# Generate synthetic random non-URL token sequences & perturbed noise QR patterns during training
# Target for OOD: y_ood = -1, which enforces KL(Dir(alpha) || Dir(1, 1)) -> 0 (i.e. zero evidence, u=1.0)

def create_edl_prior_loss(epoch_var, total_epochs=8, ood_weight=0.5):
    def loss_fn(y_true, alpha):
        y_flat = tf.reshape(y_true, [-1])
        is_id = tf.cast(y_flat >= 0, tf.float32)
        is_ood = 1.0 - is_id
        
        # ID Loss
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
        
        # OOD Prior Regularization: Penalize ALL evidence on OOD samples (Target alpha -> [1, 1], u -> 1.0)
        kl_ood = kl_divergence_uniform(alpha_c)
        loss_ood = is_ood * tf.reshape(kl_ood, [-1])
        
        num_id = tf.maximum(1.0, tf.reduce_sum(is_id))
        num_ood = tf.maximum(1.0, tf.reduce_sum(is_ood))
        return (tf.reduce_sum(loss_id) / num_id) + ood_weight * (tf.reduce_sum(loss_ood) / num_ood)
    return loss_fn

# --- Method C: RBF / Distance Evidence Head ---
class RBFEvidenceLayer(Layer):
    """Computes Evidence via Radial Basis Function (RBF) Kernel to Learned Class Centroids."""
    def __init__(self, num_classes=2, feature_dim=32, scale=10.0, **kwargs):
        super().__init__(**kwargs)
        self.num_classes = num_classes
        self.scale = scale

    def build(self, input_shape):
        self.centroids = self.add_weight(
            shape=(self.num_classes, input_shape[-1]),
            initializer="glorot_uniform",
            trainable=True,
            name="class_centroids"
        )
        self.gamma = self.add_weight(
            shape=(self.num_classes,),
            initializer=tf.keras.initializers.Constant(0.1),
            trainable=True,
            name="gamma"
        )
        super().build(input_shape)

    def call(self, x):
        # x: (B, D), centroids: (C, D)
        # ||x - c_k||^2
        x_exp = tf.expand_dims(x, axis=1) # (B, 1, D)
        c_exp = tf.expand_dims(self.centroids, axis=0) # (1, C, D)
        dist_sq = tf.reduce_sum(tf.square(x_exp - c_exp), axis=-1) # (B, C)
        evidence = self.scale * tf.exp(-tf.abs(self.gamma) * dist_sq)
        return evidence

def build_model_C():
    inp_v = Input(shape=IMG_SHAPE)
    v = Conv2D(16, (3, 3), padding="same", activation="relu", kernel_regularizer=l2(1e-4))(inp_v)
    v = MaxPooling2D((4, 4))(v)
    v = Flatten()(v)
    v_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=l2(1e-4))(v)
    v_dense = Dropout(0.2)(v_dense)

    inp_l = Input(shape=(MAX_LEN,))
    l = Embedding(VOCAB_SIZE, 32)(inp_l)
    l = Conv1D(FEATURE_DIM, 3, padding="same", activation="relu", kernel_regularizer=l2(1e-4))(l)
    l = MaxPooling1D(6)(l)
    l = Flatten()(l)
    l_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=l2(1e-4))(l)
    l_dense = Dropout(0.2)(l_dense)

    fused = concatenate([v_dense, l_dense])
    h = Dense(48, activation="relu", kernel_regularizer=l2(1e-4))(fused)
    h = Dropout(0.2)(h)
    h = Dense(32, activation="relu", kernel_regularizer=l2(1e-4))(h)
    
    evidence = RBFEvidenceLayer(num_classes=2, feature_dim=32, scale=8.0)(h)
    alpha = tf.keras.layers.Lambda(lambda e: e + 1.0)(evidence)
    return Model(inputs=[inp_v, inp_l], outputs=alpha)


# Evaluate all 3 methods
print("=== COMPARING EDL HEAD MECHANISMS FOR ZERO-DAY OOD UNCERTAINTY ===")

# 1. Test Method A (Standard EDL)
epoch_var_A = tf.Variable(1.0, trainable=False, dtype=tf.float32)
mA = build_model_A()
mA.compile(optimizer=tf.keras.optimizers.Adam(0.001), loss=create_edl_loss(epoch_var_A, 8))
mA.fit([X_v_train, X_s_train], y_train, epochs=8, batch_size=64, callbacks=[EpochTracker(epoch_var_A)], verbose=0)
alpha_val_A = mA.predict([X_v_val, X_s_val], verbose=0)
alpha_ood_A = mA.predict([X_imgs_ood, X_seqs_ood], verbose=0)
u_id_A = 2.0 / np.sum(alpha_val_A, axis=-1)
u_ood_A = 2.0 / np.sum(alpha_ood_A, axis=-1)
acc_A = accuracy_score(y_val, np.argmax(alpha_val_A, axis=1))

print(f"\n[Method A: Standard ReLU EDL]")
print(f"  Acc: {acc_A*100:.2f}%")
print(f"  ID  Uncertainty (u): Mean = {np.mean(u_id_A):.4f} | Median = {np.median(u_id_A):.4f} | 75% = {np.percentile(u_id_A, 75):.4f}")
print(f"  OOD Uncertainty (u): Mean = {np.mean(u_ood_A):.4f} | Median = {np.median(u_ood_A):.4f} | 75% = {np.percentile(u_ood_A, 75):.4f}")
print(f"  OOD / ID Ratio: {np.mean(u_ood_A)/np.mean(u_id_A):.2f}x")

# 2. Test Method B (EDL with Outlier Exposure / Prior Regularization)
# Create synthetic outlier training batches (random characters & random noise images, y = -1)
N_outliers = 600
np.random.seed(42)
synth_seqs = np.random.randint(1, VOCAB_SIZE, size=(N_outliers, MAX_LEN))
synth_imgs = np.random.uniform(0.0, 1.0, size=(N_outliers, 64, 64, 1)).astype(np.float32)
y_synth = -1 * np.ones(N_outliers, dtype=np.int32)

X_v_train_B = np.concatenate([X_v_train, synth_imgs], axis=0)
X_s_train_B = np.concatenate([X_s_train, synth_seqs], axis=0)
y_train_B = np.concatenate([y_train, y_synth], axis=0)

epoch_var_B = tf.Variable(1.0, trainable=False, dtype=tf.float32)
mB = build_model_A()
mB.compile(optimizer=tf.keras.optimizers.Adam(0.001), loss=create_edl_prior_loss(epoch_var_B, 8, ood_weight=1.0))
mB.fit([X_v_train_B, X_s_train_B], y_train_B, epochs=8, batch_size=64, callbacks=[EpochTracker(epoch_var_B)], verbose=0)
alpha_val_B = mB.predict([X_v_val, X_s_val], verbose=0)
alpha_ood_B = mB.predict([X_imgs_ood, X_seqs_ood], verbose=0)
u_id_B = 2.0 / np.sum(alpha_val_B, axis=-1)
u_ood_B = 2.0 / np.sum(alpha_ood_B, axis=-1)
acc_B = accuracy_score(y_val, np.argmax(alpha_val_B, axis=1))

print(f"\n[Method B: Dirichlet Prior Regularization (Open Set Exposure)]")
print(f"  Acc: {acc_B*100:.2f}%")
print(f"  ID  Uncertainty (u): Mean = {np.mean(u_id_B):.4f} | Median = {np.median(u_id_B):.4f} | 75% = {np.percentile(u_id_B, 75):.4f}")
print(f"  OOD Uncertainty (u): Mean = {np.mean(u_ood_B):.4f} | Median = {np.median(u_ood_B):.4f} | 75% = {np.percentile(u_ood_B, 75):.4f}")
print(f"  OOD / ID Ratio: {np.mean(u_ood_B)/np.mean(u_id_B):.2f}x")

# 3. Test Method C (RBF Centroid EDL Head)
epoch_var_C = tf.Variable(1.0, trainable=False, dtype=tf.float32)
mC = build_model_C()
mC.compile(optimizer=tf.keras.optimizers.Adam(0.001), loss=create_edl_loss(epoch_var_C, 8))
mC.fit([X_v_train, X_s_train], y_train, epochs=8, batch_size=64, callbacks=[EpochTracker(epoch_var_C)], verbose=0)
alpha_val_C = mC.predict([X_v_val, X_s_val], verbose=0)
alpha_ood_C = mC.predict([X_imgs_ood, X_seqs_ood], verbose=0)
u_id_C = 2.0 / np.sum(alpha_val_C, axis=-1)
u_ood_C = 2.0 / np.sum(alpha_ood_C, axis=-1)
acc_C = accuracy_score(y_val, np.argmax(alpha_val_C, axis=1))

print(f"\n[Method C: RBF Distance-Centroid Evidential Head]")
print(f"  Acc: {acc_C*100:.2f}%")
print(f"  ID  Uncertainty (u): Mean = {np.mean(u_id_C):.4f} | Median = {np.median(u_id_C):.4f} | 75% = {np.percentile(u_id_C, 75):.4f}")
print(f"  OOD Uncertainty (u): Mean = {np.mean(u_ood_C):.4f} | Median = {np.median(u_ood_C):.4f} | 75% = {np.percentile(u_ood_C, 75):.4f}")
print(f"  OOD / ID Ratio: {np.mean(u_ood_C)/np.mean(u_id_C):.2f}x")
