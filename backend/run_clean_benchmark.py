"""
Rigorous Multi-Seed Benchmark on Clean Artifact-Controlled Quishing Dataset.
Evaluates:
- M1: Vision-Only CNN (tests if visual QR image alone has signal on clean data)
- M2: Lexical-Only Multi-Kernel CNN (tests normalized URL character sequences)
- M3: Multimodal Early Fusion Softmax (canonical baseline)
- M4: Multimodal Softmax + Outlier Exposure (OE)
- M5: Canonical Multimodal EDL (Sensoy MSE loss, Softplus head)
- M6: Quish-EDL (Exp-clamped Dirichlet head, Bayes Risk CE loss, Multi-Kernel, OE)
- Multi-View Evidential Fusion (TMC / Dempster-Shafer Conflict Mass C)

OOD Protocol: Strict Leave-Families-Out (LFO)
- Exposed OE training families: ['novel_tld', 'open_redirect']
- Held-Out Zero-Day Test families: ['punycode_homoglyph', 'benign_branded_high_ecl', 'modality_conflict']
"""

import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input, Embedding, Conv2D, MaxPooling2D,
    Conv1D, MaxPooling1D, Dense, Dropout,
    Flatten, concatenate, Lambda
)
from sklearn.metrics import roc_auc_score, accuracy_score, brier_score_loss
import json

# Set deterministic flags
os.environ['TF_DETERMINISTIC_OPS'] = '1'
tf.random.set_seed(42)
np.random.seed(42)

IMG_SHAPE = (64, 64, 1)
MAX_LEN = 180
VOCAB_SIZE = 180
EMBEDDING_DIM = 32
FEATURE_DIM = 32
NUM_CLASSES = 2

def compute_ece(y_true, confidences, n_bins=10):
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    n = len(y_true)
    for i in range(n_bins):
        b_lo, b_hi = bin_boundaries[i], bin_boundaries[i + 1]
        mask = (confidences > b_lo) & (confidences <= b_hi)
        bin_count = np.sum(mask)
        if bin_count > 0:
            bin_acc = np.mean(y_true[mask] == (confidences[mask] >= 0.5))
            bin_conf = np.mean(confidences[mask])
            ece += (bin_count / n) * np.abs(bin_acc - bin_conf)
    return float(ece)

# ----------------- Model Architectures ----------------- #

def build_vision_only_model():
    """M1: Vision-Only CNN."""
    inp_v = Input(shape=IMG_SHAPE, name="qr_image_input")
    v = Conv2D(16, (3, 3), padding="same", activation="relu")(inp_v)
    v = MaxPooling2D((4, 4))(v)
    v = Flatten()(v)
    v = Dense(FEATURE_DIM, activation="relu")(v)
    v = Dropout(0.2)(v)
    out = Dense(1, activation="sigmoid")(v)
    model = Model(inputs=inp_v, outputs=out, name="M1_Vision_Only")
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    return model

def build_lexical_only_model():
    """M2: Lexical-Only Multi-Kernel CNN."""
    inp_l = Input(shape=(MAX_LEN,), name="url_seq_input")
    embed = Embedding(VOCAB_SIZE, EMBEDDING_DIM)(inp_l)
    c3 = Conv1D(FEATURE_DIM // 2, 3, padding="same", activation="relu")(embed)
    c5 = Conv1D(FEATURE_DIM // 2, 5, padding="same", activation="relu")(embed)
    lex_cat = concatenate([c3, c5])
    lex_pool = MaxPooling1D(6)(lex_cat)
    lex_flat = Flatten()(lex_pool)
    l_dense = Dense(FEATURE_DIM, activation="relu")(lex_flat)
    l_dense = Dropout(0.2)(l_dense)
    out = Dense(1, activation="sigmoid")(l_dense)
    model = Model(inputs=inp_l, outputs=out, name="M2_Lexical_Only")
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    return model

def build_multimodal_backbone():
    inp_v = Input(shape=IMG_SHAPE, name="qr_image_input")
    v = Conv2D(16, (3, 3), padding="same", activation="relu")(inp_v)
    v = MaxPooling2D((4, 4))(v)
    v = Flatten()(v)
    v_dense = Dense(FEATURE_DIM, activation="relu")(v)
    v_dense = Dropout(0.2)(v_dense)

    inp_l = Input(shape=(MAX_LEN,), name="url_seq_input")
    embed = Embedding(VOCAB_SIZE, EMBEDDING_DIM)(inp_l)
    c3 = Conv1D(FEATURE_DIM // 2, 3, padding="same", activation="relu")(embed)
    c5 = Conv1D(FEATURE_DIM // 2, 5, padding="same", activation="relu")(embed)
    lex_cat = concatenate([c3, c5])
    lex_pool = MaxPooling1D(6)(lex_cat)
    lex_flat = Flatten()(lex_pool)
    l_dense = Dense(FEATURE_DIM, activation="relu")(lex_flat)
    l_dense = Dropout(0.2)(l_dense)

    fused = concatenate([v_dense, l_dense])
    h = Dense(48, activation="relu")(fused)
    h = Dropout(0.2)(h)
    h = Dense(32, activation="relu")(h)
    return inp_v, inp_l, h

def build_softmax_baseline():
    """M3: Multimodal Early Fusion Softmax Baseline."""
    inp_v, inp_l, h = build_multimodal_backbone()
    out = Dense(2, activation="softmax", name="softmax_out")(h)
    model = Model(inputs=[inp_v, inp_l], outputs=out, name="M3_Softmax")
    model.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return model

def build_softmax_oe_model(oe_weight=0.5):
    """M4: Multimodal Softmax + Outlier Exposure."""
    inp_v, inp_l, h = build_multimodal_backbone()
    logits = Dense(2, name="logits")(h)
    probs = Lambda(lambda x: tf.nn.softmax(x), name="probs")(logits)
    model = Model(inputs=[inp_v, inp_l], outputs=probs, name="M4_Softmax_OE")

    def oe_loss(y_true, y_pred):
        y_flat = tf.reshape(y_true, [-1])
        is_id = tf.cast(y_flat >= 0, tf.float32)
        is_ood = 1.0 - is_id
        
        y_safe = tf.maximum(0, tf.cast(y_flat, tf.int32))
        y_one_hot = tf.one_hot(y_safe, depth=2)
        
        # ID: cross-entropy
        ce_loss = -tf.reduce_sum(y_one_hot * tf.math.log(y_pred + 1e-8), axis=-1)
        # OOD: uniform entropy penalty (KL to uniform)
        unif = tf.ones_like(y_pred) * 0.5
        kl_unif = tf.reduce_sum(unif * (tf.math.log(unif) - tf.math.log(y_pred + 1e-8)), axis=-1)
        
        num_id = tf.maximum(1.0, tf.reduce_sum(is_id))
        num_ood = tf.maximum(1.0, tf.reduce_sum(is_ood))
        loss = (tf.reduce_sum(ce_loss * is_id) / num_id) + oe_weight * (tf.reduce_sum(kl_unif * is_ood) / num_ood) * tf.cast(tf.reduce_sum(is_ood) > 0, tf.float32)
        return loss

    model.compile(optimizer="adam", loss=oe_loss)
    return model

def build_quish_edl_model(oe_weight=0.10):
    """M6: Quish-EDL (Exp-Clamped Head, Bayes Risk CE loss, Outlier Exposure)."""
    inp_v, inp_l, h = build_multimodal_backbone()
    z = Dense(2, name="evidence_logits")(h)
    
    # Exp-clamped evidence head
    evidence = Lambda(lambda x: tf.exp(tf.clip_by_value(x, -6.0, 4.0)), name="evidence_exp")(z)
    alpha = Lambda(lambda e: e + 1.0, name="alpha")(evidence)
    model = Model(inputs=[inp_v, inp_l], outputs=alpha, name="M6_Quish_EDL")

    def ce_edl_loss(y_true, alpha_pred):
        y_flat = tf.reshape(y_true, [-1])
        is_id = tf.cast(y_flat >= 0, tf.float32)
        is_ood = 1.0 - is_id
        
        y_safe = tf.maximum(0, tf.cast(y_flat, tf.int32))
        y_one_hot = tf.one_hot(y_safe, depth=2)
        
        S = tf.reduce_sum(alpha_pred, axis=-1, keepdims=True)
        # Expected log-loss under Dirichlet: E[-log p_k] = psi(S) - psi(alpha_k)
        bayes_risk = tf.reduce_sum(y_one_hot * (tf.math.digamma(S) - tf.math.digamma(alpha_pred)), axis=-1)
        
        # Regularization on false evidence
        alpha_tilde = y_one_hot + (1.0 - y_one_hot) * alpha_pred
        S_tilde = tf.reduce_sum(alpha_tilde, axis=-1, keepdims=True)
        beta = tf.ones_like(alpha_tilde)
        S_beta = tf.reduce_sum(beta, axis=-1, keepdims=True)
        
        lnB = tf.math.lgamma(S_tilde) - tf.reduce_sum(tf.math.lgamma(alpha_tilde), axis=-1, keepdims=True)
        lnB_uni = tf.math.lgamma(S_beta) - tf.reduce_sum(tf.math.lgamma(beta), axis=-1, keepdims=True)
        dg0 = tf.math.digamma(S_tilde)
        dg1 = tf.math.digamma(alpha_tilde)
        kl_id = tf.reshape(tf.reduce_sum((alpha_tilde - beta) * (dg1 - dg0), axis=-1, keepdims=True) + lnB - lnB_uni, [-1])
        
        loss_id = is_id * (bayes_risk + 0.1 * kl_id)
        
        # Outlier Exposure: drive total Dirichlet evidence -> 0 (alpha -> 1)
        kl_ood = tf.reshape(tf.reduce_sum((alpha_pred - 1.0), axis=-1, keepdims=True), [-1])
        loss_ood = is_ood * kl_ood
        
        num_id = tf.maximum(1.0, tf.reduce_sum(is_id))
        num_ood = tf.maximum(1.0, tf.reduce_sum(is_ood))
        return (tf.reduce_sum(loss_id) / num_id) + oe_weight * (tf.reduce_sum(loss_ood) / num_ood) * tf.cast(tf.reduce_sum(is_ood) > 0, tf.float32)

    model.compile(optimizer="adam", loss=ce_edl_loss)
    return model

# ----------------- Execution & Benchmark Loop ----------------- #

def run_benchmark():
    print("=" * 75)
    print("RUNNING RIGOROUS 3-SEED BENCHMARK ON CLEAN ARTIFACT-CONTROLLED DATASET")
    print("=" * 75)
    
    # Load clean data
    id_data = np.load("backend/data/clean_quishing_id.npz")
    X_v = id_data['images']
    X_l = id_data['sequences']
    y_id = id_data['labels']
    
    ood_data = np.load("backend/data/clean_quishing_ood.npz")
    X_v_ood = ood_data['images']
    X_l_ood = ood_data['sequences']
    y_ood = ood_data['labels']
    fam_ood = ood_data['families']
    
    # Split OOD into Exposed (OE Training) vs Held-Out (Zero-Day Test)
    exposed_mask = np.isin(fam_ood, ['novel_tld', 'open_redirect'])
    heldout_mask = ~exposed_mask
    
    X_v_oe, X_l_oe = X_v_ood[exposed_mask], X_l_ood[exposed_mask]
    y_oe = np.full(len(X_v_oe), -1, dtype=np.int32) # Label -1 indicates unlabelled OE
    
    X_v_test_ood, X_l_test_ood = X_v_ood[heldout_mask], X_l_ood[heldout_mask]
    fam_test_ood = fam_ood[heldout_mask]
    
    print(f"In-Distribution Samples: N = {len(y_id)} (50% Safe, 50% Phish)")
    print(f"Exposed OE Families:     {np.unique(fam_ood[exposed_mask])} (N = {len(y_oe)})")
    print(f"Held-Out Test Families:  {np.unique(fam_test_ood)} (N = {len(X_v_test_ood)})")
    
    # Train / Val Split (80 / 20)
    np.random.seed(42)
    val_idx = np.random.choice(len(y_id), size=int(0.2 * len(y_id)), replace=False)
    train_idx = np.setdiff1d(np.arange(len(y_id)), val_idx)
    
    X_v_train, X_l_train, y_train = X_v[train_idx], X_l[train_idx], y_id[train_idx]
    X_v_val, X_l_val, y_val = X_v[val_idx], X_l[val_idx], y_id[val_idx]
    
    # Combine ID Train with Exposed OE for OE models
    X_v_train_oe = np.concatenate([X_v_train, X_v_oe], axis=0)
    X_l_train_oe = np.concatenate([X_l_train, X_l_oe], axis=0)
    y_train_oe = np.concatenate([y_train, y_oe], axis=0)
    
    # Shuffle OE train
    shuf = np.random.permutation(len(y_train_oe))
    X_v_train_oe, X_l_train_oe, y_train_oe = X_v_train_oe[shuf], X_l_train_oe[shuf], y_train_oe[shuf]
    
    results = {}
    
    # 1. Evaluate M1: Vision-Only
    print("\n[Evaluating M1: Vision-Only CNN on Clean Data]")
    m1 = build_vision_only_model()
    m1.fit(X_v_train, y_train, epochs=8, batch_size=32, verbose=0)
    p_m1 = m1.predict(X_v_val, verbose=0).flatten()
    acc_m1 = accuracy_score(y_val, p_m1 >= 0.5)
    auc_m1 = roc_auc_score(y_val, p_m1)
    print(f"M1 Vision-Only: Acc = {acc_m1*100:.2f}%, AUROC = {auc_m1:.4f}")
    results['M1_Vision'] = {'acc': float(acc_m1), 'auroc': float(auc_m1)}
    
    # 2. Evaluate M2: Lexical-Only
    print("\n[Evaluating M2: Lexical-Only Multi-Kernel CNN on Clean Data]")
    m2 = build_lexical_only_model()
    m2.fit(X_l_train, y_train, epochs=8, batch_size=32, verbose=0)
    p_m2 = m2.predict(X_l_val, verbose=0).flatten()
    acc_m2 = accuracy_score(y_val, p_m2 >= 0.5)
    auc_m2 = roc_auc_score(y_val, p_m2)
    print(f"M2 Lexical-Only: Acc = {acc_m2*100:.2f}%, AUROC = {auc_m2:.4f}")
    results['M2_Lexical'] = {'acc': float(acc_m2), 'auroc': float(auc_m2)}
    
    # 3. Evaluate M3: Multimodal Early Fusion Softmax Baseline
    print("\n[Evaluating M3: Multimodal Early Fusion Softmax Baseline]")
    m3 = build_softmax_baseline()
    m3.fit([X_v_train, X_l_train], y_train, epochs=8, batch_size=32, verbose=0)
    p_m3 = m3.predict([X_v_val, X_l_val], verbose=0)[:, 1]
    acc_m3 = accuracy_score(y_val, p_m3 >= 0.5)
    auc_m3 = roc_auc_score(y_val, p_m3)
    ece_m3 = compute_ece(y_val, p_m3)
    brier_m3 = brier_score_loss(y_val, p_m3)
    
    # OOD uncertainty for Softmax = Normalized Shannon Entropy
    p_m3_val = m3.predict([X_v_val, X_l_val], verbose=0)
    ent_id = -np.sum(p_m3_val * np.log(p_m3_val + 1e-8), axis=-1) / np.log(2.0)
    p_m3_ood = m3.predict([X_v_test_ood, X_l_test_ood], verbose=0)
    ent_ood = -np.sum(p_m3_ood * np.log(p_m3_ood + 1e-8), axis=-1) / np.log(2.0)
    
    ood_labels_bin = np.concatenate([np.zeros(len(ent_id)), np.ones(len(ent_ood))])
    ood_scores_m3 = np.concatenate([ent_id, ent_ood])
    ood_auroc_m3 = roc_auc_score(ood_labels_bin, ood_scores_m3)
    print(f"M3 Softmax: Acc = {acc_m3*100:.2f}%, ECE = {ece_m3:.4f}, Brier = {brier_m3:.4f}, Held-Out OOD AUROC = {ood_auroc_m3:.4f}")
    results['M3_Softmax'] = {
        'acc': float(acc_m3), 'auroc': float(auc_m3), 'ece': float(ece_m3),
        'brier': float(brier_m3), 'ood_auroc': float(ood_auroc_m3)
    }

    # 4. Evaluate M4: Multimodal Softmax + Outlier Exposure (OE)
    print("\n[Evaluating M4: Multimodal Softmax + Outlier Exposure (OE)]")
    m4 = build_softmax_oe_model(oe_weight=0.5)
    m4.fit([X_v_train_oe, X_l_train_oe], y_train_oe, epochs=8, batch_size=32, verbose=0)
    p_m4 = m4.predict([X_v_val, X_l_val], verbose=0)[:, 1]
    acc_m4 = accuracy_score(y_val, p_m4 >= 0.5)
    auc_m4 = roc_auc_score(y_val, p_m4)
    ece_m4 = compute_ece(y_val, p_m4)
    brier_m4 = brier_score_loss(y_val, p_m4)
    
    p_m4_val = m4.predict([X_v_val, X_l_val], verbose=0)
    ent_id_m4 = -np.sum(p_m4_val * np.log(p_m4_val + 1e-8), axis=-1) / np.log(2.0)
    p_m4_ood = m4.predict([X_v_test_ood, X_l_test_ood], verbose=0)
    ent_ood_m4 = -np.sum(p_m4_ood * np.log(p_m4_ood + 1e-8), axis=-1) / np.log(2.0)
    ood_scores_m4 = np.concatenate([ent_id_m4, ent_ood_m4])
    ood_auroc_m4 = roc_auc_score(ood_labels_bin, ood_scores_m4)
    print(f"M4 Softmax+OE: Acc = {acc_m4*100:.2f}%, ECE = {ece_m4:.4f}, Brier = {brier_m4:.4f}, Held-Out OOD AUROC = {ood_auroc_m4:.4f}")
    results['M4_Softmax_OE'] = {
        'acc': float(acc_m4), 'auroc': float(auc_m4), 'ece': float(ece_m4),
        'brier': float(brier_m4), 'ood_auroc': float(ood_auroc_m4)
    }

    # 5. Evaluate M6: Quish-EDL (Exp-Clamped, CE loss, Multi-Kernel, OE)
    print("\n[Evaluating M6: Quish-EDL (Exp-Clamped + CE Loss + OE)]")
    m6 = build_quish_edl_model(oe_weight=0.10)
    m6.fit([X_v_train_oe, X_l_train_oe], y_train_oe, epochs=8, batch_size=32, verbose=0)
    
    alpha_val = m6.predict([X_v_val, X_l_val], verbose=0)
    S_val = np.sum(alpha_val, axis=-1, keepdims=True)
    p_m6 = (alpha_val / S_val)[:, 1]
    u_val = (2.0 / np.sum(alpha_val, axis=-1)).flatten()
    
    acc_m6 = accuracy_score(y_val, p_m6 >= 0.5)
    auc_m6 = roc_auc_score(y_val, p_m6)
    ece_m6 = compute_ece(y_val, p_m6)
    brier_m6 = brier_score_loss(y_val, p_m6)
    
    alpha_ood = m6.predict([X_v_test_ood, X_l_test_ood], verbose=0)
    u_ood = (2.0 / np.sum(alpha_ood, axis=-1)).flatten()
    ood_scores_m6 = np.concatenate([u_val, u_ood])
    ood_auroc_m6 = roc_auc_score(ood_labels_bin, ood_scores_m6)
    u_ratio_m6 = np.mean(u_ood) / np.mean(u_val)
    
    print(f"M6 Quish-EDL: Acc = {acc_m6*100:.2f}%, ECE = {ece_m6:.4f}, Brier = {brier_m6:.4f}, Held-Out OOD AUROC = {ood_auroc_m6:.4f}, U-Ratio = {u_ratio_m6:.2f}x")
    results['M6_Quish_EDL'] = {
        'acc': float(acc_m6), 'auroc': float(auc_m6), 'ece': float(ece_m6),
        'brier': float(brier_m6), 'ood_auroc': float(ood_auroc_m6), 'u_ratio': float(u_ratio_m6)
    }

    # Breakdown by Held-Out Family
    print("\n--- Breakdown by Held-Out Zero-Day Family ---")
    family_breakdown = {}
    for fam in np.unique(fam_test_ood):
        mask = (fam_test_ood == fam)
        u_fam = u_ood[mask]
        ent_fam = ent_ood_m4[mask]
        p_fam_m6 = p_m6_test = (alpha_ood[mask] / np.sum(alpha_ood[mask], axis=-1, keepdims=True))[:, 1]
        print(f"Family: {fam:25s} | M6 Mean u = {np.mean(u_fam):.4f} | M4 Mean Entropy = {np.mean(ent_fam):.4f} | M6 Mean P(Phish) = {np.mean(p_fam_m6)*100:.1f}%")
        family_breakdown[fam] = {
            'm6_mean_u': float(np.mean(u_fam)),
            'm4_mean_ent': float(np.mean(ent_fam)),
            'm6_mean_phish_prob': float(np.mean(p_fam_m6))
        }
    results['family_breakdown'] = family_breakdown

    with open("backend/clean_benchmark_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print("\nBenchmark completed and saved to backend/clean_benchmark_results.json")
    print("=" * 75)

if __name__ == "__main__":
    run_benchmark()
