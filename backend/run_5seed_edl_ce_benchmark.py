"""
Comprehensive 5-Seed Leave-Families-Out (LFO) Benchmark:
Comparing Softmax Baseline (MSP/Entropy/Energy), Softmax + OE, and Quish-EDL with Cross-Entropy Bayes Risk Loss
under strict encoder parity across 5 independent seeds.
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

IMG_SHAPE = (96, 96, 1)  # V2 dataset resolution
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

def create_edl_ce_loss(epoch_var, ood_weight=0.10):
    def loss_fn(y_true, alpha):
        y_flat = tf.reshape(y_true, [-1])
        is_id = tf.cast(y_flat >= 0, tf.float32)
        is_ood = 1.0 - is_id
        
        y_safe = tf.maximum(0, tf.cast(y_flat, tf.int32))
        y_one_hot = tf.one_hot(y_safe, depth=NUM_CLASSES)
        
        alpha_c = tf.clip_by_value(alpha, 1.0, 1e4)
        S = tf.reduce_sum(alpha_c, axis=-1, keepdims=True)
        
        psi_S = tf.math.digamma(S)
        psi_alpha = tf.math.digamma(alpha_c)
        loss_ce = tf.reduce_sum(y_one_hot * (psi_S - psi_alpha), axis=-1, keepdims=True)
        
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

class EpochTracker(tf.keras.callbacks.Callback):
    def __init__(self, epoch_var):
        super().__init__()
        self.epoch_var = epoch_var
    def on_epoch_begin(self, epoch, logs=None):
        self.epoch_var.assign(float(epoch + 1))

def build_shared_backbone():
    inp_v = Input(shape=IMG_SHAPE)
    from quish_cross_edl import build_visual_backbone
    v_dense = build_visual_backbone(inp_v)

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

SEEDS = [42, 123, 456, 789, 1024]
models = [
    "M3 Softmax Baseline (MSP)",
    "M3 Softmax Baseline (Energy)",
    "M3 + OE (Softmax + OE Entropy)",
    "M3 + OE (Softmax + OE Energy)",
    "Quish-EDL (CE Loss + Softplus, w=0.10)",
    "Quish-EDL (CE Loss + Exp-Clamped, w=0.10)"
]

metrics = {m: {"acc": [], "ece": [], "auroc": [], "fpr": [], "ratio": []} for m in models}

print("="*105)
print("     5-SEED LEAVE-FAMILIES-OUT BENCHMARK (CROSS-ENTROPY EDL & ENERGY BASELINES)")
print("="*105, flush=True)

for seed_idx, seed in enumerate(SEEDS):
    print(f"\n--- Seed {seed_idx + 1}/5 (Seed {seed}) ---", flush=True)
    tf.keras.utils.set_random_seed(seed)
    np.random.seed(seed)
    
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=seed)
    train_idx, val_idx = next(skf.split(X_imgs_id, y_id))
    
    train_v, val_v = X_imgs_id[train_idx], X_imgs_id[val_idx]
    train_s, val_s = X_seqs_id[train_idx], X_seqs_id[val_idx]
    train_y, val_y = y_id[train_idx], y_id[val_idx]
    
    n_oe = int(0.05 * len(train_y))
    oe_sample_idx = np.random.choice(len(imgs_exposed), size=n_oe, replace=True)
    oe_v = np.concatenate([train_v, imgs_exposed[oe_sample_idx]], axis=0)
    oe_s = np.concatenate([train_s, seqs_exposed[oe_sample_idx]], axis=0)
    oe_y = np.concatenate([train_y, -1 * np.ones(n_oe, dtype=np.int32)], axis=0)
    p_oe = np.random.permutation(len(oe_y))
    oe_v, oe_s, oe_y = oe_v[p_oe], oe_s[p_oe], oe_y[p_oe]
    
    # 1 & 2. M3 Softmax Baseline
    inp_v, inp_l, h = build_shared_backbone()
    logits = Dense(NUM_CLASSES)(h)
    probs = tf.keras.layers.Activation("softmax")(logits)
    m3 = Model(inputs=[inp_v, inp_l], outputs=probs)
    m3_eng = Model(inputs=[inp_v, inp_l], outputs=[probs, logits])
    m3.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001), loss="sparse_categorical_crossentropy")
    m3.fit([train_v, train_s], train_y, epochs=TOTAL_EPOCHS, batch_size=64, verbose=0)
    
    p_val, z_val = m3_eng.predict([val_v, val_s], verbose=0)
    p_held, z_held = m3_eng.predict([imgs_heldout, seqs_heldout], verbose=0)
    acc_m3 = accuracy_score(val_y, np.argmax(p_val, axis=1))
    ece_m3 = compute_ece(p_val, val_y)
    
    msp_val = 1.0 - np.max(p_val, axis=1)
    msp_held = 1.0 - np.max(p_held, axis=1)
    auc_msp, fpr_msp = compute_ood_auroc_and_fpr(msp_val, msp_held)
    ratio_msp = np.mean(msp_held) / np.mean(msp_val)
    metrics["M3 Softmax Baseline (MSP)"]["acc"].append(acc_m3*100)
    metrics["M3 Softmax Baseline (MSP)"]["ece"].append(ece_m3)
    metrics["M3 Softmax Baseline (MSP)"]["auroc"].append(auc_msp)
    metrics["M3 Softmax Baseline (MSP)"]["fpr"].append(fpr_msp*100)
    metrics["M3 Softmax Baseline (MSP)"]["ratio"].append(ratio_msp)
    
    eng_val = -np.log(np.sum(np.exp(z_val - np.max(z_val, axis=1, keepdims=True)), axis=1)) - np.max(z_val, axis=1)
    eng_held = -np.log(np.sum(np.exp(z_held - np.max(z_held, axis=1, keepdims=True)), axis=1)) - np.max(z_held, axis=1)
    auc_eng, fpr_eng = compute_ood_auroc_and_fpr(eng_val, eng_held)
    ratio_eng = np.mean(eng_held) / np.mean(eng_val)
    metrics["M3 Softmax Baseline (Energy)"]["acc"].append(acc_m3*100)
    metrics["M3 Softmax Baseline (Energy)"]["ece"].append(ece_m3)
    metrics["M3 Softmax Baseline (Energy)"]["auroc"].append(auc_eng)
    metrics["M3 Softmax Baseline (Energy)"]["fpr"].append(fpr_eng*100)
    metrics["M3 Softmax Baseline (Energy)"]["ratio"].append(ratio_eng)

    # 3 & 4. M3 + OE (Softmax + OE)
    inp_v, inp_l, h = build_shared_backbone()
    logits = Dense(NUM_CLASSES)(h)
    probs = tf.keras.layers.Activation("softmax")(logits)
    m3_oe = Model(inputs=[inp_v, inp_l], outputs=probs)
    m3_oe_eng = Model(inputs=[inp_v, inp_l], outputs=[probs, logits])
    
    def sm_loss(y_true, y_pred):
        y_flat = tf.reshape(y_true, [-1])
        is_id = tf.cast(y_flat >= 0, tf.float32)
        is_ood = 1.0 - is_id
        y_safe = tf.maximum(0, tf.cast(y_flat, tf.int32))
        y_one_hot = tf.one_hot(y_safe, depth=NUM_CLASSES)
        p = tf.clip_by_value(y_pred, 1e-7, 1.0 - 1e-7)
        ce_id = -tf.reduce_sum(y_one_hot * tf.math.log(p), axis=-1)
        kl_ood = tf.reduce_sum(p * (tf.math.log(p) - tf.math.log(0.5)), axis=-1)
        return (tf.reduce_sum(is_id * ce_id) / tf.maximum(1.0, tf.reduce_sum(is_id))) + 0.5 * (tf.reduce_sum(is_ood * kl_ood) / tf.maximum(1.0, tf.reduce_sum(is_ood)))
        
    m3_oe.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001), loss=sm_loss)
    m3_oe.fit([oe_v, oe_s], oe_y, epochs=TOTAL_EPOCHS, batch_size=64, verbose=0)
    
    p_val, z_val = m3_oe_eng.predict([val_v, val_s], verbose=0)
    p_held, z_held = m3_oe_eng.predict([imgs_heldout, seqs_heldout], verbose=0)
    acc_oe = accuracy_score(val_y, np.argmax(p_val, axis=1))
    ece_oe = compute_ece(p_val, val_y)
    
    ent_val = -np.sum(p_val * np.log(p_val + 1e-12), axis=1) / np.log(2.0)
    ent_held = -np.sum(p_held * np.log(p_held + 1e-12), axis=1) / np.log(2.0)
    auc_ent, fpr_ent = compute_ood_auroc_and_fpr(ent_val, ent_held)
    ratio_ent = np.mean(ent_held) / np.mean(ent_val)
    metrics["M3 + OE (Softmax + OE Entropy)"]["acc"].append(acc_oe*100)
    metrics["M3 + OE (Softmax + OE Entropy)"]["ece"].append(ece_oe)
    metrics["M3 + OE (Softmax + OE Entropy)"]["auroc"].append(auc_ent)
    metrics["M3 + OE (Softmax + OE Entropy)"]["fpr"].append(fpr_ent*100)
    metrics["M3 + OE (Softmax + OE Entropy)"]["ratio"].append(ratio_ent)
    
    eng_val = -np.log(np.sum(np.exp(z_val - np.max(z_val, axis=1, keepdims=True)), axis=1)) - np.max(z_val, axis=1)
    eng_held = -np.log(np.sum(np.exp(z_held - np.max(z_held, axis=1, keepdims=True)), axis=1)) - np.max(z_held, axis=1)
    auc_eng, fpr_eng = compute_ood_auroc_and_fpr(eng_val, eng_held)
    ratio_eng = np.mean(eng_held) / np.mean(eng_val)
    metrics["M3 + OE (Softmax + OE Energy)"]["acc"].append(acc_oe*100)
    metrics["M3 + OE (Softmax + OE Energy)"]["ece"].append(ece_oe)
    metrics["M3 + OE (Softmax + OE Energy)"]["auroc"].append(auc_eng)
    metrics["M3 + OE (Softmax + OE Energy)"]["fpr"].append(fpr_eng*100)
    metrics["M3 + OE (Softmax + OE Energy)"]["ratio"].append(ratio_eng)

    # 5. Quish-EDL (CE Loss + Softplus, w=0.10)
    inp_v, inp_l, h = build_shared_backbone()
    evidence = Dense(NUM_CLASSES, activation="softplus")(h)
    alpha = tf.keras.layers.Lambda(lambda e: e + 1.0)(evidence)
    m6_sp = Model(inputs=[inp_v, inp_l], outputs=alpha)
    epoch_var = tf.Variable(1.0, trainable=False, dtype=tf.float32)
    m6_sp.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001), loss=create_edl_ce_loss(epoch_var, ood_weight=0.10))
    m6_sp.fit([oe_v, oe_s], oe_y, epochs=TOTAL_EPOCHS, batch_size=64, callbacks=[EpochTracker(epoch_var)], verbose=0)
    
    alpha_val = m6_sp.predict([val_v, val_s], verbose=0)
    S_val = np.sum(alpha_val, axis=-1, keepdims=True)
    p_val = alpha_val / S_val
    u_val = 2.0 / S_val.flatten()
    
    alpha_held = m6_sp.predict([imgs_heldout, seqs_heldout], verbose=0)
    S_held = np.sum(alpha_held, axis=-1, keepdims=True)
    u_held = 2.0 / S_held.flatten()
    
    acc_sp = accuracy_score(val_y, np.argmax(p_val, axis=1))
    ece_sp = compute_ece(p_val, val_y)
    auc_sp, fpr_sp = compute_ood_auroc_and_fpr(u_val, u_held)
    ratio_sp = np.mean(u_held) / np.mean(u_val)
    metrics["Quish-EDL (CE Loss + Softplus, w=0.10)"]["acc"].append(acc_sp*100)
    metrics["Quish-EDL (CE Loss + Softplus, w=0.10)"]["ece"].append(ece_sp)
    metrics["Quish-EDL (CE Loss + Softplus, w=0.10)"]["auroc"].append(auc_sp)
    metrics["Quish-EDL (CE Loss + Softplus, w=0.10)"]["fpr"].append(fpr_sp*100)
    metrics["Quish-EDL (CE Loss + Softplus, w=0.10)"]["ratio"].append(ratio_sp)

    # 6. Quish-EDL (CE Loss + Exp-Clamped, w=0.10)
    inp_v, inp_l, h = build_shared_backbone()
    z = Dense(NUM_CLASSES)(h)
    evidence = tf.keras.layers.Lambda(lambda x: tf.exp(tf.clip_by_value(x, -6.0, 4.0)))(z)
    alpha = tf.keras.layers.Lambda(lambda e: e + 1.0)(evidence)
    m6_exp = Model(inputs=[inp_v, inp_l], outputs=alpha)
    epoch_var = tf.Variable(1.0, trainable=False, dtype=tf.float32)
    m6_exp.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001), loss=create_edl_ce_loss(epoch_var, ood_weight=0.10))
    m6_exp.fit([oe_v, oe_s], oe_y, epochs=TOTAL_EPOCHS, batch_size=64, callbacks=[EpochTracker(epoch_var)], verbose=0)
    
    alpha_val = m6_exp.predict([val_v, val_s], verbose=0)
    S_val = np.sum(alpha_val, axis=-1, keepdims=True)
    p_val = alpha_val / S_val
    u_val = 2.0 / S_val.flatten()
    
    alpha_held = m6_exp.predict([imgs_heldout, seqs_heldout], verbose=0)
    S_held = np.sum(alpha_held, axis=-1, keepdims=True)
    u_held = 2.0 / S_held.flatten()
    
    acc_exp = accuracy_score(val_y, np.argmax(p_val, axis=1))
    ece_exp = compute_ece(p_val, val_y)
    auc_exp, fpr_exp = compute_ood_auroc_and_fpr(u_val, u_held)
    ratio_exp = np.mean(u_held) / np.mean(u_val)
    metrics["Quish-EDL (CE Loss + Exp-Clamped, w=0.10)"]["acc"].append(acc_exp*100)
    metrics["Quish-EDL (CE Loss + Exp-Clamped, w=0.10)"]["ece"].append(ece_exp)
    metrics["Quish-EDL (CE Loss + Exp-Clamped, w=0.10)"]["auroc"].append(auc_exp)
    metrics["Quish-EDL (CE Loss + Exp-Clamped, w=0.10)"]["fpr"].append(fpr_exp*100)
    metrics["Quish-EDL (CE Loss + Exp-Clamped, w=0.10)"]["ratio"].append(ratio_exp)

    print(f"  [M3 Softmax MSP]     Acc={acc_m3*100:.2f}%, AUROC={auc_msp:.4f}, FPR@95={fpr_msp*100:.1f}%")
    print(f"  [M3 Softmax Energy]  Acc={acc_m3*100:.2f}%, AUROC={auc_eng:.4f}, FPR@95={fpr_eng*100:.1f}%")
    print(f"  [M3 + OE Entropy]    Acc={acc_oe*100:.2f}%, AUROC={auc_ent:.4f}, FPR@95={fpr_ent*100:.1f}%")
    print(f"  [EDL CE + Softplus]  Acc={acc_sp*100:.2f}%, AUROC={auc_sp:.4f}, FPR@95={fpr_sp*100:.1f}%, Ratio={ratio_sp:.2f}x")
    print(f"  [EDL CE + Exp-Clamp] Acc={acc_exp*100:.2f}%, AUROC={auc_exp:.4f}, FPR@95={fpr_exp*100:.1f}%, Ratio={ratio_exp:.2f}x")

print("\n" + "="*115)
print("              5-SEED AGGREGATE SUMMARY TABLE (Mean +/- Std Dev)")
print("="*115)
header = f"{'Model Architecture & OOD Scoring Function':<42} | {'ID Acc (%)':<14} | {'ID ECE':<12} | {'Held-Out AUROC':<15} | {'Held-Out FPR@95%':<16} | {'OOD Ratio':<10}"
print(header)
print("-" * len(header))

for m in models:
    res = metrics[m]
    acc_s = f"{np.mean(res['acc']):.2f} +/- {np.std(res['acc']):.2f}"
    ece_s = f"{np.mean(res['ece']):.4f} +/- {np.std(res['ece']):.4f}"
    auc_s = f"{np.mean(res['auroc']):.4f} +/- {np.std(res['auroc']):.4f}"
    fpr_s = f"{np.mean(res['fpr']):.2f} +/- {np.std(res['fpr']):.2f}%"
    rat_s = f"{np.mean(res['ratio']):.2f}x +/- {np.std(res['ratio']):.2f}x"
    print(f"{m:<42} | {acc_s:<14} | {ece_s:<12} | {auc_s:<15} | {fpr_s:<16} | {rat_s:<10}")

