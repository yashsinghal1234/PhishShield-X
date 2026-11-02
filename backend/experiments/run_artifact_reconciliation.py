import os, sys, math, re, json
from collections import Counter
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from xgboost import XGBClassifier
from sklearn.metrics import roc_curve, roc_auc_score
import tldextract

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

DATA_PATH = "backend/data/phreshphish_clean_subset.parquet"
df = pd.read_parquet(DATA_PATH)
df["date"] = pd.to_datetime(df["date"])

ext = tldextract.TLDExtract(suffix_list_urls=())

print("=" * 80)
print("EXPERIMENT 1: LR TOP-WEIGHTED N-GRAMS VERIFICATION")
print("=" * 80)

# 1. Inspect N-gram weights on Temporal Train Set
raw_tr = df[df["date"] < "2025-07-01"]
raw_te = df[df["date"] >= "2025-07-01"]
tr_doms = set(raw_tr["registered_domain"].unique())
te = raw_te[~raw_te["registered_domain"].isin(tr_doms)].copy()

vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=5, max_features=25000)
X_tr_ng = vec.fit_transform(raw_tr["url"])
X_te_ng = vec.transform(te["url"])

clf_ng = LogisticRegression(C=1.0, max_iter=300, random_state=42).fit(X_tr_ng, raw_tr["y"])

feature_names = np.array(vec.get_feature_names_out())
coefs = clf_ng.coef_[0]

# Top 30 positive n-grams (predicting Phishing)
top30_pos_idx = np.argsort(coefs)[-30:][::-1]
# Top 30 negative n-grams (predicting Benign)
top30_neg_idx = np.argsort(coefs)[:30]

print("Top 30 N-Grams predicting PHISHING (Highest Positive Weights):")
for i, idx in enumerate(top30_pos_idx):
    print(f"  {i+1:2d}. {feature_names[idx]!r:<12} (weight: {coefs[idx]:+.4f})")

print("\nTop 30 N-Grams predicting BENIGN (Most Negative Weights):")
for i, idx in enumerate(top30_neg_idx):
    print(f"  {i+1:2d}. {feature_names[idx]!r:<12} (weight: {coefs[idx]:+.4f})")

# ─── EXPERIMENT 2: 4-FEATURE ARTIFACT CLASSIFIER ──────────────────────────────
print("\n" + "=" * 80)
print("EXPERIMENT 2: 4-FEATURE ARTIFACT CLASSIFIER (Collection Bias Test)")
print("Features: [has_path, has_query, is_https, url_length]")
print("=" * 80)

def extract_4_artifacts(url_list):
    feats = []
    for u in url_list:
        is_https = 1.0 if u.lower().startswith("https://") else 0.0
        has_query = 1.0 if "?" in u else 0.0
        parts = u.split("://")[-1].split("/", 1)
        path = parts[1] if len(parts) > 1 else ""
        has_path = 1.0 if (path != "" and path != "/") else 0.0
        l_url = float(len(u))
        feats.append([has_path, has_query, is_https, l_url])
    return np.array(feats, dtype=np.float32)

X_art_full = extract_4_artifacts(df["url"])
y_full = df["y"].values
doms_full = df["registered_domain"].values

# 5-fold domain-disjoint cross-validation of 4-feature artifact model
sgkf = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
art_fold_aurocs_lr = []
art_fold_aurocs_xgb = []

for fold, (tr_idx, te_idx) in enumerate(sgkf.split(df["url"], y_full, doms_full)):
    # Simple LR on 4 artifacts
    lr_art = LogisticRegression(C=1.0).fit(X_art_full[tr_idx], y_full[tr_idx])
    p_art_lr = lr_art.predict_proba(X_art_full[te_idx])[:, 1]
    auc_lr = roc_auc_score(y_full[te_idx], p_art_lr)
    art_fold_aurocs_lr.append(auc_lr)
    
    # XGB on 4 artifacts
    xgb_art = XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42, n_jobs=-1)
    xgb_art.fit(X_art_full[tr_idx], y_full[tr_idx])
    p_art_xgb = xgb_art.predict_proba(X_art_full[te_idx])[:, 1]
    auc_xgb = roc_auc_score(y_full[te_idx], p_art_xgb)
    art_fold_aurocs_xgb.append(auc_xgb)

print(f"Artifact Model 5-Fold AUROC (LR on 4 features):  {np.mean(art_fold_aurocs_lr):.4f} +/- {np.std(art_fold_aurocs_lr):.4f}")
print(f"Artifact Model 5-Fold AUROC (XGB on 4 features): {np.mean(art_fold_aurocs_xgb):.4f} +/- {np.std(art_fold_aurocs_xgb):.4f}")

# Also check on the Forward Temporal Split
X_tr_art = extract_4_artifacts(raw_tr["url"])
X_te_art = extract_4_artifacts(te["url"])
xgb_art_temp = XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42, n_jobs=-1).fit(X_tr_art, raw_tr["y"])
p_te_art_temp = xgb_art_temp.predict_proba(X_te_art)[:, 1]
print(f"Artifact Model Temporal Split AUROC (XGB on 4 features): {roc_auc_score(te['y'], p_te_art_temp):.4f}")

# ─── EXPERIMENT 3: RECONCILE STACK NUMBERS (Exact Meta-Learner vs XGB) ───────
print("\n" + "=" * 80)
print("EXPERIMENT 3: RECONCILING STACK VS XGB NUMBERS")
print("=" * 80)

# Extract full domain heuristics
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
        n_susp = sum(w in u.lower() for w in suspicious_words)
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

X_tr_tab = extract_domain_heuristics(raw_tr["url"])
X_te_tab = extract_domain_heuristics(te["url"])

clf_xgb = XGBClassifier(n_estimators=250, max_depth=6, learning_rate=0.06, random_state=42, n_jobs=-1).fit(X_tr_tab, raw_tr["y"])
p_te_xgb = clf_xgb.predict_proba(X_te_tab)[:, 1]
p_te_ng = clf_ng.predict_proba(X_te_ng)[:, 1]

# Fit inner OOF meta-learner strictly on past
inner_sgkf = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
oof_ng = np.zeros(len(raw_tr))
oof_xgb = np.zeros(len(raw_tr))

for i_tr, i_val in inner_sgkf.split(raw_tr["url"], raw_tr["y"], raw_tr["registered_domain"]):
    c_in = LogisticRegression(C=1.0, max_iter=200, random_state=42).fit(X_tr_ng[i_tr], raw_tr["y"].iloc[i_tr])
    oof_ng[i_val] = c_in.predict_proba(X_tr_ng[i_val])[:, 1]
    x_in = XGBClassifier(n_estimators=120, max_depth=5, learning_rate=0.08, random_state=42, n_jobs=-1).fit(X_tr_tab[i_tr], raw_tr["y"].iloc[i_tr])
    oof_xgb[i_val] = x_in.predict_proba(X_tr_tab[i_val])[:, 1]

def to_logit(p):
    p_c = np.clip(p, 1e-6, 1.0 - 1e-6)
    return np.log(p_c / (1.0 - p_c))

meta_X_tr = np.column_stack([to_logit(oof_ng), to_logit(oof_xgb)])
meta_X_te = np.column_stack([to_logit(p_te_ng), to_logit(p_te_xgb)])
meta_lr = LogisticRegression(C=1.0, random_state=42).fit(meta_X_tr, raw_tr["y"])
p_te_stack_meta = meta_lr.predict_proba(meta_X_te)[:, 1]

def compute_tpr(y_true, probs, target_fpr):
    fpr, tpr, _ = roc_curve(y_true, probs)
    valid_idx = np.where(fpr <= target_fpr)[0]
    return float(tpr[valid_idx[-1]]) * 100 if len(valid_idx) > 0 else 0.0

y_te_arr = te["y"].values
print(f"Temporal Test Set (Full Point Estimates):")
print(f"  M_ngram      TPR@1%FPR = {compute_tpr(y_te_arr, p_te_ng, 0.01):.2f}% | TPR@0.1%FPR = {compute_tpr(y_te_arr, p_te_ng, 0.001):.2f}%")
print(f"  M_xgb        TPR@1%FPR = {compute_tpr(y_te_arr, p_te_xgb, 0.01):.2f}% | TPR@0.1%FPR = {compute_tpr(y_te_arr, p_te_xgb, 0.001):.2f}%")
print(f"  M_stack_meta TPR@1%FPR = {compute_tpr(y_te_arr, p_te_stack_meta, 0.01):.2f}% | TPR@0.1%FPR = {compute_tpr(y_te_arr, p_te_stack_meta, 0.001):.2f}%")
print(f"  Point Gain (Stack - XGB) @ 1.0% FPR: {compute_tpr(y_te_arr, p_te_stack_meta, 0.01) - compute_tpr(y_te_arr, p_te_xgb, 0.01):+.2f}%")
print(f"  Point Gain (Stack - XGB) @ 0.1% FPR: {compute_tpr(y_te_arr, p_te_stack_meta, 0.001) - compute_tpr(y_te_arr, p_te_xgb, 0.001):+.2f}%")

# Now run paired bootstrap with EXACT stack meta-learner predictions
doms_te = te["registered_domain"].values
unique_doms = np.unique(doms_te)
dom_to_idx = {d: np.where(doms_te == d)[0] for d in unique_doms}
rng = np.random.RandomState(42)

boot_diffs_stack_vs_xgb_1 = []
boot_diffs_stack_vs_xgb_01 = []

for _ in range(1000):
    s_doms = rng.choice(unique_doms, size=len(unique_doms), replace=True)
    s_idx = np.concatenate([dom_to_idx[d] for d in s_doms])
    y_b = y_te_arr[s_idx]
    if len(np.unique(y_b)) < 2:
        continue
    t_stk_1 = compute_tpr(y_b, p_te_stack_meta[s_idx], 0.01)
    t_xgb_1 = compute_tpr(y_b, p_te_xgb[s_idx], 0.01)
    boot_diffs_stack_vs_xgb_1.append(t_stk_1 - t_xgb_1)
    
    t_stk_01 = compute_tpr(y_b, p_te_stack_meta[s_idx], 0.001)
    t_xgb_01 = compute_tpr(y_b, p_te_xgb[s_idx], 0.001)
    boot_diffs_stack_vs_xgb_01.append(t_stk_01 - t_xgb_01)

print(f"\nPaired Bootstrap (Stack Meta-Learner vs. XGBoost):")
print(f"  TPR @ 1.0% FPR: Mean Diff = {np.mean(boot_diffs_stack_vs_xgb_1):+.2f}% | 95% CI: [{np.percentile(boot_diffs_stack_vs_xgb_1, 2.5):+.2f}%, {np.percentile(boot_diffs_stack_vs_xgb_1, 97.5):+.2f}%]")
print(f"  TPR @ 0.1% FPR: Mean Diff = {np.mean(boot_diffs_stack_vs_xgb_01):+.2f}% | 95% CI: [{np.percentile(boot_diffs_stack_vs_xgb_01, 2.5):+.2f}%, {np.percentile(boot_diffs_stack_vs_xgb_01, 97.5):+.2f}%]")

# ─── EXPERIMENT 4: XGBOOST ABLATION (Without Path, Scheme, Query) ─────────────
print("\n" + "=" * 80)
print("EXPERIMENT 4: XGBOOST ABLATION (Stripping Collection Leak Features)")
print("Drop: [has_path, path_depth, path_len, has_query, is_https, l_url]")
print("Keep ONLY Domain-Internal Signals: [l_dom, l_sub, digit_ratio, entropy, domain_entropy, hyphens, dots, ip, puny, suspicious_words]")
print("=" * 80)

# Feature indices from extract_domain_heuristics:
# 0: l_url, 1: l_dom, 2: l_sub, 3: l_path, 4: depth
# 5: n_dots, 6: n_hyphens, 7: n_digits, 8: r_digits
# 9: n_slash, 10: n_query, 11: n_at, 12: n_eq, 13: n_percent
# 14: ent, 15: d_ent, 16: n_susp, 17: has_ip, 18: has_puny, 19: https_flag

domain_only_idx = [1, 2, 5, 6, 8, 14, 15, 16, 17, 18] # purely domain internal
X_tr_ablated = X_tr_tab[:, domain_only_idx]
X_te_ablated = X_te_tab[:, domain_only_idx]

xgb_ablated = XGBClassifier(n_estimators=250, max_depth=6, learning_rate=0.06, random_state=42, n_jobs=-1).fit(X_tr_ablated, raw_tr["y"])
p_te_xgb_ablated = xgb_ablated.predict_proba(X_te_ablated)[:, 1]

print(f"Full XGBoost (with path & scheme leaks):")
print(f"  AUROC = {roc_auc_score(y_te_arr, p_te_xgb):.4f} | TPR@1.0%FPR = {compute_tpr(y_te_arr, p_te_xgb, 0.01):.2f}% | TPR@0.1%FPR = {compute_tpr(y_te_arr, p_te_xgb, 0.001):.2f}%")

print(f"Ablated XGBoost (Domain-Internal Signals ONLY):")
print(f"  AUROC = {roc_auc_score(y_te_arr, p_te_xgb_ablated):.4f} | TPR@1.0%FPR = {compute_tpr(y_te_arr, p_te_xgb_ablated, 0.01):.2f}% | TPR@0.1%FPR = {compute_tpr(y_te_arr, p_te_xgb_ablated, 0.001):.2f}%")

output_summary = {
    "artifact_classifier_5fold_xgb": float(np.mean(art_fold_aurocs_xgb)),
    "artifact_classifier_temp_xgb": float(roc_auc_score(te['y'], p_te_art_temp)),
    "full_xgb_temp_auroc": float(roc_auc_score(y_te_arr, p_te_xgb)),
    "full_xgb_tpr_1pct": compute_tpr(y_te_arr, p_te_xgb, 0.01),
    "ablated_xgb_temp_auroc": float(roc_auc_score(y_te_arr, p_te_xgb_ablated)),
    "ablated_xgb_tpr_1pct": compute_tpr(y_te_arr, p_te_xgb, 0.01),
    "top_positive_ngrams": [str(feature_names[i]) for i in top30_pos_idx[:15]],
    "top_negative_ngrams": [str(feature_names[i]) for i in top30_neg_idx[:15]]
}

with open("backend/experiments/reconciliation_and_ablation.json", "w") as f:
    json.dump(output_summary, f, indent=2)

print("\nSaved summary to backend/experiments/reconciliation_and_ablation.json")

