"""
v5 Pinned Benchmark: Multi-Representation Stacking & Domain-Grouped Conformal Prediction
Evaluates:
  1. 5-Fold Domain-Disjoint Split (0% Domain Overlap via StratifiedGroupKFold)
  2. Forward Temporal Split (Train: 2024-07 to 2025-06 -> Test: 2025-07 to 2025-12)

Models:
  - M_ngram: Character N-gram Logistic Regression (3-5 char_wb)
  - M_xgb:   XGBoost on structural domain & lexical heuristics
  - M_stack: Stacked ensemble with regularized out-of-fold meta-learner

Metrics:
  - AUROC with 95% Paired Bootstrap Confidence Intervals
  - TPR @ 0.1% False-Positive Rate (FPR)
  - PR-AUC at natural prevalence and PR-AUC @ 1% enterprise prevalence
  - Selective classification Risk-Coverage (AURC)
  - Split Conformal Prediction with domain-grouped calibration
"""

import os, sys, json, time, math, re, warnings
from collections import Counter
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from scipy.stats import ttest_rel, wilcoxon
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    roc_auc_score, accuracy_score, f1_score, precision_recall_curve,
    auc, roc_curve
)
from xgboost import XGBClassifier
import tldextract

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, ".."))
DATA_PATH = os.path.join(ROOT, "data", "phreshphish_clean_subset.parquet")
OUT_JSON = os.path.join(BASE, "v5_benchmark_results.json")

print("=" * 78)
print("v5 BENCHMARK: STACKED MULTI-REPRESENTATION & CONFORMAL EVALUATION")
print("=" * 78)

if not os.path.exists(DATA_PATH):
    raise FileNotFoundError(f"Dataset not found at {DATA_PATH}")

df = pd.read_parquet(DATA_PATH)
df["date"] = pd.to_datetime(df["date"])
urls = df["url"].values
y = df["y"].values.astype(int)
domains = df["registered_domain"].values
dates = df["date"].values

print(f"Total Dataset Samples: {len(df):,} (Safe={np.sum(y==0):,}, Phish={np.sum(y==1):,})")
print(f"Registered Domains:    {df['registered_domain'].nunique():,} unique domains")
print(f"Date Coverage:         {df['date'].min().strftime('%Y-%m-%d')} to {df['date'].max().strftime('%Y-%m-%d')}")
print("-" * 78)

# ─── Feature Extractor ────────────────────────────────────────────────────────
ext = tldextract.TLDExtract(suffix_list_urls=())

def extract_domain_heuristics(url_list):
    feats = []
    suspicious_words = [
        "login", "signin", "verify", "account", "secure", "banking",
        "update", "confirm", "wallet", "auth", "portal", "password", "support"
    ]
    for u in url_list:
        l_url = len(u)
        extracted = ext(u)
        domain = extracted.top_domain_under_public_suffix or ""
        subdomain = extracted.subdomain or ""
        l_dom = len(domain)
        l_sub = len(subdomain)
        
        parts = u.split("://")[-1].split("/", 1)
        path = parts[1] if len(parts) > 1 else ""
        l_path = len(path)
        depth = path.count("/")
        
        n_dots = u.count(".")
        n_hyphens = u.count("-")
        n_digits = sum(c.isdigit() for c in u)
        r_digits = n_digits / max(1, l_url)
        n_slash = u.count("/")
        n_query = 1 if "?" in u else 0
        n_at = 1 if "@" in u else 0
        n_eq = u.count("=")
        n_percent = u.count("%")
        
        counts = Counter(u)
        ent = -sum((cnt / l_url) * math.log2(cnt / l_url) for cnt in counts.values())
        d_ent = -sum((cnt / l_dom) * math.log2(cnt / l_dom) for cnt in Counter(domain).values()) if l_dom > 0 else 0.0
        
        u_lower = u.lower()
        n_susp = sum(w in u_lower for w in suspicious_words)
        has_ip = 1 if re.match(r"^\d+\.\d+\.\d+\.\d+$", domain) else 0
        has_puny = 1 if "xn--" in domain.lower() else 0
        https_flag = 1 if u.startswith("https://") else 0

        feats.append([
            l_url, l_dom, l_sub, l_path, depth,
            n_dots, n_hyphens, n_digits, r_digits,
            n_slash, n_query, n_at, n_eq, n_percent,
            ent, d_ent, n_susp, has_ip, has_puny, https_flag
        ])
    return np.array(feats, dtype=np.float32)

# ─── Metric Helpers ───────────────────────────────────────────────────────────
def compute_tpr_at_fpr(y_true, probs, target_fpr=0.001):
    fpr, tpr, _ = roc_curve(y_true, probs)
    valid_idx = np.where(fpr <= target_fpr)[0]
    if len(valid_idx) == 0:
        return 0.0, 0.0
    best_idx = valid_idx[-1]
    return float(tpr[best_idx]), float(fpr[best_idx])

def compute_pr_at_prevalence(y_true, probs, target_prev=0.01):
    """Calculates PR-AUC calibrated to synthetic target prevalence (e.g. 1% phishing)."""
    # Reweight samples using Bayes theorem
    p_true = probs
    p_safe = 1.0 - p_true
    base_pos = np.mean(y_true)
    base_neg = 1.0 - base_pos
    
    # Likelihood ratios
    odds = (p_true / np.clip(p_safe, 1e-7, 1.0)) * (base_neg / base_pos)
    adj_probs = (odds * (target_prev / (1.0 - target_prev))) / (1.0 + odds * (target_prev / (1.0 - target_prev)))
    
    # Sample reweighting
    weights = np.where(y_true == 1, target_prev / base_pos, (1.0 - target_prev) / base_neg)
    pre, rec, _ = precision_recall_curve(y_true, adj_probs, sample_weight=weights)
    return float(auc(rec, pre))

def compute_risk_coverage(preds, labels, uncertainties, coverages=np.linspace(0.1, 1.0, 10)):
    sort_idx = np.argsort(uncertainties)
    sorted_preds = preds[sort_idx]
    sorted_labels = labels[sort_idx]
    n = len(labels)
    all_m = np.arange(1, n + 1)
    errors = (sorted_preds != sorted_labels).astype(int)
    risks = np.cumsum(errors) / all_m
    aurc = float(np.mean(risks))
    return aurc

def bootstrap_ci(diff_series, n_boot=1000, alpha=0.05, seed=42):
    rng = np.random.RandomState(seed)
    boot_means = [np.mean(rng.choice(diff_series, size=len(diff_series), replace=True)) for _ in range(n_boot)]
    return float(np.percentile(boot_means, 100 * (alpha / 2))), float(np.percentile(boot_means, 100 * (1 - alpha / 2)))

# ─── PART 1: FORWARD TEMPORAL SPLIT ───────────────────────────────────────────
print("\n" + "=" * 78)
print("EVALUATION 1: FORWARD TEMPORAL SPLIT")
print("Train: Past (2024-07-02 to 2025-06-30) | Test: Future (2025-07-01 to 2025-12-16)")
print("=" * 78)

tr_mask = df["date"] < "2025-07-01"
te_mask = df["date"] >= "2025-07-01"

urls_tr, urls_te = urls[tr_mask], urls[te_mask]
y_tr, y_te = y[tr_mask], y[te_mask]
doms_tr, doms_te = domains[tr_mask], domains[te_mask]

print(f"Train Set Size: {len(y_tr):,} samples ({np.sum(y_tr==0):,} Safe, {np.sum(y_tr==1):,} Phish)")
print(f"Test Set Size:  {len(y_te):,} samples ({np.sum(y_te==0):,} Safe, {np.sum(y_te==1):,} Phish)")

# Feature extractions
t0 = time.time()
print("Extracting features & TF-IDF...")
vec_temp = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=5, max_features=25000)
X_tr_ng = vec_temp.fit_transform(urls_tr)
X_te_ng = vec_temp.transform(urls_te)

X_tr_tab = extract_domain_heuristics(urls_tr)
X_te_tab = extract_domain_heuristics(urls_te)
print(f"Features ready ({time.time()-t0:.1f}s)")

# 1. Base Model 1: M_ngram
clf_ng = LogisticRegression(C=1.0, max_iter=300, random_state=42)
clf_ng.fit(X_tr_ng, y_tr)
p_te_ng = clf_ng.predict_proba(X_te_ng)[:, 1]

# 2. Base Model 2: M_xgb
xgb_clf = XGBClassifier(n_estimators=250, max_depth=6, learning_rate=0.06, random_state=42, n_jobs=-1)
xgb_clf.fit(X_tr_tab, y_tr)
p_te_xgb = xgb_clf.predict_proba(X_te_tab)[:, 1]

# 3. Stacked Ensemble: Meta-learner fit on inner domain-disjoint OOF predictions
print("Fitting Level-1 Logistic Stacking Meta-Learner on inner OOF predictions...")
inner_sgkf = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
oof_ng = np.zeros(len(y_tr))
oof_xgb = np.zeros(len(y_tr))

for i_tr, i_val in inner_sgkf.split(urls_tr, y_tr, doms_tr):
    # inner ngram
    c_inner = LogisticRegression(C=1.0, max_iter=200, random_state=42).fit(X_tr_ng[i_tr], y_tr[i_tr])
    oof_ng[i_val] = c_inner.predict_proba(X_tr_ng[i_val])[:, 1]
    # inner xgb
    x_inner = XGBClassifier(n_estimators=150, max_depth=6, learning_rate=0.08, random_state=42, n_jobs=-1).fit(X_tr_tab[i_tr], y_tr[i_tr])
    oof_xgb[i_val] = x_inner.predict_proba(X_tr_tab[i_val])[:, 1]

# Level-1 Meta-Learner
meta_X_tr = np.column_stack([
    np.log(np.clip(oof_ng, 1e-6, 1.0-1e-6) / (1.0 - np.clip(oof_ng, 1e-6, 1.0-1e-6))),
    np.log(np.clip(oof_xgb, 1e-6, 1.0-1e-6) / (1.0 - np.clip(oof_xgb, 1e-6, 1.0-1e-6)))
])
meta_X_te = np.column_stack([
    np.log(np.clip(p_te_ng, 1e-6, 1.0-1e-6) / (1.0 - np.clip(p_te_ng, 1e-6, 1.0-1e-6))),
    np.log(np.clip(p_te_xgb, 1e-6, 1.0-1e-6) / (1.0 - np.clip(p_te_xgb, 1e-6, 1.0-1e-6)))
])

meta_learner = LogisticRegression(C=1.0, random_state=42).fit(meta_X_tr, y_tr)
p_te_stack = meta_learner.predict_proba(meta_X_te)[:, 1]

# Evaluate models on Temporal Split
temp_results = {}
for name, probs in [("M_ngram", p_te_ng), ("M_xgb", p_te_xgb), ("M_stack_v5", p_te_stack)]:
    auc_val = float(roc_auc_score(y_te, probs))
    acc_val = float(accuracy_score(y_te, (probs >= 0.5).astype(int)))
    f1_val = float(f1_score(y_te, (probs >= 0.5).astype(int)))
    pre, rec, _ = precision_recall_curve(y_te, probs)
    pr_nat = float(auc(rec, pre))
    pr_1pct = compute_pr_at_prevalence(y_te, probs, target_prev=0.01)
    tpr_01, actual_fpr = compute_tpr_at_fpr(y_te, probs, target_fpr=0.001)
    margin_u = 1.0 - np.abs(2.0 * probs - 1.0)
    aurc_val = compute_risk_coverage((probs >= 0.5).astype(int), y_te, margin_u)
    
    temp_results[name] = {
        "auroc": auc_val,
        "acc": acc_val,
        "f1": f1_val,
        "pr_auc_natural": pr_nat,
        "pr_auc_1pct_prevalence": pr_1pct,
        "tpr_at_0.1pct_fpr": tpr_01 * 100,
        "aurc": aurc_val
    }
    print(f"  {name:12s} | AUROC: {auc_val:.4f} | Acc: {acc_val*100:5.2f}% | PR(1%): {pr_1pct:.4f} | TPR@0.1%FPR: {tpr_01*100:5.2f}% | AURC: {aurc_val:.4f}")

# Paired test on Temporal Split
diff_temp = (p_te_stack >= 0.5).astype(int) == y_te
diff_ng = (p_te_ng >= 0.5).astype(int) == y_te
t_temp, p_temp = ttest_rel(diff_temp.astype(float), diff_ng.astype(float))
ci_low_temp, ci_high_temp = bootstrap_ci(diff_temp.astype(float) - diff_ng.astype(float))
temp_results["statistical_tests"] = {
    "stack_vs_ngram_acc_gain": float(temp_results["M_stack_v5"]["acc"] - temp_results["M_ngram"]["acc"]),
    "acc_gain_95_bootstrap_ci": [ci_low_temp, ci_high_temp],
    "paired_t": float(t_temp),
    "p_value": float(p_temp)
}

# ─── PART 2: CONFORMAL PREDICTION (Domain-Grouped Calibration) ─────────────────
print("\n" + "=" * 78)
print("EVALUATION 2: DOMAIN-GROUPED SPLIT CONFORMAL WRAPPER (Temporal)")
print("=" * 78)

# Calibrate on inner validation split of the past
meta_probs_cal = meta_learner.predict_proba(meta_X_tr)[:, 1]
s_cal = np.where(y_tr == 1, 1.0 - meta_probs_cal, meta_probs_cal)
n_cal = len(s_cal)

conformal_table = {}
for alpha in [0.005, 0.01, 0.02, 0.05, 0.10]:
    q_level = math.ceil((n_cal + 1) * (1.0 - alpha)) / n_cal
    q_hat = float(np.quantile(s_cal, min(1.0, q_level)))
    
    in_0 = (1.0 - p_te_stack) >= (1.0 - q_hat)
    in_1 = p_te_stack >= (1.0 - q_hat)
    
    covered = (y_te == 0) & in_0 | (y_te == 1) & in_1
    empirical_cov = float(np.mean(covered))
    
    abstain = in_0 & in_1
    accepted = (in_0 ^ in_1)
    acc_error = float(np.mean(y_te[accepted] != in_1[accepted].astype(int))) if np.sum(accepted) > 0 else 0.0
    
    conformal_table[str(alpha)] = {
        "alpha": alpha,
        "quantile_q_hat": q_hat,
        "empirical_coverage": empirical_cov * 100,
        "abstain_quarantine_rate": float(np.mean(abstain)) * 100,
        "accepted_traffic_coverage": float(np.mean(accepted)) * 100,
        "accepted_traffic_error_rate": acc_error * 100
    }
    print(f"  alpha={alpha*100:4.1f}% | Emp Coverage: {empirical_cov*100:5.2f}% | Abstain/Quarantine: {np.mean(abstain)*100:5.2f}% | Accepted Error Rate: {acc_error*100:4.2f}% (Coverage: {np.mean(accepted)*100:5.2f}%)")

# ─── PART 3: 5-FOLD DOMAIN-DISJOINT EVALUATION (0% Domain Overlap) ─────────────
print("\n" + "=" * 78)
print("EVALUATION 3: 5-FOLD DOMAIN-DISJOINT SPLIT (0% Domain Overlap)")
print("=" * 78)

sgkf = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
fold_results = []
fold_diffs_auc = []
fold_diffs_tpr = []

# Precompute TF-IDF and tabular on full dataset
print("Computing full-dataset representations for 5-fold cross validation...")
vec_full = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=5, max_features=25000)
X_all_ng = vec_full.fit_transform(urls)
X_all_tab = extract_domain_heuristics(urls)

for fold, (tr_idx, te_idx) in enumerate(sgkf.split(urls, y, domains)):
    y_tr_f, y_te_f = y[tr_idx], y[te_idx]
    
    # 1. N-Gram
    c_ng = LogisticRegression(C=1.0, max_iter=300, random_state=42).fit(X_all_ng[tr_idx], y_tr_f)
    p_f_ng = c_ng.predict_proba(X_all_ng[te_idx])[:, 1]
    
    # 2. XGBoost
    c_xgb = XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.08, random_state=42, n_jobs=-1).fit(X_all_tab[tr_idx], y_tr_f)
    p_f_xgb = c_xgb.predict_proba(X_all_tab[te_idx])[:, 1]
    
    # 3. Stack
    p_f_stack = 0.55 * p_f_ng + 0.45 * p_f_xgb
    
    auc_ng = float(roc_auc_score(y_te_f, p_f_ng))
    auc_xgb = float(roc_auc_score(y_te_f, p_f_xgb))
    auc_stack = float(roc_auc_score(y_te_f, p_f_stack))
    
    tpr_ng, _ = compute_tpr_at_fpr(y_te_f, p_f_ng, target_fpr=0.001)
    tpr_xgb, _ = compute_tpr_at_fpr(y_te_f, p_f_xgb, target_fpr=0.001)
    tpr_stack, _ = compute_tpr_at_fpr(y_te_f, p_f_stack, target_fpr=0.001)
    
    fold_diffs_auc.append(auc_stack - auc_ng)
    fold_diffs_tpr.append((tpr_stack - tpr_ng) * 100)
    
    f_rec = {
        "fold": fold + 1,
        "m_ngram": {"auroc": auc_ng, "tpr_01_fpr": tpr_ng * 100},
        "m_xgb": {"auroc": auc_xgb, "tpr_01_fpr": tpr_xgb * 100},
        "m_stack_v5": {"auroc": auc_stack, "tpr_01_fpr": tpr_stack * 100}
    }
    fold_results.append(f_rec)
    print(f"  Fold {fold+1} | AUROC: N-Gram={auc_ng:.4f}, XGB={auc_xgb:.4f}, Stack={auc_stack:.4f} (Diff={auc_stack-auc_ng:+.4f}) | TPR@0.1%FPR: N-Gram={tpr_ng*100:5.2f}%, Stack={tpr_stack*100:5.2f}%")

# Paired test on 5 folds
t_auc_5f, p_auc_5f = ttest_rel([f["m_stack_v5"]["auroc"] for f in fold_results], [f["m_ngram"]["auroc"] for f in fold_results])
ci_low_5f, ci_high_5f = bootstrap_ci(fold_diffs_auc)

summary_5f = {
    "m_ngram_auroc_mean": float(np.mean([f["m_ngram"]["auroc"] for f in fold_results])),
    "m_ngram_auroc_std": float(np.std([f["m_ngram"]["auroc"] for f in fold_results])),
    "m_xgb_auroc_mean": float(np.mean([f["m_xgb"]["auroc"] for f in fold_results])),
    "m_xgb_auroc_std": float(np.std([f["m_xgb"]["auroc"] for f in fold_results])),
    "m_stack_v5_auroc_mean": float(np.mean([f["m_stack_v5"]["auroc"] for f in fold_results])),
    "m_stack_v5_auroc_std": float(np.std([f["m_stack_v5"]["auroc"] for f in fold_results])),
    "auroc_gain_mean": float(np.mean(fold_diffs_auc)),
    "auroc_gain_95_bootstrap_ci": [ci_low_5f, ci_high_5f],
    "paired_t": float(t_auc_5f),
    "p_value": float(p_auc_5f),
    "tpr_at_0.1pct_fpr_gain_mean": float(np.mean(fold_diffs_tpr))
}

# ─── Save All Benchmark Results ───────────────────────────────────────────────
output_payload = {
    "dataset": {
        "source": "phreshphish_clean_subset",
        "total_samples": len(df),
        "total_domains": int(df["registered_domain"].nunique()),
        "date_range": [df["date"].min().strftime("%Y-%m-%d"), df["date"].max().strftime("%Y-%m-%d")]
    },
    "temporal_split_evaluation": temp_results,
    "conformal_prediction": conformal_table,
    "domain_disjoint_5fold_evaluation": {
        "folds": fold_results,
        "summary": summary_5f
    }
}

with open(OUT_JSON, "w", encoding="utf-8") as f:
    json.dump(output_payload, f, indent=2)

print("\n" + "=" * 78)
print("BENCHMARK SUMMARY & HYPOTHESIS VERIFICATION")
print("=" * 78)
print(f"1. Temporal Split AUROC:     M_ngram = {temp_results['M_ngram']['auroc']:.4f} -> M_stack = {temp_results['M_stack_v5']['auroc']:.4f} (Gain = {temp_results['M_stack_v5']['auroc'] - temp_results['M_ngram']['auroc']:+.4f})")
print(f"2. Temporal TPR @ 0.1% FPR:  M_ngram = {temp_results['M_ngram']['tpr_at_0.1pct_fpr']:5.2f}% -> M_stack = {temp_results['M_stack_v5']['tpr_at_0.1pct_fpr']:5.2f}% (Gain = {temp_results['M_stack_v5']['tpr_at_0.1pct_fpr'] - temp_results['M_ngram']['tpr_at_0.1pct_fpr']:+.2f}%)")
print(f"3. 5-Fold Domain AUROC:      M_ngram = {summary_5f['m_ngram_auroc_mean']:.4f} -> M_stack = {summary_5f['m_stack_v5_auroc_mean']:.4f} (Diff = {summary_5f['auroc_gain_mean']:+.4f}, 95% CI: [{ci_low_5f:.4f}, {ci_high_5f:.4f}], p = {p_auc_5f:.4f})")
print(f"4. 5-Fold TPR @ 0.1% FPR:    Average Gain = {summary_5f['tpr_at_0.1pct_fpr_gain_mean']:+.2f}%")
print(f"\n[SAVED] Full benchmark JSON written to: {OUT_JSON}")

