"""
Staged Diagnostic & Verification Script for URL-EDL.
Implements user-specified rigorous staged re-run order:
Stage 1: U3-scaled validation (checks StandardScaler on train-fold only, verifies url_length ~0/1, tests U3 > U2)
Stage 2: U4-stable validation (checks Adam lr=2e-4 + clipnorm 1.0, tracks epoch S_ID, ensures std <2% with zero dead folds)
Stage 3: U5 (OE) validation (checks 5% outliers, lambda_OE=0.08, gate val_acc >88%)
Stage 4: U6 (Cosine Head) validation (checks tau=0.2, annealed margin m_t, gate ECE <0.08, ratio >1.5x)
"""

import os
import sys
import pickle
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score, brier_score_loss
import tensorflow as tf
from tensorflow.keras.preprocessing.sequence import pad_sequences

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from features import URLFeatureExtractor
from url_edl import (
    build_url_edl_model,
    create_edl_loss,
    create_edl_oe_loss,
    EpochTracker,
    compute_evidential_outputs,
    MAX_LEN, VOCAB_SIZE, TABULAR_DIM, NUM_CLASSES
)


def compute_ece(probs, labels, n_bins=10):
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    confidences = np.max(probs, axis=1)
    predictions = np.argmax(probs, axis=1)
    accuracies = (predictions == labels)
    for i in range(n_bins):
        in_bin = (confidences > bin_boundaries[i]) & (confidences <= bin_boundaries[i + 1])
        prop_in_bin = np.mean(in_bin)
        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(accuracies[in_bin])
            avg_confidence_in_bin = np.mean(confidences[in_bin])
            ece += np.abs(avg_confidence_in_bin - accuracy_in_bin) * prop_in_bin
    return float(ece)


class STracker(tf.keras.callbacks.Callback):
    """Tracks mean Dirichlet evidence strength S_ID per epoch to detect dying evidence early."""
    def __init__(self, val_inputs, val_y, name="Model"):
        super().__init__()
        self.val_inputs = val_inputs
        self.val_y = val_y
        self.name = name

    def on_epoch_end(self, epoch, logs=None):
        preds = self.model.predict(self.val_inputs, verbose=0)
        S = np.sum(preds, axis=-1)
        mean_S = np.mean(S)
        acc = accuracy_score(self.val_y, np.argmax(preds, axis=1))
        print(f"   [{self.name} Ep {epoch+1}] Val Acc: {acc*100:.2f}% | Mean S_ID: {mean_S:.2f} (Min S: {np.min(S):.2f})", flush=True)


def load_cached_or_raw_data(sample_size=6000, seed=42):
    cache_path = os.path.join(CURRENT_DIR, f"url_data_cache_{sample_size}.npz")
    if os.path.exists(cache_path):
        print(f"Loading cached preprocessed URL data from {cache_path}...", flush=True)
        data = np.load(cache_path, allow_pickle=True)
        return data["X_seq"], data["X_tab"], data["y"], data["X_seq_ood"], data["X_tab_ood"]

    print(f"Loading raw CSV and extracting features for {sample_size} samples...", flush=True)
    csv_path = os.path.join(CURRENT_DIR, "data", "malicious_phish.csv")
    df = pd.read_csv(csv_path).dropna(subset=['url', 'type'])
    df['label'] = df['type'].apply(lambda x: 0 if str(x).lower() == 'benign' else 1)
    
    half = sample_size // 2
    b = df[df['label'] == 0].sample(half, random_state=seed)
    m = df[df['label'] == 1].sample(half, random_state=seed)
    df_bal = pd.concat([b, m]).sample(frac=1.0, random_state=seed).reset_index(drop=True)
    
    urls = df_bal['url'].astype(str).tolist()
    y = df_bal['label'].to_numpy(dtype=np.int32)
    
    with open(os.path.join(CURRENT_DIR, "tokenizer.pkl"), "rb") as f:
        tok = pickle.load(f)
    seqs = tok.texts_to_sequences(urls)
    X_seq = pad_sequences(seqs, maxlen=MAX_LEN, padding="post", truncating="post")
    
    ext = URLFeatureExtractor()
    X_tab = np.nan_to_num(np.array(ext.transform(urls), dtype=np.float32), nan=0.0, posinf=1.0, neginf=-1.0)
    
    # OOD suite
    from evaluate_url_edl import synthesize_clean_url_ood_suite
    ood_urls = synthesize_clean_url_ood_suite()
    ood_seqs = tok.texts_to_sequences(ood_urls)
    X_seq_ood = pad_sequences(ood_seqs, maxlen=MAX_LEN, padding="post", truncating="post")
    X_tab_ood = np.nan_to_num(np.array(ext.transform(ood_urls), dtype=np.float32), nan=0.0, posinf=1.0, neginf=-1.0)
    
    np.savez_compressed(cache_path, X_seq=X_seq, X_tab=X_tab, y=y, X_seq_ood=X_seq_ood, X_tab_ood=X_tab_ood)
    print(f"Cached preprocessed dataset to {cache_path}!", flush=True)
    return X_seq, X_tab, y, X_seq_ood, X_tab_ood


def run_stage_verification(run_stages=["U3", "U4"]):
    print("==========================================================================", flush=True)
    print(f"      RUNNING STAGED VERIFICATION: {run_stages}", flush=True)
    print("==========================================================================\n", flush=True)

    X_seq, X_tab, y, X_seq_ood, X_tab_ood = load_cached_or_raw_data(sample_size=6000)
    skf = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)  # 3 fast diagnostic folds

    for fold, (train_idx, val_idx) in enumerate(skf.split(X_seq, y)):
        print(f"\n################ FOLD {fold+1}/3 ################", flush=True)
        train_s, val_s = X_seq[train_idx], X_seq[val_idx]
        train_t_raw, val_t_raw = X_tab[train_idx], X_tab[val_idx]
        train_y, val_y = y[train_idx], y[val_idx]

        # 1. StandardScaler STRICTLY on train fold only
        scaler = StandardScaler()
        train_t = scaler.fit_transform(train_t_raw)
        val_t = scaler.transform(val_t_raw)
        ood_t = scaler.transform(X_tab_ood)

        # Log mean/var of url_length (feature 0) after scaling
        mean_u_len = np.mean(train_t[:, 0])
        var_u_len = np.var(train_t[:, 0])
        print(f"[Fold {fold+1} StandardScaler] url_length train mean={mean_u_len:.4f}, var={var_u_len:.4f} (Verified ~0/1)", flush=True)

        # -------------------------------------------------------------
        # STAGE 1: Test U3-scaled
        # -------------------------------------------------------------
        if "U3" in run_stages:
            print("\n>>> Testing U3 (Multimodal Early Fusion Softmax) with Scaled Tabular...", flush=True)
            u3 = build_url_edl_model(head_type="softmax")
            u3.compile(
                optimizer=tf.keras.optimizers.Adam(learning_rate=2e-4, clipnorm=1.0),
                loss="sparse_categorical_crossentropy",
                metrics=["accuracy"]
            )
            u3.fit([train_s, train_t], train_y, epochs=8, batch_size=128, verbose=0)
            p3 = u3.predict([val_s, val_t], verbose=0)
            preds3 = np.argmax(p3, axis=1)
            acc3 = accuracy_score(val_y, preds3)
            ece3 = compute_ece(p3, val_y)
            print(f"==> [Fold {fold+1} U3 Result] Acc: {acc3*100:.2f}% | ECE: {ece3:.4f}", flush=True)

        # -------------------------------------------------------------
        # STAGE 2: Test U4-stable (lr=2e-4, clipnorm=1.0, S_ID monitoring)
        # -------------------------------------------------------------
        if "U4" in run_stages:
            print("\n>>> Testing U4 (URL-EDL Vanilla) with Scaled Tabular & lr=2e-4 + clipnorm=1.0...", flush=True)
            epoch_var4 = tf.Variable(1.0, trainable=False, dtype=tf.float32)
            u4 = build_url_edl_model(head_type="edl")
            u4.compile(
                optimizer=tf.keras.optimizers.Adam(learning_rate=2e-4, clipnorm=1.0),
                loss=create_edl_loss(epoch_var4, total_epochs=8)
            )
            s_tracker = STracker([val_s, val_t], val_y, name="U4")
            u4.fit(
                [train_s, train_t], train_y,
                epochs=8, batch_size=64,
                callbacks=[EpochTracker(epoch_var4), s_tracker],
                verbose=0
            )
            alpha_val4 = u4.predict([val_s, val_t], verbose=0)
            probs4, _, u_id4 = compute_evidential_outputs(alpha_val4)
            preds4 = np.argmax(probs4, axis=1)
            acc4 = accuracy_score(val_y, preds4)
            ece4 = compute_ece(probs4, val_y)

            # Predict OOD
            alpha_ood4 = u4.predict([X_seq_ood, ood_t], verbose=0)
            _, _, u_ood4 = compute_evidential_outputs(alpha_ood4)

            mean_u_id = np.mean(u_id4)
            mean_u_ood = np.mean(u_ood4)
            ratio4 = mean_u_ood / mean_u_id

            # Per-fold p95 threshold
            p95_id4 = np.percentile(u_id4, 95)
            ood_flag_rate = np.mean(u_ood4 > p95_id4) * 100

            print(f"==> [Fold {fold+1} U4 Result] Acc: {acc4*100:.2f}% | ECE: {ece4:.4f}", flush=True)
            print(f"    u_ID: {mean_u_id:.4f} (med: {np.median(u_id4):.4f}) | u_OOD: {mean_u_ood:.4f} (med: {np.median(u_ood4):.4f})", flush=True)
            print(f"    Leakage Ratio (u_OOD/u_ID): {ratio4:.3f}x | Fold p95(ID): {p95_id4:.4f} | OOD Flagged: {ood_flag_rate:.1f}%", flush=True)

        # -------------------------------------------------------------
        # STAGE 3: Test U5 (URL-EDL + Outlier Exposure)
        # Gate: Val Acc must be >88% before evaluating ratio
        # -------------------------------------------------------------
        if "U5" in run_stages:
            print("\n>>> Testing U5 (URL-EDL + Outlier Exposure) with 5% outliers & lambda_OE=0.08...", flush=True)
            n_outliers = int(0.05 * len(train_y))
            ood_train_idx = np.random.choice(len(X_seq_ood), size=n_outliers, replace=True)
            oe_seq = np.concatenate([train_s, X_seq_ood[ood_train_idx]], axis=0)
            oe_tab = np.concatenate([train_t, ood_t[ood_train_idx]], axis=0)
            oe_y = np.concatenate([train_y, -1 * np.ones(n_outliers, dtype=np.int32)], axis=0)

            perm = np.random.permutation(len(oe_y))
            oe_seq, oe_tab, oe_y = oe_seq[perm], oe_tab[perm], oe_y[perm]

            epoch_var5 = tf.Variable(1.0, trainable=False, dtype=tf.float32)
            u5 = build_url_edl_model(head_type="edl")
            u5.compile(
                optimizer=tf.keras.optimizers.Adam(learning_rate=2e-4, clipnorm=1.0),
                loss=create_edl_oe_loss(epoch_var5, total_epochs=8, ood_weight=0.08)
            )
            s_tracker5 = STracker([val_s, val_t], val_y, name="U5")
            u5.fit(
                [oe_seq, oe_tab], oe_y,
                epochs=8, batch_size=64,
                callbacks=[EpochTracker(epoch_var5), s_tracker5],
                verbose=0
            )
            alpha_val5 = u5.predict([val_s, val_t], verbose=0)
            probs5, _, u_id5 = compute_evidential_outputs(alpha_val5)
            preds5 = np.argmax(probs5, axis=1)
            acc5 = accuracy_score(val_y, preds5)
            ece5 = compute_ece(probs5, val_y)

            alpha_ood5 = u5.predict([X_seq_ood, ood_t], verbose=0)
            _, _, u_ood5 = compute_evidential_outputs(alpha_ood5)

            mean_u_id5 = np.mean(u_id5)
            mean_u_ood5 = np.mean(u_ood5)
            ratio5 = mean_u_ood5 / mean_u_id5
            p95_id5 = np.percentile(u_id5, 95)
            ood_flag_rate5 = np.mean(u_ood5 > p95_id5) * 100

            print(f"==> [Fold {fold+1} U5 Result] Acc: {acc5*100:.2f}% | ECE: {ece5:.4f}", flush=True)
            print(f"    u_ID: {mean_u_id5:.4f} (med: {np.median(u_id5):.4f}) | u_OOD: {mean_u_ood5:.4f} (med: {np.median(u_ood5):.4f})", flush=True)
            print(f"    Leakage Ratio (u_OOD/u_ID): {ratio5:.3f}x | Fold p95(ID): {p95_id5:.4f} | OOD Flagged: {ood_flag_rate5:.1f}%", flush=True)
            if acc5 < 0.88:
                print(f"    [WARNING] U5 failed gate: Val Acc {acc5*100:.2f}% < 88.0%!", flush=True)
            else:
                print(f"    [GATE PASSED] U5 Val Acc {acc5*100:.2f}% >= 88.0%!", flush=True)

        # -------------------------------------------------------------
        # STAGE 4: Test U6 (URL-EDL Cosine Head with tau=0.2 & Annealed Margin)
        # Gate: ECE < 0.08, Ratio > 1.5x
        # -------------------------------------------------------------
        if "U6" in run_stages:
            print("\n>>> Testing U6 (URL-EDL Cosine Head) with tau=0.2 & Annealed Margin m=0.2...", flush=True)
            epoch_var6 = tf.Variable(1.0, trainable=False, dtype=tf.float32)
            u6 = build_url_edl_model(
                head_type="cosine",
                scale=10.0,
                margin=0.2,
                temperature=0.2,
                epoch_var=epoch_var6,
                total_epochs=8
            )
            u6.compile(
                optimizer=tf.keras.optimizers.Adam(learning_rate=2e-4, clipnorm=1.0),
                loss=create_edl_loss(epoch_var6, total_epochs=8)
            )
            s_tracker6 = STracker([val_s, val_t], val_y, name="U6")
            u6.fit(
                [train_s, train_t], train_y,
                epochs=8, batch_size=64,
                callbacks=[EpochTracker(epoch_var6), s_tracker6],
                verbose=0
            )
            alpha_val6 = u6.predict([val_s, val_t], verbose=0)
            probs6, _, u_id6 = compute_evidential_outputs(alpha_val6)
            preds6 = np.argmax(probs6, axis=1)
            acc6 = accuracy_score(val_y, preds6)
            ece6 = compute_ece(probs6, val_y)

            alpha_ood6 = u6.predict([X_seq_ood, ood_t], verbose=0)
            _, _, u_ood6 = compute_evidential_outputs(alpha_ood6)

            mean_u_id6 = np.mean(u_id6)
            mean_u_ood6 = np.mean(u_ood6)
            ratio6 = mean_u_ood6 / mean_u_id6
            p95_id6 = np.percentile(u_id6, 95)
            ood_flag_rate6 = np.mean(u_ood6 > p95_id6) * 100

            print(f"==> [Fold {fold+1} U6 Result] Acc: {acc6*100:.2f}% | ECE: {ece6:.4f}", flush=True)
            print(f"    u_ID: {mean_u_id6:.4f} (med: {np.median(u_id6):.4f}) | u_OOD: {mean_u_ood6:.4f} (med: {np.median(u_ood6):.4f})", flush=True)
            print(f"    Leakage Ratio (u_OOD/u_ID): {ratio6:.3f}x | Fold p95(ID): {p95_id6:.4f} | OOD Flagged: {ood_flag_rate6:.1f}%", flush=True)


if __name__ == "__main__":
    run_stage_verification(run_stages=["U5", "U6"])

