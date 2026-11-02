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

# ─── PART 1: PRINT META-LEARNER COEFFICIENTS ──────────────────────────────────
print("=" * 80)
print("1. LOGISTIC META-LEARNER COEFFICIENTS & INTERCEPT")
print("=" * 80)

raw_tr = df[df["date"] < "2025-07-01"].copy()
raw_te = df[df["date"] >= "2025-07-01"].copy()
tr_doms = set(raw_tr["registered_domain"].unique())
te = raw_te[~raw_te["registered_domain"].isin(tr_doms)].copy()

# Fit vectorizer
vec_raw = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=5, max_features=25000)
X_tr_ng = vec_raw.fit_transform(raw_tr["url"])
X_te_ng = vec_raw.transform(te["url"])

def extract_20_heuristics(url_list):
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

X_tr_tab = extract_20_heuristics(raw_tr["url"])
X_te_tab = extract_20_heuristics(te["url"])

# Inner OOF
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
meta_lr = LogisticRegression(C=1.0, random_state=42).fit(meta_X_tr, raw_tr["y"])

print(f"Meta-Learner Formula on Logits:")
print(f"  logit(p_stack) = {meta_lr.coef_[0][0]:.4f} * logit(p_ng) + {meta_lr.coef_[0][1]:.4f} * logit(p_xgb) + ({meta_lr.intercept_[0]:.4f})")
print(f"Weights ratio (N-gram : XGBoost) = {meta_lr.coef_[0][0] / (meta_lr.coef_[0][0] + meta_lr.coef_[0][1]):.1%} : {meta_lr.coef_[0][1] / (meta_lr.coef_[0][0] + meta_lr.coef_[0][1]):.1%}")

# ─── PART 2: NEUTRALIZE URLS ──────────────────────────────────────────────────
print("\n" + "=" * 80)
print("2. NEUTRALIZING URL REPRESENTATIONS")
print("Rules: Strip scheme (http/https), strip 'www.', strip query strings (?...)")
print("=" * 80)

def neutralize_url(u):
    # Remove scheme
    s = re.sub(r"^https?://", "", u.strip(), flags=re.IGNORECASE)
    # Remove www.
    s = re.sub(r"^www\.", "", s, flags=re.IGNORECASE)
    # Remove query string and fragments
    s = s.split("?")[0].split("#")[0]
    # Remove trailing slash
    if s.endswith("/"):
        s = s[:-1]
    return s

df["url_neutral"] = df["url"].apply(neutralize_url)

# Extract domain-only text (hostname only, no path)
def extract_host_only(u_neutral):
    return u_neutral.split("/")[0]

df["domain_text"] = df["url_neutral"].apply(extract_host_only)

# Inspect sample neutralized URLs
print("Sample Neutralized URLs:")
for i in range(5):
    print(f"  Original:   {df['url'].iloc[i]}")
    print(f"  Neutral:    {df['url_neutral'].iloc[i]}")
    print(f"  Host-only:  {df['domain_text'].iloc[i]}\n")

# ─── PART 3: MATCHED SAMPLING (Length-Decile x has_path) ───────────────────────
print("=" * 80)
print("3. MATCHED SAMPLING REBUILD (Length-Decile x has_path)")
print("=" * 80)

df["neutral_len"] = df["url_neutral"].apply(len)
df["has_path"] = df["url_neutral"].apply(lambda s: 1 if "/" in s else 0)

# Compute deciles across full dataset
df["len_decile"] = pd.qcut(df["neutral_len"], q=10, labels=False, duplicates="drop")
df["stratum"] = df["has_path"].astype(str) + "_d" + df["len_decile"].astype(str)

print("Original Strata Distribution:")
strata_summary = df.groupby(["stratum", "y"]).size().unstack(fill_value=0)
strata_summary["phish_pct"] = strata_summary[1] / (strata_summary[0] + strata_summary[1]) * 100
print(strata_summary)

# Stratum-matched sampling: sample exactly equal benign and phishing per stratum
rng = np.random.RandomState(42)
matched_indices = []

for strat, group in df.groupby("stratum"):
    safe_idx = group[group.y == 0].index.values
    phish_idx = group[group.y == 1].index.values
    min_k = min(len(safe_idx), len(phish_idx))
    if min_k >= 50: # require at least 50 pairs
        sampled_safe = rng.choice(safe_idx, size=min_k, replace=False)
        sampled_phish = rng.choice(phish_idx, size=min_k, replace=False)
        matched_indices.extend(sampled_safe)
        matched_indices.extend(sampled_phish)

matched_df = df.loc[matched_indices].copy().reset_index(drop=True)
print(f"\nMatched Dataset Size: {len(matched_df):,} samples ({np.sum(matched_df.y==0):,} Safe, {np.sum(matched_df.y==1):,} Phish)")
print(f"Matched Registered Domains: {matched_df['registered_domain'].nunique():,} unique domains")

# ─── PART 4: 5-FOLD DOMAIN-DISJOINT CV ON NEUTRALIZED & MATCHED DATA ──────────
print("\n" + "=" * 80)
print("4. BENCHMARK ON NEUTRALIZED & MATCHED DATA (5-Fold Domain-Disjoint CV)")
print("Models:")
print("  1. N-Gram (Neutral URL):  Char 3-5 n-grams on scheme/query-stripped URL")
print("  2. N-Gram (Domain-Only):  Char 3-5 n-grams on hostname only")
print("  3. XGBoost (Domain-Only): 10 domain-internal features only")
print("  4. XGBoost (Neutral URL): 14 structural features (no scheme, no query)")
print("  5. Stack (Neutral URL):   Meta-learner on N-gram + XGBoost")
print("=" * 80)

def extract_neutral_heuristics(url_neutral_list, domain_only=False):
    feats = []
    suspicious_words = [
        "login", "signin", "verify", "account", "secure", "banking",
        "update", "confirm", "wallet", "auth", "portal", "password", "support"
    ]
    for u in url_neutral_list:
        parts = u.split("/", 1)
        host = parts[0]
        path = parts[1] if len(parts) > 1 else ""
        extracted = ext(host)
        dom = extracted.top_domain_under_public_suffix or ""
        sub = extracted.subdomain or ""
        
        l_dom = len(dom)
        l_sub = len(sub)
        n_dots = host.count(".")
        n_hyphens = host.count("-")
        n_digits = sum(c.isdigit() for c in host)
        r_digits = n_digits / max(1, len(host))
        counts = Counter(host)
        ent = -sum((cnt / len(host)) * math.log2(cnt / len(host)) for cnt in counts.values()) if len(host) > 0 else 0.0
        d_ent = -sum((cnt / l_dom) * math.log2(cnt / l_dom) for cnt in Counter(dom).values()) if l_dom > 0 else 0.0
        n_susp = sum(w in host.lower() for w in suspicious_words)
        has_ip = 1 if re.match(r"^\d+\.\d+\.\d+\.\d+$", dom) else 0
        has_puny = 1 if "xn--" in dom.lower() else 0
        
        domain_feats = [l_dom, l_sub, n_dots, n_hyphens, n_digits, r_digits, ent, d_ent, n_susp, has_ip, has_puny]
        
        if domain_only:
            feats.append(domain_feats)
        else:
            l_path = len(path)
            depth = path.count("/")
            n_slash = u.count("/")
            path_digits = sum(c.isdigit() for c in path)
            feats.append(domain_feats + [l_path, depth, n_slash, path_digits])
    return np.array(feats, dtype=np.float32)

# Extract representations on matched dataset
vec_match_full = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=5, max_features=25000)
X_match_ng_url = vec_match_full.fit_transform(matched_df["url_neutral"])

vec_match_dom = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=5, max_features=15000)
X_match_ng_dom = vec_match_dom.fit_transform(matched_df["domain_text"])

X_match_xgb_dom = extract_neutral_heuristics(matched_df["url_neutral"], domain_only=True)
X_match_xgb_url = extract_neutral_heuristics(matched_df["url_neutral"], domain_only=False)

y_match = matched_df["y"].values
doms_match = matched_df["registered_domain"].values

sgkf = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)

results_5f = {
    "ng_url": {"auroc": [], "tpr_1": [], "tpr_01": []},
    "ng_dom": {"auroc": [], "tpr_1": [], "tpr_01": []},
    "xgb_dom": {"auroc": [], "tpr_1": [], "tpr_01": []},
    "xgb_url": {"auroc": [], "tpr_1": [], "tpr_01": []},
    "stack_url": {"auroc": [], "tpr_1": [], "tpr_01": []}
}

def get_tpr(y_t, p_t, target_fpr):
    fpr, tpr, _ = roc_curve(y_t, p_t)
    v = np.where(fpr <= target_fpr)[0]
    return float(tpr[v[-1]]) * 100 if len(v) > 0 else 0.0

for fold, (tr_idx, te_idx) in enumerate(sgkf.split(matched_df["url_neutral"], y_match, doms_match)):
    y_tr, y_te = y_match[tr_idx], y_match[te_idx]
    
    # 1. N-Gram Full Neutral URL
    m_ng_url = LogisticRegression(C=1.0, max_iter=300, random_state=42).fit(X_match_ng_url[tr_idx], y_tr)
    p_ng_url = m_ng_url.predict_proba(X_match_ng_url[te_idx])[:, 1]
    
    # 2. N-Gram Domain-Only
    m_ng_dom = LogisticRegression(C=1.0, max_iter=300, random_state=42).fit(X_match_ng_dom[tr_idx], y_tr)
    p_ng_dom = m_ng_dom.predict_proba(X_match_ng_dom[te_idx])[:, 1]
    
    # 3. XGBoost Domain-Only
    m_xgb_dom = XGBClassifier(n_estimators=180, max_depth=6, learning_rate=0.08, random_state=42, n_jobs=-1).fit(X_match_xgb_dom[tr_idx], y_tr)
    p_xgb_dom = m_xgb_dom.predict_proba(X_match_xgb_dom[te_idx])[:, 1]
    
    # 4. XGBoost Neutral URL
    m_xgb_url = XGBClassifier(n_estimators=180, max_depth=6, learning_rate=0.08, random_state=42, n_jobs=-1).fit(X_match_xgb_url[tr_idx], y_tr)
    p_xgb_url = m_xgb_url.predict_proba(X_match_xgb_url[te_idx])[:, 1]
    
    # 5. Stack (Neutral URL)
    p_stack_url = 0.50 * p_ng_url + 0.50 * p_xgb_url
    
    for name, p_preds in [("ng_url", p_ng_url), ("ng_dom", p_ng_dom), ("xgb_dom", p_xgb_dom), ("xgb_url", p_xgb_url), ("stack_url", p_stack_url)]:
        results_5f[name]["auroc"].append(roc_auc_score(y_te, p_preds))
        results_5f[name]["tpr_1"].append(get_tpr(y_te, p_preds, 0.01))
        results_5f[name]["tpr_01"].append(get_tpr(y_te, p_preds, 0.001))
        
    print(f"Fold {fold+1} | AUROC: N-Gram(Dom)={results_5f['ng_dom']['auroc'][-1]:.4f}, XGB(Dom)={results_5f['xgb_dom']['auroc'][-1]:.4f} | N-Gram(URL)={results_5f['ng_url']['auroc'][-1]:.4f}, XGB(URL)={results_5f['xgb_url']['auroc'][-1]:.4f}, Stack={results_5f['stack_url']['auroc'][-1]:.4f}")

print("\n" + "=" * 80)
print("5-FOLD SUMMARY ON NEUTRALIZED & MATCHED BENCHMARK (Mean +/- Std)")
print("=" * 80)
print(f"{'Model Configuration':<28} | {'AUROC':<16} | {'TPR @ 1.0% FPR':<16} | {'TPR @ 0.1% FPR':<16}")
print("-" * 84)
for name, label in [
    ("ng_dom", "N-Gram (Domain-Only)"),
    ("xgb_dom", "XGBoost (Domain-Only)"),
    ("ng_url", "N-Gram (Neutral URL)"),
    ("xgb_url", "XGBoost (Neutral URL)"),
    ("stack_url", "Stack (Neutral URL)")
]:
    r = results_5f[name]
    print(f"{label:<28} | {np.mean(r['auroc']):.4f} +/- {np.std(r['auroc']):.4f} | {np.mean(r['tpr_1']):5.2f}% +/- {np.std(r['tpr_1']):4.2f}% | {np.mean(r['tpr_01']):5.2f}% +/- {np.std(r['tpr_01']):4.2f}%")

# Save full results
with open("backend/experiments/neutralized_matched_benchmark.json", "w") as f:
    json.dump({
        "matched_samples": len(matched_df),
        "matched_domains": int(matched_df["registered_domain"].nunique()),
        "summary": {
            k: {
                "auroc_mean": float(np.mean(v["auroc"])),
                "auroc_std": float(np.std(v["auroc"])),
                "tpr_1_mean": float(np.mean(v["tpr_1"])),
                "tpr_1_std": float(np.std(v["tpr_1"])),
                "tpr_01_mean": float(np.mean(v["tpr_01"])),
                "tpr_01_std": float(np.std(v["tpr_01"]))
            } for k, v in results_5f.items()
        }
    }, f, indent=2)

print("\nBenchmark Complete! Saved to backend/experiments/neutralized_matched_benchmark.json")

