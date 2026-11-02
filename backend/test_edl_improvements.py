"""
Systematic exploration of Quish-EDL architectural & loss improvements:
1. Sensoy et al. Cross-Entropy Bayes Risk Loss vs MSE Loss
2. Evidence Heads: Softplus vs Exp-Clamped vs Shifted-Softplus vs LeakyReLU
3. OOD Baselines: MSP, Softmax Entropy, Energy Score (Liu et al., NeurIPS 2020)
4. Outlier Exposure Weight Tuning
"""

import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input, Embedding, Conv2D, MaxPooling2D,
    Conv1D, MaxPooling1D, Dense, Dropout, Flatten, concatenate
)
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score, brier_score_loss

p_id = "data/quishing_id_dataset.npz" if os.path.exists("data/quishing_id_dataset.npz") else "backend/data/quishing_id_dataset.npz"
p_ood = "data/quishing_ood_dataset.npz" if os.path.exists("data/quishing_ood_dataset.npz") else "backend/data/quishing_ood_dataset.npz"

d_id = np.load(p_id)
d_ood = np.load(p_ood)

X_imgs_id, X_seqs_id, y_id = d_id["images"], d_id["sequences"], d_id["labels"]
X_imgs_ood, X_seqs_ood = d_ood["images"], d_ood["sequences"]

IMG_SHAPE = (64, 64, 1)
MAX_LEN = 180
VOCAB_SIZE = 110
NUM_CLASSES = 2
FEATURE_DIM = 32
TOTAL_EPOCHS = 8

# LFO Partitioning (Set A = 8 exposed families, Set B = 8 held-out families)
idx_set_a = [i for i in range(len(X_imgs_ood)) if (i % 16) % 2 == 0]
idx_set_b = [i for i in range(len(X_imgs_ood)) if (i % 16) % 2 == 1]

imgs_exposed, seqs_exposed = X_imgs_ood[idx_set_a], X_seqs_ood[idx_set_a]
imgs_heldout, seqs_heldout = X_imgs_ood[idx_set_b], X_seqs_ood[idx_set_b]

# Fold 1 with seed 42
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
train_idx, val_idx = next(skf.split(X_imgs_id, y_id))

train_v, val_v = X_imgs_id[train_idx], X_imgs_id[val_idx]
train_s, val_s = X_seqs_id[train_idx], X_seqs_id[val_idx]
train_y, val_y = y_id[train_idx], y_id[val_idx]

# OE training set from Set A (5%)
np.random.seed(42)
n_oe = int(0.05 * len(train_y))
oe_sample_idx = np.random.choice(len(imgs_exposed), size=n_oe, replace=True)
oe_v = np.concatenate([train_v, imgs_exposed[oe_sample_idx]], axis=0)
oe_s = np.concatenate([train_s, seqs_exposed[oe_sample_idx]], axis=0)
oe_y = np.concatenate([train_y, -1 * np.ones(n_oe, dtype=np.int32)], axis=0)
p_oe = np.random.permutation(len(oe_y))
oe_v, oe_s, oe_y = oe_v[p_oe], oe_s[p_oe], oe_y[p_oe]

def compute_ece(probs, labels, n_bins=10):
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    confidences = np.max(probs, axis=1)
    predictions = np.argmax(probs, axis=1)
    accuracies = (predictions == labels)
    for i in range(n_bins):
        in_bin = (confidences > bin_boundaries[i]) & (confidences <= bin_boundaries[i + 1])
        prop = np.mean(in_bin)
        if prop > 0:
            ece += np.abs(np.mean(confidences[in_bin]) - np.mean(accuracies[in_bin])) * prop
    return float(ece)

def compute_ood_auroc_and_fpr(id_scores, ood_scores):
    y_true = np.concatenate([np.zeros(len(id_scores)), np.ones(len(ood_scores))])
    y_scores = np.concatenate([id_scores, ood_scores])
    auroc = roc_auc_score(y_true, y_scores)
    threshold_95 = np.percentile(ood_scores, 5.0)
    fpr_95 = np.mean(id_scores >= threshold_95)
    return float(auroc), float(fpr_95)

def kl_divergence_uniform(alpha):
    beta = tf.ones((1, NUM_CLASSES), dtype=tf.float32)
    alpha_c = tf.clip_by_value(alpha, 1.0, 1e4)
    S_alpha = tf.reduce_sum(alpha_c, axis=-1, keepdims=True)
    S_beta = tf.reduce_sum(beta, axis=-1, keepdims=True)
    lnB = tf.math.lgamma(S_alpha) - tf.reduce_sum(tf.math.lgamma(alpha_c), axis=-1, keepdims=True)
    lnB_uni = tf.math.lgamma(S_beta) - tf.reduce_sum(tf.math.lgamma(beta), axis=-1, keepdims=True)
    dg0 = tf.math.digamma(S_alpha)
    dg1 = tf.math.digamma(alpha_c)
    kl = tf.reduce_sum((alpha_c - beta) * (dg1 - dg0), axis=-1, keepdims=True) + lnB + lnB_uni
    return tf.clip_by_value(kl, 0.0, 1e4)

# --- EDL Loss Formulations ---
def create_edl_ce_loss(epoch_var, ood_weight=0.05):
    """Sensoy et al. (NeurIPS 2018) Cross-Entropy Bayes Risk EDL Loss with Outlier Exposure"""
    def loss_fn(y_true, alpha):
        y_flat = tf.reshape(y_true, [-1])
        is_id = tf.cast(y_flat >= 0, tf.float32)
        is_ood = 1.0 - is_id
        
        y_safe = tf.maximum(0, tf.cast(y_flat, tf.int32))
        y_one_hot = tf.one_hot(y_safe, depth=NUM_CLASSES)
        
        alpha_c = tf.clip_by_value(alpha, 1.0, 1e4)
        S = tf.reduce_sum(alpha_c, axis=-1, keepdims=True)
        
        # Expected Cross-Entropy under Dirichlet: sum_k y_k * (digamma(S) - digamma(alpha_k))
        psi_S = tf.math.digamma(S)
        psi_alpha = tf.math.digamma(alpha_c)
        loss_ce = tf.reduce_sum(y_one_hot * (psi_S - psi_alpha), axis=-1, keepdims=True)
        
        # KL divergence regularization on false evidence
        alpha_tilde = y_one_hot + (1.0 - y_one_hot) * alpha_c
        kl_id = kl_divergence_uniform(alpha_tilde)
        anneal = tf.minimum(1.0, epoch_var / (float(TOTAL_EPOCHS) / 2.0))
        
        loss_id = is_id * tf.reshape(loss_ce + anneal * kl_id, [-1])
        kl_ood = kl_divergence_uniform(alpha_c)
        loss_ood = is_ood * tf.reshape(kl_ood, [-1])
        
        num_id = tf.maximum(1.0, tf.reduce_sum(is_id))
        num_ood = tf.maximum(1.0, tf.reduce_sum(is_ood))
        return (tf.reduce_sum(loss_id) / num_id) + ood_weight * (tf.reduce_sum(loss_ood) / num_ood) * tf.cast(tf.reduce_sum(is_ood) > 0, tf.float32)
    return loss_fn

def create_edl_mse_loss(epoch_var, ood_weight=0.035):
    """Sensoy et al. Expected MSE EDL Loss with Outlier Exposure"""
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
        anneal = tf.minimum(1.0, epoch_var / (float(TOTAL_EPOCHS) / 2.0))
        
        loss_id = is_id * tf.reshape(err + var + anneal * kl_id, [-1])
        kl_ood = kl_divergence_uniform(alpha_c)
        loss_ood = is_ood * tf.reshape(kl_ood, [-1])
        
        num_id = tf.maximum(1.0, tf.reduce_sum(is_id))
        num_ood = tf.maximum(1.0, tf.reduce_sum(is_ood))
        return (tf.reduce_sum(loss_id) / num_id) + ood_weight * (tf.reduce_sum(loss_ood) / num_ood) * tf.cast(tf.reduce_sum(is_ood) > 0, tf.float32)
    return loss_fn

class EpochTracker(tf.keras.callbacks.Callback):
    def __init__(self, epoch_var):
        super().__init__()
        self.epoch_var = epoch_var
    def on_epoch_begin(self, epoch, logs=None):
        self.epoch_var.assign(float(epoch + 1))

def build_shared_backbone():
    inp_v = Input(shape=IMG_SHAPE)
    v = Conv2D(16, (3, 3), padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(inp_v)
    v = MaxPooling2D((4, 4))(v)
    v = Flatten()(v)
    v_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(v)
    v_dense = Dropout(0.2)(v_dense)

    inp_l = Input(shape=(MAX_LEN,))
    embed = Embedding(VOCAB_SIZE, 32)(inp_l)
    c3 = Conv1D(16, 3, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(embed)
    c5 = Conv1D(16, 5, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(embed)
    lex_cat = concatenate([c3, c5])
    lex_pool = MaxPooling1D(6)(lex_cat)
    lex_flat = Flatten()(lex_pool)
    l_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(lex_flat)
    l_dense = Dropout(0.2)(l_dense)

    fused = concatenate([v_dense, l_dense])
    h = Dense(48, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(fused)
    h = Dropout(0.2)(h)
    h = Dense(32, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(h)
    return inp_v, inp_l, h

def evaluate_candidate(name, head_type, loss_type, ood_weight=0.035):
    tf.keras.utils.set_random_seed(42)
    inp_v, inp_l, h = build_shared_backbone()
    
    if head_type == "softmax":
        logits = Dense(NUM_CLASSES)(h)
        out = tf.keras.layers.Activation("softmax")(logits)
        model = Model(inputs=[inp_v, inp_l], outputs=out)
        model_energy = Model(inputs=[inp_v, inp_l], outputs=[out, logits])
        
        # Softmax OE loss
        def sm_loss(y_true, y_pred):
            y_flat = tf.reshape(y_true, [-1])
            is_id = tf.cast(y_flat >= 0, tf.float32)
            is_ood = 1.0 - is_id
            y_safe = tf.maximum(0, tf.cast(y_flat, tf.int32))
            y_one_hot = tf.one_hot(y_safe, depth=NUM_CLASSES)
            p = tf.clip_by_value(y_pred, 1e-7, 1.0 - 1e-7)
            ce_id = -tf.reduce_sum(y_one_hot * tf.math.log(p), axis=-1)
            kl_ood = tf.reduce_sum(p * (tf.math.log(p) - tf.math.log(0.5)), axis=-1)
            num_id = tf.maximum(1.0, tf.reduce_sum(is_id))
            num_ood = tf.maximum(1.0, tf.reduce_sum(is_ood))
            return tf.reduce_sum(is_id * ce_id) / num_id + ood_weight * tf.reduce_sum(is_ood * kl_ood) / num_ood
            
        model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001), loss=sm_loss)
        model.fit([oe_v, oe_s], oe_y, epochs=TOTAL_EPOCHS, batch_size=64, verbose=0)
        
        p_val, z_val = model_energy.predict([val_v, val_s], verbose=0)
        p_held, z_held = model_energy.predict([imgs_heldout, seqs_heldout], verbose=0)
        
        preds_val = np.argmax(p_val, axis=1)
        acc = accuracy_score(val_y, preds_val)
        ece = compute_ece(p_val, val_y)
        brier = brier_score_loss(val_y, p_val[:, 1])
        
        # 1. Entropy score
        u_val_ent = -np.sum(p_val * np.log(p_val + 1e-12), axis=1) / np.log(2.0)
        u_held_ent = -np.sum(p_held * np.log(p_held + 1e-12), axis=1) / np.log(2.0)
        auc_ent, fpr_ent = compute_ood_auroc_and_fpr(u_val_ent, u_held_ent)
        
        # 2. Energy score: -E(x) = T * logsumexp(z / T) (lower energy = higher score for OOD: score = -E)
        # In OOD detection, ID has high logsumexp (low energy), OOD has low logsumexp (high energy)
        # So score = -logsumexp(z) assigns higher score to OOD
        score_val_eng = -np.log(np.sum(np.exp(z_val - np.max(z_val, axis=1, keepdims=True)), axis=1)) - np.max(z_val, axis=1)
        score_held_eng = -np.log(np.sum(np.exp(z_held - np.max(z_held, axis=1, keepdims=True)), axis=1)) - np.max(z_held, axis=1)
        auc_eng, fpr_eng = compute_ood_auroc_and_fpr(score_val_eng, score_held_eng)
        
        print(f"[{name}] Acc={acc*100:.2f}%, ECE={ece:.4f}, Entropy AUROC={auc_ent:.4f} (FPR={fpr_ent*100:.1f}%), Energy AUROC={auc_eng:.4f} (FPR={fpr_eng*100:.1f}%)", flush=True)
        return
        
    # Evidential Heads
    if head_type == "softplus":
        evidence = Dense(NUM_CLASSES, activation="softplus")(h)
    elif head_type == "exp_clip":
        z = Dense(NUM_CLASSES)(h)
        evidence = tf.keras.layers.Lambda(lambda x: tf.exp(tf.clip_by_value(x, -6.0, 4.0)))(z)
    elif head_type == "shifted_softplus":
        # softplus with initial negative bias so evidence can reach ~0 at z=0
        z = Dense(NUM_CLASSES, bias_initializer=tf.keras.initializers.Constant(-2.0))(h)
        evidence = tf.keras.layers.Activation("softplus")(z)
    elif head_type == "leaky_relu":
        z = Dense(NUM_CLASSES)(h)
        evidence = tf.keras.layers.Lambda(lambda x: tf.nn.leaky_relu(x, alpha=0.02))(z)
        
    alpha = tf.keras.layers.Lambda(lambda e: e + 1.0)(evidence)
    model = Model(inputs=[inp_v, inp_l], outputs=alpha)
    
    epoch_var = tf.Variable(1.0, trainable=False, dtype=tf.float32)
    if loss_type == "ce":
        loss_fn = create_edl_ce_loss(epoch_var, ood_weight=ood_weight)
    else:
        loss_fn = create_edl_mse_loss(epoch_var, ood_weight=ood_weight)
        
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001), loss=loss_fn)
    model.fit([oe_v, oe_s], oe_y, epochs=TOTAL_EPOCHS, batch_size=64, callbacks=[EpochTracker(epoch_var)], verbose=0)
    
    alpha_val = model.predict([val_v, val_s], verbose=0)
    S_val = np.sum(alpha_val, axis=-1, keepdims=True)
    p_val = alpha_val / S_val
    u_val = 2.0 / S_val.flatten()
    
    alpha_held = model.predict([imgs_heldout, seqs_heldout], verbose=0)
    S_held = np.sum(alpha_held, axis=-1, keepdims=True)
    u_held = 2.0 / S_held.flatten()
    
    preds_val = np.argmax(p_val, axis=1)
    acc = accuracy_score(val_y, preds_val)
    ece = compute_ece(p_val, val_y)
    brier = brier_score_loss(val_y, p_val[:, 1])
    
    auc, fpr = compute_ood_auroc_and_fpr(u_val, u_held)
    ratio = np.mean(u_held) / np.mean(u_val)
    
    # Also inspect evidence distribution: mean S_ID and mean S_OOD
    print(f"[{name}] Acc={acc*100:.2f}%, ECE={ece:.4f}, Held AUROC={auc:.4f}, FPR@95={fpr*100:.1f}%, Ratio={ratio:.2f}x (S_ID={np.mean(S_val):.2f}, S_OOD={np.mean(S_held):.2f})", flush=True)

print("Starting Systematic Architecture Exploration...", flush=True)

# 1. Softmax + OE (Hendrycks) with Entropy and Energy Score
evaluate_candidate("Softmax + OE (Hendrycks w=0.5)", head_type="softmax", loss_type="sm", ood_weight=0.5)

# 2. EDL with MSE Loss (Baseline Upgraded)
evaluate_candidate("EDL MSE + Softplus (w=0.035)", head_type="softplus", loss_type="mse", ood_weight=0.035)

# 3. EDL with Cross-Entropy Loss (Sensoy et al.)
evaluate_candidate("EDL CE + Softplus (w=0.035)", head_type="softplus", loss_type="ce", ood_weight=0.035)
evaluate_candidate("EDL CE + Softplus (w=0.10)", head_type="softplus", loss_type="ce", ood_weight=0.10)
evaluate_candidate("EDL CE + Softplus (w=0.25)", head_type="softplus", loss_type="ce", ood_weight=0.25)

# 4. EDL CE with Exp-Clamped Head (floor elimination)
evaluate_candidate("EDL CE + Exp-Clamped (w=0.05)", head_type="exp_clip", loss_type="ce", ood_weight=0.05)
evaluate_candidate("EDL CE + Exp-Clamped (w=0.10)", head_type="exp_clip", loss_type="ce", ood_weight=0.10)

# 5. EDL CE with Shifted-Softplus (negative bias)
evaluate_candidate("EDL CE + Shifted-Softplus (w=0.05)", head_type="shifted_softplus", loss_type="ce", ood_weight=0.05)
evaluate_candidate("EDL CE + Shifted-Softplus (w=0.10)", head_type="shifted_softplus", loss_type="ce", ood_weight=0.10)

# 6. EDL CE with LeakyReLU (no floor, non-vanishing gradient)
evaluate_candidate("EDL CE + LeakyReLU (w=0.05)", head_type="leaky_relu", loss_type="ce", ood_weight=0.05)

