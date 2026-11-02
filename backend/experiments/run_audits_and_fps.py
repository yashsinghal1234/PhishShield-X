import os, sys, math, re, json
from collections import Counter
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from xgboost import XGBClassifier
from sklearn.metrics import roc_curve, roc_auc_score
import tldextract

# Suppress logs
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

DATA_PATH = "backend/data/phreshphish_clean_subset.parquet"
df = pd.read_parquet(DATA_PATH)
df["date"] = pd.to_datetime(df["date"])

ext = tldextract.TLDExtract(suffix_list_urls=())

# ─── PART 1: COLLECTION ARTIFACT AUDIT ────────────────────────────────────────
print("=" * 80)
print("PART 1: COLLECTION ARTIFACT AUDIT (Benign vs. Phishing)")
print("=" * 80)

def compute_artifacts(sub_df):
    urls = sub_df["url"].tolist()
    n = len(urls)
    
    https_cnt = sum(u.lower().startswith("https://") for u in urls)
    http_cnt = sum(u.lower().startswith("http://") for u in urls)
    
    # Path extraction
    bare_domain_cnt = 0
    path_lens = []
    url_lens = []
    dom_lens = []
    subdomain_cnts = []
    has_query_cnt = 0
    
    for u in urls:
        url_lens.append(len(u))
        parsed = ext(u)
        dom = parsed.top_domain_under_public_suffix or ""
        sub = parsed.subdomain or ""
        dom_lens.append(len(dom))
        subdomain_cnts.append(sub.count(".") + 1 if sub else 0)
        
        parts = u.split("://")[-1].split("/", 1)
        path = parts[1] if len(parts) > 1 else ""
        if path == "" or path == "/":
            bare_domain_cnt += 1
        path_lens.append(len(path))
        if "?" in u:
            has_query_cnt += 1
            
    return {
        "n": n,
        "https_pct": https_cnt / n * 100,
        "http_pct": http_cnt / n * 100,
        "bare_domain_pct": bare_domain_cnt / n * 100,
        "mean_url_len": float(np.mean(url_lens)),
        "median_url_len": float(np.median(url_lens)),
        "mean_path_len": float(np.mean(path_lens)),
        "median_path_len": float(np.median(path_lens)),
        "mean_dom_len": float(np.mean(dom_lens)),
        "mean_subdomains": float(np.mean(subdomain_cnts)),
        "has_query_pct": has_query_cnt / n * 100
    }

safe_art = compute_artifacts(df[df.y == 0])
phish_art = compute_artifacts(df[df.y == 1])

print(f"{'Feature / Metric':<32} | {'Benign (N=' + str(safe_art['n']) + ')':<22} | {'Phish (N=' + str(phish_art['n']) + ')':<22} | {'Difference':<15}")
print("-" * 96)
print(f"{'HTTPS Scheme (%)':<32} | {safe_art['https_pct']:<22.2f} | {phish_art['https_pct']:<22.2f} | {safe_art['https_pct'] - phish_art['https_pct']:+.2f}%")
print(f"{'HTTP Scheme (%)':<32} | {safe_art['http_pct']:<22.2f} | {phish_art['http_pct']:<22.2f} | {safe_art['http_pct'] - phish_art['http_pct']:+.2f}%")
print(f"{'Bare Domain / No Path (%)':<32} | {safe_art['bare_domain_pct']:<22.2f} | {phish_art['bare_domain_pct']:<22.2f} | {safe_art['bare_domain_pct'] - phish_art['bare_domain_pct']:+.2f}%")
print(f"{'Mean URL Length (chars)':<32} | {safe_art['mean_url_len']:<22.2f} | {phish_art['mean_url_len']:<22.2f} | {phish_art['mean_url_len'] - safe_art['mean_url_len']:+.2f}")
print(f"{'Median URL Length (chars)':<32} | {safe_art['median_url_len']:<22.2f} | {phish_art['median_url_len']:<22.2f} | {phish_art['median_url_len'] - safe_art['median_url_len']:+.2f}")
print(f"{'Mean Path Length (chars)':<32} | {safe_art['mean_path_len']:<22.2f} | {phish_art['mean_path_len']:<22.2f} | {phish_art['mean_path_len'] - safe_art['mean_path_len']:+.2f}")
print(f"{'Median Path Length (chars)':<32} | {safe_art['median_path_len']:<22.2f} | {phish_art['median_path_len']:<22.2f} | {phish_art['median_path_len'] - safe_art['median_path_len']:+.2f}")
print(f"{'Has Query Parameters (%)':<32} | {safe_art['has_query_pct']:<22.2f} | {phish_art['has_query_pct']:<22.2f} | {phish_art['has_query_pct'] - safe_art['has_query_pct']:+.2f}%")
print(f"{'Mean Subdomain Count':<32} | {safe_art['mean_subdomains']:<22.2f} | {phish_art['mean_subdomains']:<22.2f} | {phish_art['mean_subdomains'] - safe_art['mean_subdomains']:+.2f}")

# ─── PART 2: MODEL TRAINING ON TEMPORAL SPLIT ────────────────────────────────
print("\n" + "=" * 80)
print("PART 2: TEMPORAL SPLIT TRAINING & PREDICTIONS")
print("=" * 80)

raw_tr = df[df["date"] < "2025-07-01"]
raw_te = df[df["date"] >= "2025-07-01"]
tr_doms = set(raw_tr["registered_domain"].unique())
te = raw_te[~raw_te["registered_domain"].isin(tr_doms)].copy()

print(f"Train samples: {len(raw_tr):,} | Filtered Test samples: {len(te):,} (Benign={np.sum(te.y==0):,}, Phish={np.sum(te.y==1):,})")

# Extract Heuristics
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

print("Fitting N-gram vectorizer & models...")
vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=5, max_features=25000)
X_tr_ng = vec.fit_transform(raw_tr["url"])
X_te_ng = vec.transform(te["url"])

X_tr_tab = extract_domain_heuristics(raw_tr["url"])
X_te_tab = extract_domain_heuristics(te["url"])

clf_ng = LogisticRegression(C=1.0, max_iter=300, random_state=42).fit(X_tr_ng, raw_tr["y"])
p_te_ng = clf_ng.predict_proba(X_te_ng)[:, 1]

clf_xgb = XGBClassifier(n_estimators=250, max_depth=6, learning_rate=0.06, random_state=42, n_jobs=-1).fit(X_tr_tab, raw_tr["y"])
p_te_xgb = clf_xgb.predict_proba(X_te_tab)[:, 1]

# Stacking (logistic meta-learner weights: ~0.55 ng, ~0.45 xgb)
p_te_stack = 0.55 * p_te_ng + 0.45 * p_te_xgb

te["p_ng"] = p_te_ng
te["p_xgb"] = p_te_xgb
te["p_stack"] = p_te_stack

# ─── PART 3: PAIRED BOOTSTRAP CIs AT 1.0% AND 0.1% FPR ────────────────────────
print("\n" + "=" * 80)
print("PART 3: PAIRED DOMAIN-CLUSTERED BOOTSTRAP DIFFERENCE CIs")
print("=" * 80)

def compute_tpr_at_fpr(y_true, probs, target_fpr):
    fpr, tpr, _ = roc_curve(y_true, probs)
    valid_idx = np.where(fpr <= target_fpr)[0]
    if len(valid_idx) == 0:
        return 0.0
    return float(tpr[valid_idx[-1]])

y_te = te["y"].values
doms_te = te["registered_domain"].values
unique_doms = np.unique(doms_te)
dom_to_idx = {d: np.where(doms_te == d)[0] for d in unique_doms}

n_boot = 1000
rng = np.random.RandomState(42)

boot_diffs_xgb_vs_ng_1pct = []
boot_diffs_stack_vs_xgb_1pct = []
boot_diffs_xgb_vs_ng_01pct = []
boot_diffs_stack_vs_xgb_01pct = []

for _ in range(n_boot):
    sampled_doms = rng.choice(unique_doms, size=len(unique_doms), replace=True)
    idx_sample = np.concatenate([dom_to_idx[d] for d in sampled_doms])
    
    y_b = y_te[idx_sample]
    if len(np.unique(y_b)) < 2:
        continue
        
    p_ng_b = p_te_ng[idx_sample]
    p_xgb_b = p_te_xgb[idx_sample]
    p_stack_b = p_te_stack[idx_sample]
    
    tpr_ng_1 = compute_tpr_at_fpr(y_b, p_ng_b, 0.01) * 100
    tpr_xgb_1 = compute_tpr_at_fpr(y_b, p_xgb_b, 0.01) * 100
    tpr_stack_1 = compute_tpr_at_fpr(y_b, p_stack_b, 0.01) * 100
    
    tpr_ng_01 = compute_tpr_at_fpr(y_b, p_ng_b, 0.001) * 100
    tpr_xgb_01 = compute_tpr_at_fpr(y_b, p_xgb_b, 0.001) * 100
    tpr_stack_01 = compute_tpr_at_fpr(y_b, p_stack_b, 0.001) * 100
    
    boot_diffs_xgb_vs_ng_1pct.append(tpr_xgb_1 - tpr_ng_1)
    boot_diffs_stack_vs_xgb_1pct.append(tpr_stack_1 - tpr_xgb_1)
    boot_diffs_xgb_vs_ng_01pct.append(tpr_xgb_01 - tpr_ng_01)
    boot_diffs_stack_vs_xgb_01pct.append(tpr_stack_01 - tpr_xgb_01)

def get_ci(series):
    return float(np.percentile(series, 2.5)), float(np.percentile(series, 97.5)), float(np.mean(series))

ci_xgb_ng_1 = get_ci(boot_diffs_xgb_vs_ng_1pct)
ci_stack_xgb_1 = get_ci(boot_diffs_stack_vs_xgb_1pct)
ci_xgb_ng_01 = get_ci(boot_diffs_xgb_vs_ng_01pct)
ci_stack_xgb_01 = get_ci(boot_diffs_stack_vs_xgb_01pct)

print(f"1. TPR @ 1.0% FPR Paired Differences:")
print(f"   - XGB vs. N-gram Mean Gain:   {ci_xgb_ng_1[2]:+.2f} points | 95% CI: [{ci_xgb_ng_1[0]:+.2f}%, {ci_xgb_ng_1[1]:+.2f}%]")
sig_1 = "EXCLUDES ZERO (Statistically Significant)" if ci_xgb_ng_1[0] > 0 else "Crosses zero"
print(f"     Status: {sig_1}")
print(f"   - Stack vs. XGB Mean Gain:    {ci_stack_xgb_1[2]:+.2f} points | 95% CI: [{ci_stack_xgb_1[0]:+.2f}%, {ci_stack_xgb_1[1]:+.2f}%]")
sig_stk = "EXCLUDES ZERO" if ci_stack_xgb_1[0] > 0 else "CROSSES ZERO (Overlap - No Significant Gain)"
print(f"     Status: {sig_stk}")

print(f"\n2. TPR @ 0.1% FPR Paired Differences:")
print(f"   - XGB vs. N-gram Mean Gain:   {ci_xgb_ng_01[2]:+.2f} points | 95% CI: [{ci_xgb_ng_01[0]:+.2f}%, {ci_xgb_ng_01[1]:+.2f}%]")
print(f"   - Stack vs. XGB Mean Gain:    {ci_stack_xgb_01[2]:+.2f} points | 95% CI: [{ci_stack_xgb_01[0]:+.2f}%, {ci_stack_xgb_01[1]:+.2f}%]")

# ─── PART 4: TOP 30 BENIGN FALSE POSITIVES FROM N-GRAM ────────────────────────
print("\n" + "=" * 80)
print("PART 4: TOP 30 BENIGN URLS WITH HIGHEST N-GRAM PHISHING SCORES")
print("=" * 80)

benign_test = te[te.y == 0].copy()
top30_ng_fp = benign_test.sort_values(by="p_ng", ascending=False).head(30)

fp_list = []
print(f"{'Idx':<4} | {'p_ng':<6} | {'p_xgb':<6} | {'p_stk':<6} | {'Domain':<25} | {'URL (truncated 65 chars)':<65}")
print("-" * 115)
for idx, (_, row) in enumerate(top30_ng_fp.iterrows()):
    u = row["url"]
    dom = row["registered_domain"]
    png = row["p_ng"]
    pxgb = row["p_xgb"]
    pstk = row["p_stack"]
    trunc_u = u if len(u) <= 65 else u[:62] + "..."
    print(f"{idx+1:<4} | {png:<6.3f} | {pxgb:<6.3f} | {pstk:<6.3f} | {dom:<25} | {trunc_u:<65}")
    fp_list.append({
        "rank": idx + 1,
        "url": u,
        "domain": dom,
        "p_ngram": float(png),
        "p_xgb": float(pxgb),
        "p_stack": float(pstk)
    })

# Save output to json for inspection
with open("backend/experiments/fp_and_artifact_audit.json", "w") as f:
    json.dump({
        "artifact_audit": {"benign": safe_art, "phish": phish_art},
        "paired_ci_1pct_fpr": {
            "xgb_minus_ngram": {"mean": ci_xgb_ng_1[2], "ci_95": [ci_xgb_ng_1[0], ci_xgb_ng_1[1]]},
            "stack_minus_xgb": {"mean": ci_stack_xgb_1[2], "ci_95": [ci_stack_xgb_1[0], ci_stack_xgb_1[1]]}
        },
        "top30_ngram_false_positives": fp_list
    }, f, indent=2)

print("\nAudit complete! Output saved to backend/experiments/fp_and_artifact_audit.json")

