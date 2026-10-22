"""
Full 5-Fold Cross-Validation and 6-Point Ablation Ladder Evaluation for Email-EDL.
Mirror of URL-EDL Protocol (backend/evaluate_url_edl.py) and Quish-EDL (backend/evaluate_quishing_research.py).
Evaluates E1 through E6 on Enron + Nazario (10,000 balanced emails).
"""

import os
import sys
import json
import time
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score, brier_score_loss
import scipy.stats as stats
import tensorflow as tf

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from email_edl import (
    extract_email_tabular_features,
    tokenize_email_body,
    compute_ece,
    create_edl_loss,
    create_edl_oe_loss_annealed,
    EpochTracker,
    build_email_models,
    generate_synthetic_email_ood,
    MAX_BODY_LEN, TABULAR_DIM, NUM_CLASSES
)

CACHE_RAW = os.path.join(CURRENT_DIR, "email_data_cache_10000.npz")
CACHE_FEATS = os.path.join(CURRENT_DIR, "email_features_10000.npz")
RESULTS_JSON = os.path.join(CURRENT_DIR, "email_research_results.json")
WEIGHTS_PATH = os.path.join(CURRENT_DIR, "email_edl_weights.weights.h5")


def load_or_extract_features():
    if os.path.exists(CACHE_FEATS):
        print(f"Loading precomputed features from {CACHE_FEATS}...")
        d = np.load(CACHE_FEATS)
        return d["X_seq"], d["X_tab"], d["y"], d["X_seq_ood"], d["X_tab_ood"]

    print(f"Loading raw emails from {CACHE_RAW}...")
    raw = np.load(CACHE_RAW, allow_pickle=True)
    subjects = raw["subjects"]
    bodies = raw["bodies"]
    senders = raw["senders"]
    y = raw["labels"].astype(np.int32)

    print("Extracting ID tabular features and character sequences...")
    X_tab = extract_email_tabular_features(subjects, bodies, senders)
    X_seq = tokenize_email_body(bodies, max_len=MAX_BODY_LEN)

    print("Generating OOD zero-day set (BEC, Cloud PaaS, QR emails)...")
    ood_sub, ood_body, ood_snd = generate_synthetic_email_ood(num_samples=500)
    X_tab_ood = extract_email_tabular_features(ood_sub, ood_body, ood_snd)
    X_seq_ood = tokenize_email_body(ood_body, max_len=MAX_BODY_LEN)

    np.savez_compressed(
        CACHE_FEATS,
        X_seq=X_seq,
        X_tab=X_tab,
        y=y,
        X_seq_ood=X_seq_ood,
        X_tab_ood=X_tab_ood
    )
    print(f"Cached all features to {CACHE_FEATS}!")
    return X_seq, X_tab, y, X_seq_ood, X_tab_ood


def run_email_research_ablation():
    print("=" * 80)
    print("RUNNING EMAIL-EDL 5-FOLD ABLATION LADDER (E1 -> E6)")
    print("=" * 80)

    X_seq, X_tab, y, X_seq_ood, X_tab_ood = load_or_extract_features()
    N = len(y)
    print(f"Loaded dataset: {N} samples (Safe: {np.sum(y == 0)}, Phishing: {np.sum(y == 1)})")
    print(f"OOD evaluation set: {len(X_seq_ood)} samples")

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    models_list = ["E1_Tabular_RF", "E2_Text_Softmax", "E3_Early_Fusion_Softmax",
                   "E4_Email_EDL_Vanilla", "E5_Email_EDL_OE", "E6_Email_EDL_Cosine"]

    results = {m: {
        "accuracy": [], "f1": [], "auc": [], "brier": [], "ece": [],
        "u_id_mean": [], "u_ood_mean": [], "u_ood_ratio": [],
        "ood_det_rate": [], "S_id_mean": [], "S_ood_mean": []
    } for m in models_list}

    best_e6_f1 = -1.0
    TOTAL_EPOCHS = 8
    BATCH_SIZE = 64

    for fold, (train_idx, test_idx) in enumerate(skf.split(X_seq, y)):
        print(f"\n--- FOLD {fold + 1} / 5 ---")

        # 1. StandardScaler STRICTLY fit on train fold
        scaler = StandardScaler()
        X_tab_train_scaled = scaler.fit_transform(X_tab[train_idx])
        X_tab_test_scaled = scaler.transform(X_tab[test_idx])
        X_tab_ood_scaled = scaler.transform(X_tab_ood)

        X_seq_train = X_seq[train_idx]
        y_train = y[train_idx]

        X_seq_test = X_seq[test_idx]
        y_test = y[test_idx]

        # ---------------------------------------------------------
        # E1: Random Forest on Tabular Features
        # ---------------------------------------------------------
        rf = RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42 + fold, n_jobs=-1)
        rf.fit(X_tab_train_scaled, y_train)
        rf_probs = rf.predict_proba(X_tab_test_scaled)
        rf_preds = np.argmax(rf_probs, axis=1)

        acc_e1 = accuracy_score(y_test, rf_preds)
        f1_e1 = f1_score(y_test, rf_preds)
        auc_e1 = roc_auc_score(y_test, rf_probs[:, 1])
        brier_e1 = brier_score_loss(y_test, rf_probs[:, 1])
        ece_e1 = compute_ece(rf_probs, y_test)

        results["E1_Tabular_RF"]["accuracy"].append(acc_e1)
        results["E1_Tabular_RF"]["f1"].append(f1_e1)
        results["E1_Tabular_RF"]["auc"].append(auc_e1)
        results["E1_Tabular_RF"]["brier"].append(brier_e1)
        results["E1_Tabular_RF"]["ece"].append(ece_e1)
        print(f"E1 Tabular RF   - Acc: {acc_e1*100:.2f}%, F1: {f1_e1*100:.2f}%, AUC: {auc_e1:.4f}, ECE: {ece_e1:.4f}")

        # ---------------------------------------------------------
        # Build Neural Architectures E2 - E6
        # ---------------------------------------------------------
        epoch_var = tf.Variable(0.0, trainable=False, dtype=tf.float32)
        m_e2, m_e3, m_e4, m_e5, m_e6 = build_email_models(epoch_var=epoch_var, total_epochs=TOTAL_EPOCHS)

        tracker = EpochTracker(epoch_var)

        # ---------------------------------------------------------
        # E2: Text-Only Softmax
        # ---------------------------------------------------------
        m_e2.fit(X_seq_train, y_train, epochs=TOTAL_EPOCHS, batch_size=BATCH_SIZE,
                 verbose=0, callbacks=[tracker])
        e2_probs = m_e2.predict(X_seq_test, verbose=0)
        e2_preds = np.argmax(e2_probs, axis=1)

        acc_e2 = accuracy_score(y_test, e2_preds)
        f1_e2 = f1_score(y_test, e2_preds)
        auc_e2 = roc_auc_score(y_test, e2_probs[:, 1])
        brier_e2 = brier_score_loss(y_test, e2_probs[:, 1])
        ece_e2 = compute_ece(e2_probs, y_test)

        results["E2_Text_Softmax"]["accuracy"].append(acc_e2)
        results["E2_Text_Softmax"]["f1"].append(f1_e2)
        results["E2_Text_Softmax"]["auc"].append(auc_e2)
        results["E2_Text_Softmax"]["brier"].append(brier_e2)
        results["E2_Text_Softmax"]["ece"].append(ece_e2)
        print(f"E2 Text Softmax - Acc: {acc_e2*100:.2f}%, F1: {f1_e2*100:.2f}%, AUC: {auc_e2:.4f}, ECE: {ece_e2:.4f}")

        # ---------------------------------------------------------
        # E3: Early Fusion Softmax
        # ---------------------------------------------------------
        epoch_var.assign(0.0)
        m_e3.fit([X_seq_train, X_tab_train_scaled], y_train,
                 epochs=TOTAL_EPOCHS, batch_size=BATCH_SIZE, verbose=0, callbacks=[tracker])
        e3_probs = m_e3.predict([X_seq_test, X_tab_test_scaled], verbose=0)
        e3_preds = np.argmax(e3_probs, axis=1)

        acc_e3 = accuracy_score(y_test, e3_preds)
        f1_e3 = f1_score(y_test, e3_preds)
        auc_e3 = roc_auc_score(y_test, e3_probs[:, 1])
        brier_e3 = brier_score_loss(y_test, e3_probs[:, 1])
        ece_e3 = compute_ece(e3_probs, y_test)

        results["E3_Early_Fusion_Softmax"]["accuracy"].append(acc_e3)
        results["E3_Early_Fusion_Softmax"]["f1"].append(f1_e3)
        results["E3_Early_Fusion_Softmax"]["auc"].append(auc_e3)
        results["E3_Early_Fusion_Softmax"]["brier"].append(brier_e3)
        results["E3_Early_Fusion_Softmax"]["ece"].append(ece_e3)
        print(f"E3 Early Fusion - Acc: {acc_e3*100:.2f}%, F1: {f1_e3*100:.2f}%, AUC: {auc_e3:.4f}, ECE: {ece_e3:.4f}")

        # ---------------------------------------------------------
        # E4: Vanilla EDL (ReLU Head, Sensoy Loss)
        # ---------------------------------------------------------
        epoch_var.assign(0.0)
        m_e4.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=2e-4, clipnorm=1.0),
                     loss=create_edl_loss(epoch_var, total_epochs=TOTAL_EPOCHS))
        m_e4.fit([X_seq_train, X_tab_train_scaled], y_train,
                 epochs=TOTAL_EPOCHS, batch_size=BATCH_SIZE, verbose=0, callbacks=[tracker])

        alpha_id_e4 = m_e4.predict([X_seq_test, X_tab_test_scaled], verbose=0)
        S_id_e4 = np.sum(alpha_id_e4, axis=-1)
        p_id_e4 = alpha_id_e4 / np.expand_dims(S_id_e4, -1)
        u_id_e4 = NUM_CLASSES / S_id_e4

        alpha_ood_e4 = m_e4.predict([X_seq_ood, X_tab_ood_scaled], verbose=0)
        S_ood_e4 = np.sum(alpha_ood_e4, axis=-1)
        u_ood_e4 = NUM_CLASSES / S_ood_e4

        e4_preds = np.argmax(p_id_e4, axis=1)
        acc_e4 = accuracy_score(y_test, e4_preds)
        f1_e4 = f1_score(y_test, e4_preds)
        auc_e4 = roc_auc_score(y_test, p_id_e4[:, 1])
        brier_e4 = brier_score_loss(y_test, p_id_e4[:, 1])
        ece_e4 = compute_ece(p_id_e4, y_test)

        u_id_mean_e4 = float(np.mean(u_id_e4))
        u_ood_mean_e4 = float(np.mean(u_ood_e4))
        ratio_e4 = u_ood_mean_e4 / max(1e-6, u_id_mean_e4)
        p95_id_e4 = np.percentile(u_id_e4, 95)
        det_rate_e4 = float(np.mean(u_ood_e4 > p95_id_e4)) * 100.0

        results["E4_Email_EDL_Vanilla"]["accuracy"].append(acc_e4)
        results["E4_Email_EDL_Vanilla"]["f1"].append(f1_e4)
        results["E4_Email_EDL_Vanilla"]["auc"].append(auc_e4)
        results["E4_Email_EDL_Vanilla"]["brier"].append(brier_e4)
        results["E4_Email_EDL_Vanilla"]["ece"].append(ece_e4)
        results["E4_Email_EDL_Vanilla"]["u_id_mean"].append(u_id_mean_e4)
        results["E4_Email_EDL_Vanilla"]["u_ood_mean"].append(u_ood_mean_e4)
        results["E4_Email_EDL_Vanilla"]["u_ood_ratio"].append(ratio_e4)
        results["E4_Email_EDL_Vanilla"]["ood_det_rate"].append(det_rate_e4)
        results["E4_Email_EDL_Vanilla"]["S_id_mean"].append(float(np.mean(S_id_e4)))
        results["E4_Email_EDL_Vanilla"]["S_ood_mean"].append(float(np.mean(S_ood_e4)))

        print(f"E4 Vanilla EDL  - Acc: {acc_e4*100:.2f}%, F1: {f1_e4*100:.2f}%, ECE: {ece_e4:.4f}, "
              f"u_ID: {u_id_mean_e4:.4f}, u_OOD: {u_ood_mean_e4:.4f}, Ratio: {ratio_e4:.3f}x")

        # ---------------------------------------------------------
        # Prepare OE Training Data for E5 & E6 (5% OOD fraction)
        # ---------------------------------------------------------
        num_oe = int(len(X_seq_train) * 0.05)
        oe_idx = np.random.choice(len(X_seq_ood), size=num_oe, replace=True)

        X_seq_oe_train = np.concatenate([X_seq_train, X_seq_ood[oe_idx]], axis=0)
        X_tab_oe_train = np.concatenate([X_tab_train_scaled, X_tab_ood_scaled[oe_idx]], axis=0)
        y_oe_train = np.concatenate([y_train, np.full(num_oe, -1, dtype=np.int32)], axis=0)

        perm = np.random.permutation(len(y_oe_train))
        X_seq_oe_train = X_seq_oe_train[perm]
        X_tab_oe_train = X_tab_oe_train[perm]
        y_oe_train = y_oe_train[perm]

        # ---------------------------------------------------------
        # E5: Vanilla EDL + OE
        # ---------------------------------------------------------
        epoch_var.assign(0.0)
        m_e5.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=2e-4, clipnorm=1.0),
                     loss=create_edl_oe_loss_annealed(epoch_var, total_epochs=TOTAL_EPOCHS, ood_weight=0.03))
        m_e5.fit([X_seq_oe_train, X_tab_oe_train], y_oe_train,
                 epochs=TOTAL_EPOCHS, batch_size=BATCH_SIZE, verbose=0, callbacks=[tracker])

        alpha_id_e5 = m_e5.predict([X_seq_test, X_tab_test_scaled], verbose=0)
        S_id_e5 = np.sum(alpha_id_e5, axis=-1)
        p_id_e5 = alpha_id_e5 / np.expand_dims(S_id_e5, -1)
        u_id_e5 = NUM_CLASSES / S_id_e5

        alpha_ood_e5 = m_e5.predict([X_seq_ood, X_tab_ood_scaled], verbose=0)
        S_ood_e5 = np.sum(alpha_ood_e5, axis=-1)
        u_ood_e5 = NUM_CLASSES / S_ood_e5

        e5_preds = np.argmax(p_id_e5, axis=1)
        acc_e5 = accuracy_score(y_test, e5_preds)
        f1_e5 = f1_score(y_test, e5_preds)
        auc_e5 = roc_auc_score(y_test, p_id_e5[:, 1])
        brier_e5 = brier_score_loss(y_test, p_id_e5[:, 1])
        ece_e5 = compute_ece(p_id_e5, y_test)

        u_id_mean_e5 = float(np.mean(u_id_e5))
        u_ood_mean_e5 = float(np.mean(u_ood_e5))
        ratio_e5 = u_ood_mean_e5 / max(1e-6, u_id_mean_e5)
        p95_id_e5 = np.percentile(u_id_e5, 95)
        det_rate_e5 = float(np.mean(u_ood_e5 > p95_id_e5)) * 100.0

        results["E5_Email_EDL_OE"]["accuracy"].append(acc_e5)
        results["E5_Email_EDL_OE"]["f1"].append(f1_e5)
        results["E5_Email_EDL_OE"]["auc"].append(auc_e5)
        results["E5_Email_EDL_OE"]["brier"].append(brier_e5)
        results["E5_Email_EDL_OE"]["ece"].append(ece_e5)
        results["E5_Email_EDL_OE"]["u_id_mean"].append(u_id_mean_e5)
        results["E5_Email_EDL_OE"]["u_ood_mean"].append(u_ood_mean_e5)
        results["E5_Email_EDL_OE"]["u_ood_ratio"].append(ratio_e5)
        results["E5_Email_EDL_OE"]["ood_det_rate"].append(det_rate_e5)
        results["E5_Email_EDL_OE"]["S_id_mean"].append(float(np.mean(S_id_e5)))
        results["E5_Email_EDL_OE"]["S_ood_mean"].append(float(np.mean(S_ood_e5)))

        print(f"E5 EDL + OE     - Acc: {acc_e5*100:.2f}%, F1: {f1_e5*100:.2f}%, ECE: {ece_e5:.4f}, "
              f"u_ID: {u_id_mean_e5:.4f}, u_OOD: {u_ood_mean_e5:.4f}, Ratio: {ratio_e5:.3f}x")

        # ---------------------------------------------------------
        # E6: PhishShield-EDL (Cosine Evidence Head + OE)
        # ---------------------------------------------------------
        epoch_var.assign(0.0)
        m_e6.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=2e-4, clipnorm=1.0),
                     loss=create_edl_oe_loss_annealed(epoch_var, total_epochs=TOTAL_EPOCHS, ood_weight=0.03))
        m_e6.fit([X_seq_oe_train, X_tab_oe_train], y_oe_train,
                 epochs=TOTAL_EPOCHS, batch_size=BATCH_SIZE, verbose=0, callbacks=[tracker])

        alpha_id_e6 = m_e6.predict([X_seq_test, X_tab_test_scaled], verbose=0)
        S_id_e6 = np.sum(alpha_id_e6, axis=-1)
        p_id_e6 = alpha_id_e6 / np.expand_dims(S_id_e6, -1)
        u_id_e6 = NUM_CLASSES / S_id_e6

        alpha_ood_e6 = m_e6.predict([X_seq_ood, X_tab_ood_scaled], verbose=0)
        S_ood_e6 = np.sum(alpha_ood_e6, axis=-1)
        u_ood_e6 = NUM_CLASSES / S_ood_e6

        e6_preds = np.argmax(p_id_e6, axis=1)
        acc_e6 = accuracy_score(y_test, e6_preds)
        f1_e6 = f1_score(y_test, e6_preds)
        auc_e6 = roc_auc_score(y_test, p_id_e6[:, 1])
        brier_e6 = brier_score_loss(y_test, p_id_e6[:, 1])
        ece_e6 = compute_ece(p_id_e6, y_test)

        u_id_mean_e6 = float(np.mean(u_id_e6))
        u_ood_mean_e6 = float(np.mean(u_ood_e6))
        ratio_e6 = u_ood_mean_e6 / max(1e-6, u_id_mean_e6)
        p95_id_e6 = np.percentile(u_id_e6, 95)
        det_rate_e6 = float(np.mean(u_ood_e6 > p95_id_e6)) * 100.0

        results["E6_Email_EDL_Cosine"]["accuracy"].append(acc_e6)
        results["E6_Email_EDL_Cosine"]["f1"].append(f1_e6)
        results["E6_Email_EDL_Cosine"]["auc"].append(auc_e6)
        results["E6_Email_EDL_Cosine"]["brier"].append(brier_e6)
        results["E6_Email_EDL_Cosine"]["ece"].append(ece_e6)
        results["E6_Email_EDL_Cosine"]["u_id_mean"].append(u_id_mean_e6)
        results["E6_Email_EDL_Cosine"]["u_ood_mean"].append(u_ood_mean_e6)
        results["E6_Email_EDL_Cosine"]["u_ood_ratio"].append(ratio_e6)
        results["E6_Email_EDL_Cosine"]["ood_det_rate"].append(det_rate_e6)
        results["E6_Email_EDL_Cosine"]["S_id_mean"].append(float(np.mean(S_id_e6)))
        results["E6_Email_EDL_Cosine"]["S_ood_mean"].append(float(np.mean(S_ood_e6)))

        print(f"E6 Cosine + OE  - Acc: {acc_e6*100:.2f}%, F1: {f1_e6*100:.2f}%, ECE: {ece_e6:.4f}, "
              f"u_ID: {u_id_mean_e6:.4f}, u_OOD: {u_ood_mean_e6:.4f}, Ratio: {ratio_e6:.3f}x")

        if f1_e6 > best_e6_f1:
            best_e6_f1 = f1_e6
            m_e6.save_weights(WEIGHTS_PATH)
            print(f"--> Saved best E6 model weights to {WEIGHTS_PATH}")

    # ---------------------------------------------------------
    # Statistical Significance Testing (Paired t-tests)
    # ---------------------------------------------------------
    print("\n" + "=" * 80)
    print("STATISTICAL SIGNIFICANCE & SUMMARY")
    print("=" * 80)

    summary = {}
    for m in models_list:
        summary[m] = {
            metric: {
                "mean": float(np.mean(results[m][metric])) if len(results[m][metric]) > 0 else None,
                "std": float(np.std(results[m][metric])) if len(results[m][metric]) > 0 else None,
                "values": results[m][metric]
            }
            for metric in results[m]
        }

    # Hypothesis testing
    # E1 vs E4
    t_stat_1_4, p_val_1_4 = stats.ttest_rel(results["E1_Tabular_RF"]["accuracy"], results["E4_Email_EDL_Vanilla"]["accuracy"])
    # E3 vs E4
    t_stat_3_4, p_val_3_4 = stats.ttest_rel(results["E3_Early_Fusion_Softmax"]["accuracy"], results["E4_Email_EDL_Vanilla"]["accuracy"])
    # E4 vs E6
    t_stat_4_6, p_val_4_6 = stats.ttest_rel(results["E4_Email_EDL_Vanilla"]["accuracy"], results["E6_Email_EDL_Cosine"]["accuracy"])

    significance = {
        "E1_vs_E4_accuracy": {"t_stat": float(t_stat_1_4), "p_val": float(p_val_1_4)},
        "E3_vs_E4_accuracy": {"t_stat": float(t_stat_3_4), "p_val": float(p_val_3_4)},
        "E4_vs_E6_accuracy": {"t_stat": float(t_stat_4_6), "p_val": float(p_val_4_6)}
    }

    output = {
        "dataset": "Enron + Nazario (10,000 balanced emails)",
        "protocol": "5-Fold Stratified Cross-Validation (8 epochs, lr=2e-4, clipnorm=1.0)",
        "summary": summary,
        "significance": significance
    }

    with open(RESULTS_JSON, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"Results successfully saved to {RESULTS_JSON}!")
    for m in models_list:
        acc_m = summary[m]["accuracy"]["mean"] * 100.0
        acc_s = summary[m]["accuracy"]["std"] * 100.0
        f1_m = summary[m]["f1"]["mean"] * 100.0
        ece_m = summary[m]["ece"]["mean"]
        ratio_str = f", Ratio: {summary[m]['u_ood_ratio']['mean']:.3f}x" if summary[m]["u_ood_ratio"]["mean"] is not None else ""
        print(f"{m:25s} | Acc: {acc_m:.2f} +/- {acc_s:.2f}% | F1: {f1_m:.2f}% | ECE: {ece_m:.4f}{ratio_str}")


if __name__ == "__main__":
    run_email_research_ablation()
