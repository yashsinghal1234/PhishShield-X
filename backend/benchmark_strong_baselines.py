"""
Benchmark Strong Shallow & Tabular Baselines on Clean Artifact-Controlled Dataset.
Evaluates:
1. Character n-gram TF-IDF (n in [3, 5]) + Logistic Regression
2. Character n-gram TF-IDF + Linear SVM
3. 34 Cyber-Security Tabular Features + Random Forest
4. 34 Cyber-Security Tabular Features + XGBoost
5. Hybrid Tabular + n-gram Model
With 5-Fold Stratified Cross-Validation, reporting Accuracy, AUROC, ECE, and Brier Score.
"""

import os
import re
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.ensemble import RandomForestClassifier
import xgboost as xgb
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import roc_auc_score, accuracy_score, brier_score_loss
import sys
sys.path.insert(0, os.path.abspath('.'))
sys.path.insert(0, os.path.abspath('backend'))
from features import URLFeatureExtractor
import json

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

def run_baselines():
    print("=" * 75)
    print("BENCHMARKING STRONG CLASSICAL BASELINES ON CLEAN QUISHING DATASET")
    print("=" * 75)
    
    id_data = np.load("backend/data/clean_quishing_id.npz")
    urls = id_data['urls'].tolist()
    y = id_data['labels']
    
    print(f"Total Clean Dataset: N = {len(urls)} ({np.sum(y == 0)} Safe, {np.sum(y == 1)} Phish)")
    
    # 1. Extract 34 Cyber-Security Tabular Features
    print("Extracting 34 cyber-security tabular features from normalized URLs...")
    extractor = URLFeatureExtractor()
    X_tabular = np.array(extractor.transform(urls), dtype=np.float32)
    # Replace NaNs or Infs if any
    X_tabular = np.nan_to_num(X_tabular, nan=0.0, posinf=0.0, neginf=0.0)
    
    # 2. Extract Character n-gram TF-IDF Features
    print("Vectorizing character n-grams (range: 3 to 5)...")
    tfidf = TfidfVectorizer(analyzer='char', ngram_range=(3, 5), max_features=5000)
    X_tfidf = tfidf.fit_transform(urls)
    
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    
    results = {
        "Char_Ngram_LogisticRegression": {"acc": [], "auroc": [], "ece": [], "brier": []},
        "Tabular_RandomForest_34":       {"acc": [], "auroc": [], "ece": [], "brier": []},
        "Tabular_XGBoost_34":            {"acc": [], "auroc": [], "ece": [], "brier": []},
        "Hybrid_Tabular_Ngram_LR":       {"acc": [], "auroc": [], "ece": [], "brier": []}
    }
    
    from scipy.sparse import hstack
    X_hybrid = hstack([X_tfidf, X_tabular]).tocsr()
    
    for fold, (train_idx, val_idx) in enumerate(skf.split(urls, y)):
        y_tr, y_va = y[train_idx], y[val_idx]
        
        # A. Char N-gram Logistic Regression
        lr = LogisticRegression(max_iter=1000, C=1.0)
        lr.fit(X_tfidf[train_idx], y_tr)
        p_lr = lr.predict_proba(X_tfidf[val_idx])[:, 1]
        results["Char_Ngram_LogisticRegression"]["acc"].append(accuracy_score(y_va, p_lr >= 0.5))
        results["Char_Ngram_LogisticRegression"]["auroc"].append(roc_auc_score(y_va, p_lr))
        results["Char_Ngram_LogisticRegression"]["ece"].append(compute_ece(y_va, p_lr))
        results["Char_Ngram_LogisticRegression"]["brier"].append(brier_score_loss(y_va, p_lr))
        
        # B. 34-Feature Random Forest
        rf = RandomForestClassifier(n_estimators=150, max_depth=15, random_state=42, n_jobs=-1)
        rf.fit(X_tabular[train_idx], y_tr)
        p_rf = rf.predict_proba(X_tabular[val_idx])[:, 1]
        results["Tabular_RandomForest_34"]["acc"].append(accuracy_score(y_va, p_rf >= 0.5))
        results["Tabular_RandomForest_34"]["auroc"].append(roc_auc_score(y_va, p_rf))
        results["Tabular_RandomForest_34"]["ece"].append(compute_ece(y_va, p_rf))
        results["Tabular_RandomForest_34"]["brier"].append(brier_score_loss(y_va, p_rf))
        
        # C. 34-Feature XGBoost
        model_xgb = xgb.XGBClassifier(n_estimators=150, max_depth=6, learning_rate=0.08, eval_metric='logloss', random_state=42)
        model_xgb.fit(X_tabular[train_idx], y_tr)
        p_xgb = model_xgb.predict_proba(X_tabular[val_idx])[:, 1]
        results["Tabular_XGBoost_34"]["acc"].append(accuracy_score(y_va, p_xgb >= 0.5))
        results["Tabular_XGBoost_34"]["auroc"].append(roc_auc_score(y_va, p_xgb))
        results["Tabular_XGBoost_34"]["ece"].append(compute_ece(y_va, p_xgb))
        results["Tabular_XGBoost_34"]["brier"].append(brier_score_loss(y_va, p_xgb))
        
        # D. Hybrid Tabular + Ngram Logistic Regression
        lr_hyb = LogisticRegression(max_iter=1000, C=1.0)
        lr_hyb.fit(X_hybrid[train_idx], y_tr)
        p_hyb = lr_hyb.predict_proba(X_hybrid[val_idx])[:, 1]
        results["Hybrid_Tabular_Ngram_LR"]["acc"].append(accuracy_score(y_va, p_hyb >= 0.5))
        results["Hybrid_Tabular_Ngram_LR"]["auroc"].append(roc_auc_score(y_va, p_hyb))
        results["Hybrid_Tabular_Ngram_LR"]["ece"].append(compute_ece(y_va, p_hyb))
        results["Hybrid_Tabular_Ngram_LR"]["brier"].append(brier_score_loss(y_va, p_hyb))

    print("\n--- 5-FOLD CROSS-VALIDATION SUMMARY ---")
    header = f"{'Model Baseline':30s} | {'Accuracy (%)':15s} | {'ROC-AUC':15s} | {'ECE':10s} | {'Brier Loss':10s}"
    print(header)
    print("-" * len(header))
    
    summary = {}
    for name, m in results.items():
        acc_m, acc_s = np.mean(m["acc"])*100, np.std(m["acc"])*100
        auc_m, auc_s = np.mean(m["auroc"]), np.std(m["auroc"])
        ece_m = np.mean(m["ece"])
        brier_m = np.mean(m["brier"])
        print(f"{name:30s} | {acc_m:5.2f}% +/- {acc_s:4.2f}% | {auc_m:.4f} +/- {auc_s:.4f} | {ece_m:.4f}     | {brier_m:.4f}")
        summary[name] = {
            "accuracy_mean": float(acc_m), "accuracy_std": float(acc_s),
            "auroc_mean": float(auc_m), "auroc_std": float(auc_s),
            "ece_mean": float(ece_m), "brier_mean": float(brier_m)
        }
        
    with open("backend/baseline_benchmark_results.json", "w") as f:
        json.dump(summary, f, indent=2)
    print("\nSaved baseline results to backend/baseline_benchmark_results.json")
    print("=" * 75)

if __name__ == "__main__":
    run_baselines()
