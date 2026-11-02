"""
Rigorous Leave-Families-Out (LFO) Outlier Exposure Benchmark for Quishing Detection.
Directly evaluates the hypothesis: Does Outlier Exposure generalize to held-out evasion families,
and does Evidential Deep Learning (M6) provide genuine advantages over Softmax + OE (M3 + OE)
under strict encoder parity?

Models evaluated:
1. M3 (Softmax): Multi-kernel lexical + visual early fusion, standard cross-entropy on ID.
2. M3 + OE (Softmax + OE): Same architecture, Hendrycks et al. uniform KL Outlier Exposure on exposed families.
3. M6 + OE (Quish-EDL Softplus): Same architecture, continuous Softplus evidential head with EDL OE loss.
4. M6 + OE (Quish-EDL ReLU): Same architecture, piecewise ReLU evidential head with EDL OE loss.

Protocol:
- 5 independent random seeds (42, 123, 456, 789, 1024)
- Leave-Families-Out (LFO): 8 protocol families exposed to OE (Set A), 8 protocol families strictly held out (Set B).
- Metrics reported: ID Accuracy, ID ECE, ID Brier Score, Held-out OOD AUROC, Held-out FPR@95% TPR, and Uncertainty Ratio.
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
import scipy.stats as stats

# 1. Load Benchmarks
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

# 2. Partition 16 OOD Evasion Families into Disjoint Sets (200 samples each)
# Each family appears every 16 samples in the 400-sample array
# Set A (Even families 0, 2, 4, 6, 8, 10, 12, 14):
# WIFI, bitcoin, geo, otpauth, ssh, vcard, plain_advisory, data_uri
idx_set_a = [i for i in range(len(X_imgs_ood)) if (i % 16) % 2 == 0]

# Set B (Odd families 1, 3, 5, 7, 9, 11, 13, 15):
# UPI, ethereum, tel, matrix, magnet, iot_json, hex_hash, shortener_redirect
idx_set_b = [i for i in range(len(X_imgs_ood)) if (i % 16) % 2 == 1]

imgs_exposed, seqs_exposed = X_imgs_ood[idx_set_a], X_seqs_ood[idx_set_a]
imgs_heldout, seqs_heldout = X_imgs_ood[idx_set_b], X_seqs_ood[idx_set_b]

print(f"Total ID Samples: {len(y_id)}")
print(f"Set A (Exposed OE Families): {len(imgs_exposed)} samples (8 families)")
print(f"Set B (Held-Out Zero-Day Families): {len(imgs_heldout)} samples (8 families)\n", flush=True)

# 3. Helper Functions for Calibration & OOD Metrics
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
    """
    Computes AUROC and FPR@95% TPR.
    Scores represent uncertainty (higher score = more likely OOD).
    """
    y_true = np.concatenate([np.zeros(len(id_scores)), np.ones(len(ood_scores))])
    y_scores = np.concatenate([id_scores, ood_scores])
    auroc = roc_auc_score(y_true, y_scores)
    
    # 95% TPR on OOD: 95% of OOD have score >= threshold (i.e. 5th percentile)
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

# 4. Losses
def create_softmax_oe_loss(ood_weight=0.5):
    """Hendrycks et al. (ICLR 2019) Softmax Outlier Exposure Loss: CE(ID) + lambda * KL(p_OOD || Uniform)"""
    def loss_fn(y_true, y_pred):
        y_flat = tf.reshape(y_true, [-1])
        is_id = tf.cast(y_flat >= 0, tf.float32)
        is_ood = 1.0 - is_id
        
        y_safe = tf.maximum(0, tf.cast(y_flat, tf.int32))
        y_one_hot = tf.one_hot(y_safe, depth=NUM_CLASSES)
        
        # Cross-Entropy on ID
        eps = 1e-7
        p = tf.clip_by_value(y_pred, eps, 1.0 - eps)
        ce_id = -tf.reduce_sum(y_one_hot * tf.math.log(p), axis=-1)
        
        # KL(p_OOD || Uniform) = log(K) - H(p_OOD) = sum(p * log(p / 0.5))
        kl_ood = tf.reduce_sum(p * (tf.math.log(p) - tf.math.log(0.5)), axis=-1)
        
        num_id = tf.maximum(1.0, tf.reduce_sum(is_id))
        num_ood = tf.maximum(1.0, tf.reduce_sum(is_ood))
        
        loss_id = tf.reduce_sum(is_id * ce_id) / num_id
        loss_ood = tf.reduce_sum(is_ood * kl_ood) / num_ood
        return loss_id + ood_weight * loss_ood * tf.cast(tf.reduce_sum(is_ood) > 0, tf.float32)
    return loss_fn

def create_edl_oe_loss(epoch_var, ood_weight=0.035):
    """Evidential Deep Learning Outlier Exposure Loss"""
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

# 5. Shared Parity Encoders
def build_backbone():
    inp_v = Input(shape=IMG_SHAPE, name="qr_image_input")
    v = Conv2D(16, (3, 3), padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(inp_v)
    v = MaxPooling2D((4, 4))(v)
    v = Flatten()(v)
    v_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(v)
    v_dense = Dropout(0.2)(v_dense)

    inp_l = Input(shape=(MAX_LEN,), name="url_seq_input")
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

def build_softmax_model():
    inp_v, inp_l, h = build_backbone()
    out = Dense(NUM_CLASSES, activation="softmax", name="softmax_output")(h)
    return Model(inputs=[inp_v, inp_l], outputs=out)

def build_edl_model(activation="softplus"):
    inp_v, inp_l, h = build_backbone()
    evidence = Dense(NUM_CLASSES, activation=activation, name="evidence")(h)
    alpha = tf.keras.layers.Lambda(lambda e: e + 1.0, name="alpha_output")(evidence)
    return Model(inputs=[inp_v, inp_l], outputs=alpha)

# 6. Evaluation Loop Across 5 Seeds
SEEDS = [42, 123, 456, 789, 1024]
models_to_test = [
    "M3 (Softmax Baseline)",
    "M3 + OE (Softmax + OE)",
    "M6 + OE (Quish-EDL Softplus + OE)",
    "M6 + OE (Quish-EDL ReLU + OE)"
]

seed_results = {m: {
    "acc": [], "ece": [], "brier": [],
    "heldout_auroc": [], "heldout_fpr": [], "heldout_ratio": [],
    "exposed_auroc": [], "exposed_fpr": []
} for m in models_to_test}

print("="*90)
print("  LEAVE-FAMILIES-OUT (LFO) BENCHMARK ACROSS 5 INDEPENDENT SEEDS")
print("="*90, flush=True)

for seed_idx, seed in enumerate(SEEDS):
    print(f"\n>>> Running Seed {seed_idx + 1}/{len(SEEDS)} (Seed: {seed}) ...", flush=True)
    tf.keras.utils.set_random_seed(seed)
    np.random.seed(seed)
    
    # 80/20 train/val split for this seed
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=seed)
    train_idx, val_idx = next(skf.split(X_imgs_id, y_id))
    
    train_v, val_v = X_imgs_id[train_idx], X_imgs_id[val_idx]
    train_s, val_s = X_seqs_id[train_idx], X_seqs_id[val_idx]
    train_y, val_y = y_id[train_idx], y_id[val_idx]
    
    # Construct OE training dataset with Set A (Exposed families only)
    n_oe = int(0.05 * len(train_y))
    oe_sample_idx = np.random.choice(len(imgs_exposed), size=n_oe, replace=True)
    oe_v = np.concatenate([train_v, imgs_exposed[oe_sample_idx]], axis=0)
    oe_s = np.concatenate([train_s, seqs_exposed[oe_sample_idx]], axis=0)
    oe_y = np.concatenate([train_y, -1 * np.ones(n_oe, dtype=np.int32)], axis=0)
    p_oe = np.random.permutation(len(oe_y))
    oe_v, oe_s, oe_y = oe_v[p_oe], oe_s[p_oe], oe_y[p_oe]
    
    for m_name in models_to_test:
        if m_name == "M3 (Softmax Baseline)":
            model = build_softmax_model()
            model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001), loss="sparse_categorical_crossentropy")
            model.fit([train_v, train_s], train_y, epochs=TOTAL_EPOCHS, batch_size=64, verbose=0)
            
            p_val = model.predict([val_v, val_s], verbose=0)
            preds_val = np.argmax(p_val, axis=1)
            # Predictive entropy as OOD uncertainty score: H(p) / log(2)
            u_val = -np.sum(p_val * np.log(p_val + 1e-12), axis=1) / np.log(2.0)
            
            p_heldout = model.predict([imgs_heldout, seqs_heldout], verbose=0)
            u_heldout = -np.sum(p_heldout * np.log(p_heldout + 1e-12), axis=1) / np.log(2.0)
            
            p_exposed = model.predict([imgs_exposed, seqs_exposed], verbose=0)
            u_exposed = -np.sum(p_exposed * np.log(p_exposed + 1e-12), axis=1) / np.log(2.0)
            
            probs_for_metrics = p_val
            
        elif m_name == "M3 + OE (Softmax + OE)":
            model = build_softmax_model()
            model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001), loss=create_softmax_oe_loss(ood_weight=0.5))
            model.fit([oe_v, oe_s], oe_y, epochs=TOTAL_EPOCHS, batch_size=64, verbose=0)
            
            p_val = model.predict([val_v, val_s], verbose=0)
            preds_val = np.argmax(p_val, axis=1)
            u_val = -np.sum(p_val * np.log(p_val + 1e-12), axis=1) / np.log(2.0)
            
            p_heldout = model.predict([imgs_heldout, seqs_heldout], verbose=0)
            u_heldout = -np.sum(p_heldout * np.log(p_heldout + 1e-12), axis=1) / np.log(2.0)
            
            p_exposed = model.predict([imgs_exposed, seqs_exposed], verbose=0)
            u_exposed = -np.sum(p_exposed * np.log(p_exposed + 1e-12), axis=1) / np.log(2.0)
            
            probs_for_metrics = p_val
            
        elif "Quish-EDL" in m_name:
            act = "softplus" if "Softplus" in m_name else "relu"
            epoch_var = tf.Variable(1.0, trainable=False, dtype=tf.float32)
            model = build_edl_model(activation=act)
            model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001), loss=create_edl_oe_loss(epoch_var, ood_weight=0.035))
            model.fit([oe_v, oe_s], oe_y, epochs=TOTAL_EPOCHS, batch_size=64, callbacks=[EpochTracker(epoch_var)], verbose=0)
            
            alpha_val = model.predict([val_v, val_s], verbose=0)
            S_val = np.sum(alpha_val, axis=-1, keepdims=True)
            p_val = alpha_val / S_val
            preds_val = np.argmax(p_val, axis=1)
            u_val = (NUM_CLASSES / S_val.flatten())
            
            alpha_heldout = model.predict([imgs_heldout, seqs_heldout], verbose=0)
            S_heldout = np.sum(alpha_heldout, axis=-1, keepdims=True)
            u_heldout = (NUM_CLASSES / S_heldout.flatten())
            
            alpha_exposed = model.predict([imgs_exposed, seqs_exposed], verbose=0)
            S_exposed = np.sum(alpha_exposed, axis=-1, keepdims=True)
            u_exposed = (NUM_CLASSES / S_exposed.flatten())
            
            probs_for_metrics = p_val

        # Compute Metrics
        acc = accuracy_score(val_y, preds_val)
        ece = compute_ece(probs_for_metrics, val_y)
        brier = brier_score_loss(val_y, probs_for_metrics[:, 1])
        
        heldout_auroc, heldout_fpr = compute_ood_auroc_and_fpr(u_val, u_heldout)
        exposed_auroc, exposed_fpr = compute_ood_auroc_and_fpr(u_val, u_exposed)
        ratio = np.mean(u_heldout) / np.mean(u_val)
        
        seed_results[m_name]["acc"].append(acc * 100)
        seed_results[m_name]["ece"].append(ece)
        seed_results[m_name]["brier"].append(brier)
        seed_results[m_name]["heldout_auroc"].append(heldout_auroc)
        seed_results[m_name]["heldout_fpr"].append(heldout_fpr * 100)
        seed_results[m_name]["heldout_ratio"].append(ratio)
        seed_results[m_name]["exposed_auroc"].append(exposed_auroc)
        seed_results[m_name]["exposed_fpr"].append(exposed_fpr * 100)
        
        print(f"  [{m_name}] Acc={acc*100:.2f}%, ECE={ece:.4f}, Held-Out AUROC={heldout_auroc:.4f}, FPR@95={heldout_fpr*100:.1f}%, Ratio={ratio:.2f}x (Exposed AUROC={exposed_auroc:.4f})", flush=True)

# 7. Print Final Summary Across 5 Seeds
print("\n" + "="*110)
print("           FINAL RIGOROUS BENCHMARK RESULTS (Mean +/- Std Dev across 5 Seeds)")
print("="*110)
header = f"{'Model Architecture':<36} | {'ID Acc (%)':<14} | {'ID ECE':<12} | {'Held-Out AUROC':<15} | {'Held-Out FPR@95%':<16} | {'OOD Ratio':<10}"
print(header)
print("-" * len(header))

for m_name in models_to_test:
    res = seed_results[m_name]
    acc_str = f"{np.mean(res['acc']):.2f} +/- {np.std(res['acc']):.2f}"
    ece_str = f"{np.mean(res['ece']):.4f} +/- {np.std(res['ece']):.4f}"
    auroc_str = f"{np.mean(res['heldout_auroc']):.4f} +/- {np.std(res['heldout_auroc']):.4f}"
    fpr_str = f"{np.mean(res['heldout_fpr']):.2f} +/- {np.std(res['heldout_fpr']):.2f}%"
    ratio_str = f"{np.mean(res['heldout_ratio']):.2f}x +/- {np.std(res['heldout_ratio']):.2f}x"
    print(f"{m_name:<36} | {acc_str:<14} | {ece_str:<12} | {auroc_str:<15} | {fpr_str:<16} | {ratio_str:<10}")

print("\n" + "="*110)
print("             EXPOSED VS HELD-OUT GENERALIZATION GAP (AUROC Comparison)")
print("="*110)
print(f"{'Model Architecture':<36} | {'Exposed OOD AUROC':<20} | {'Held-Out OOD AUROC':<20} | {'Generalization Delta':<20}")
print("-" * 100)
for m_name in models_to_test:
    res = seed_results[m_name]
    exp_auc = np.mean(res['exposed_auroc'])
    held_auc = np.mean(res['heldout_auroc'])
    delta = held_auc - exp_auc
    print(f"{m_name:<36} | {exp_auc:.4f} +/- {np.std(res['exposed_auroc']):.4f}      | {held_auc:.4f} +/- {np.std(res['heldout_auroc']):.4f}       | {delta:+.4f}")

