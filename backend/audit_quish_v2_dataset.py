"""
Quish-EDL V2 Dataset Artifact Audit v2 (patched per review) - run from repository root with backend venv.
FIXES OVER v1:
  1. M1 constant-prediction fraction computed without np.mode; ASCII-safe console output.
  2. ABORT if npz reconstruction label match < 100% (never audit data that isn't the npz).
  3. Grouped split added: StratifiedGroupKFold grouped by registrable domain (tldextract, offline bundle).
  4. Positive-class composition: per-type breakdown (defacement/phishing/malware) + per-type AUROC;
     phishing-only render sample with random AND grouped split n-gram baselines.
  5. V2 image audit: pixel-artifact LR classifier on the npz images;
     URL artifact 8-feature classifier on canonicalized V2 URLs (random + grouped).
  6. M1 positive control: predict URL-length bucket (terciles) from the image alone.
Paths are anchored to the repository root (script parent + '..').
"""

import hashlib
import json
import math
import os
import re
import sys
import urllib.parse

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, StratifiedGroupKFold

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Keep path-independent like the runtime: choose whichever root exists
def _p(rel):
    cands = [os.path.join(ROOT, rel.replace("backend/", "")), os.path.join(ROOT, rel)]
    for c in cands:
        if os.path.exists(c):
            return c
    return cands[-1]

SAMPLE_SIZE = 3000
SEED = 42


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def get_domain(url: str) -> str:
    u = str(url).strip()
    if "://" not in u:
        u = "http://" + u
    host = urllib.parse.urlparse(u).netloc.lower().split(":")[0]
    host = host[4:] if host.startswith("www.") else host
    return host


def canonicalize(url: str) -> str:
    t = re.sub(r"^[a-zA-Z]+://", "", str(url).strip())
    t = re.sub(r"^www\.", "", t, flags=re.IGNORECASE)
    return t


def shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    counts = np.array([s.count(c) for c in set(s)], dtype=np.float64)
    p = counts / len(s)
    return float(-np.sum(p * np.log2(p)))


def url_artifact_features(url: str) -> dict:
    """Deterministic URL artifact features (not a threat model - a data-artifact probe)."""
    host = get_domain(url)
    path_q = canonicalize(url)
    return {
        "url_len": len(url),
        "host_len": len(host),
        "entropy": shannon_entropy(canonicalize(url)),
        "digit_ratio": sum(c.isdigit() for c in path_q) / max(1, len(path_q)),
        "hyphen_count_host": host.count("-"),
        "subdir_count": canonicalize(url).count("/"),
        "param_count": canonicalize(url).count("="),
        "has_ip_like_host": 1.0 if re.match(r"^\d{1,3}(\.\d{1,3}){3}$", host) else 0.0,
    }


def image_pixel_features(img: np.ndarray) -> dict:
    """Cheap pixel-statistics probe of QR raster separability (data-artifact check)."""
    a = img[..., 0] if img.ndim == 3 else img
    mean = float(a.mean())
    black = float((a < 0.5).mean())
    row_means = a.mean(axis=1)
    col_means = a.mean(axis=0)
    xs = np.arange(len(row_means), dtype=np.float32)
    def _slope(r):
        return float(np.polyfit(xs, r, 1)[0])
    return {
        "mean": mean, "std": float(a.std()), "black_density": black,
        "row_mean_var": float(row_means.var()), "col_mean_var": float(col_means.var()),
        "row_slope": _slope(row_means), "col_slope": _slope(col_means),
        "gradient_energy": float(np.abs(np.diff(a, axis=0)).mean() + np.abs(np.diff(a, axis=1)).mean()),
        "v_symmetry": float(np.abs(a - a[::-1]).mean()),
        "h_symmetry": float(np.abs(a - a[:, ::-1]).mean()),
        "crop_dark_upper_left": float((a[: a.shape[0] // 4, : a.shape[1] // 4] < 0.5).mean()),
        "crop_dark_center": float((a[a.shape[0]//3: a.shape[0]//3 * 2, a.shape[1]//3: a.shape[1]//3 * 2] < 0.5).mean()),
        "crop_dark_upper_right": float((a[: a.shape[0]//4, a.shape[1]*3//4:] < 0.5).mean()),
        "nonzero_frac_edges": float(((a < 1.0) & (a > 0.0)).mean()),
    }


print("=" * 100)
print("QUISH-EDL V2 DATASET ARTIFACT AUDIT v2")
print("=" * 100)

# ---------------------------------------------------------------- 1. Provenance
src = _p("backend/data/malicious_phish.csv")
df = pd.read_csv(src)
label_counts = df["type"].value_counts().to_dict()
print(f"\n[1] SOURCE FILE: {src}")
print(f"    SHA256(dataset): {sha256(src)}")
print(f"    Rows: {len(df)} | Label distribution: {label_counts}")

# ------------------------------------------------- 2. Reconstruct V2 render list
df = df.dropna(subset=["url", "type"]).reset_index(drop=True)
benign_df = df[df["type"].str.lower() == "benign"]
phish_df = df[df["type"].str.lower() != "benign"]
# ALSO track the "type" string per row for per-type breakdown later
type_lookup = {}
for _, r in benign_df.iterrows():
    type_lookup[str(r["url"]).strip().lower()] = "benign"
for _, r in phish_df.iterrows():
    type_lookup[str(r["url"]).strip().lower()] = str(r["type"]).strip().lower()

half = SAMPLE_SIZE // 2
benign_urls = benign_df["url"].sample(min(len(benign_df), half), random_state=SEED).tolist()
phish_urls = phish_df["url"].sample(min(len(phish_df), half), random_state=SEED).tolist()
urls_render_order = benign_urls + phish_urls
labels_render_order = np.array([0] * len(benign_urls) + [1] * len(phish_urls), dtype=np.int32)
perm = np.random.RandomState(SEED).permutation(len(labels_render_order))
urls_final = [urls_render_order[i] for i in perm]
labels_final = labels_render_order[perm]

d_id = np.load(_p("backend/data/quishing_id_dataset.npz"))
y_npz = d_id["labels"]
match = float(np.mean(y_npz == labels_final)) if len(y_npz) == len(labels_final) else 0.0
npz_kind = "(benign+phish, pandas seed 42, shuffle seed 42)"
print(f"\n[2] RECONSTRUCTION: npz label match = {match*100:.2f}% {npz_kind}", flush=True)
print(f"    npz SHA256: {sha256(_p('backend/data/quishing_id_dataset.npz'))}")
print(f"    npz SHA256 (data/ copy): {sha256(os.path.join(ROOT, 'data/quishing_id_dataset.npz'))}")
print(f"    OOD npz SHA256: {sha256(_p('backend/data/quishing_ood_dataset.npz'))}")
if match < 0.9999:
    print("FATAL: reconstruction mismatch - the reconstructed URL order does NOT match the npz. Aborting (never audit data that isn't the npz).")
    sys.exit(2)
y = y_npz
urls = urls_final                                # confirmed npz-aligned
types = np.array([type_lookup.get(str(u).strip().lower(), "unknown") for u in urls], dtype=object)

# ------------------------------------------------- 3. Cross-class overlap leakage
ben_domains = {get_domain(u) for u in benign_urls}
phish_domains = {get_domain(u) for u in phish_urls}
inter_domains = sorted(ben_domains & phish_domains)
ben_urls_set, phish_urls_set = set(map(str.lower, benign_urls)), set(map(str.lower, phish_urls))
inter_urls = sorted(ben_urls_set & phish_urls_set)
dup_urls_in_set = len(urls_render_order) - len({str(u).lower() for u in urls_render_order})
print(f"\n[3] CROSS-CLASS AUDIT on the sampled render set ({len(urls_render_order)} rows):")
print(f"    Domains in BOTH classes: {len(inter_domains)} -> {inter_domains}")
print(f"    Exact URLs in BOTH classes: {len(inter_urls)} -> {[u[:70] for u in inter_urls]}")
print(f"    Duplicate URL rows within the render set: {dup_urls_in_set}")

# Positive-class composition of the V2 sample
pos_types = {t: int(np.sum(types == t)) for t in sorted(set(types.tolist()))}
print(f"    Positive-class composition of the sample: {pos_types}")

# --------------------------------------- 4. Grouping + CV domain-disjoint scores
import tldextract
ext = tldextract.TLDExtract(suffix_list_urls=())  # offline bundled snapshot, no network

def registrable(url: str) -> str:
    e = ext(str(url).strip())
    rd = getattr(e, "top_domain_under_public_suffix", None) or e.registered_domain
    return rd if rd else get_domain(url)

groups = np.array([registrable(u) for u in urls], dtype=object)
print(f"\n[4] GROUPING: {len(set(groups.tolist()))} unique registrable domains across {len(groups)} rows.")

fold_rows = []
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
for fold, (tr, va) in enumerate(skf.split(groups, y)):
    tr_d, va_d = set(groups[tr]), set(groups[va])
    shared = tr_d & va_d
    va_rows_from_shared = int(np.isin(groups[va], list(shared)).sum())
    fold_rows.append({"fold": fold + 1, "shared_registrable_domains": len(shared),
                      "shared_flat_domains": len(set(get_domain(d) for d in shared)),
                      "val_rows_from_shared_reg_domains": va_rows_from_shared,
                      "val_rows": int(len(va))})
mean_shared = float(np.mean([r["shared_registrable_domains"] for r in fold_rows]))
mean_frac = float(np.mean([r["val_rows_from_shared_reg_domains"] / r["val_rows"] for r in fold_rows]))
print("    Random StratifiedKFold train|val overlap (registrable domains):")
for r in fold_rows:
    print(f"      Fold {r['fold']}: {r['shared_registrable_domains']} shared domains; "
          f"{r['val_rows_from_shared_reg_domains']}/{r['val_rows']} val rows revisit train domains "
          f"({100*r['val_rows_from_shared_reg_domains']/r['val_rows']:.1f}%)")
print(f"    MEAN: {mean_shared:.1f} shared domains; {mean_frac*100:.1f}% of each val fold re-visits train domains")

# ------------------------------------------------- 5. n-gram baselines (3 variants)
def run_ngram(Xt, yt, split_fn_parts):
    """Generic char TF-IDF + LogReg runner. split_fn_parts: list of (train_idx, val_idx)."""
    rows = []
    for fold, (tr, va) in enumerate(split_fn_parts):
        vec = TfidfVectorizer(analyzer="char", ngram_range=(3, 5), max_features=50000,
                              lowercase=True, sublinear_tf=True)
        Xtr = vec.fit_transform(Xt[tr])
        Xva = vec.transform(Xt[va])
        clf = LogisticRegression(max_iter=2000, solver="liblinear", C=2.0)
        clf.fit(Xtr, yt[tr])
        p = clf.decision_function(Xva)
        s1 = 1.0 / (1.0 + np.exp(-p))            # P(class 1 = malicious)
        probs = np.stack([1.0 - s1, s1], axis=1)  # column 0 = P(class 0), column 1 = P(class 1)
        pred = np.argmax(probs, axis=1)
        rows.append({"fold": fold + 1, "acc": accuracy_score(yt[va], pred),
                     "f1": f1_score(yt[va], pred), "auc": roc_auc_score(yt[va], p),
                     "val_idx": va, "score": p})
    return rows

X_text = np.array([canonicalize(u) for u in urls], dtype=object)

print("\n[5] CHAR N-GRAM LOGISTIC REGRESSION BASELINES", flush=True)

# 5a. V2, leaky random split
parts_random = list(skf.split(X_text, y))
rows_a = run_ngram(X_text, y, parts_random)
agg_a = {k: float(np.mean([r[k] for r in rows_a])) for k in ("acc", "f1", "auc")}
print(f"    V2 , random split      : acc={agg_a['acc']*100:.2f} f1={agg_a['f1']*100:.2f} auc={agg_a['auc']:.4f}")

# 5b. V2, domain-grouped split
sgkf = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=SEED)
parts_grouped = list(sgkf.split(X_text, y, groups))
rows_b = run_ngram(X_text, y, parts_grouped)
agg_b = {k: float(np.mean([r[k] for r in rows_b])) for k in ("acc", "f1", "auc")}
print(f"    V2 , domain-grouped    : acc={agg_b['acc']*100:.2f} f1={agg_b['f1']*100:.2f} auc={agg_b['auc']:.4f}")

# 5c. PHISHING-ONLY render sample (type == 'phishing'), random + grouped
phish_only_df = df[df["type"].str.lower() == "phishing"]
benign_only_df = df[df["type"].str.lower() == "benign"]
po_phish = phish_only_df["url"].sample(min(len(phish_only_df), 1500), random_state=SEED).tolist()
po_benign = benign_only_df["url"].sample(min(len(benign_only_df), 1500), random_state=SEED).tolist()
po_urls = po_benign + po_phish
po_labels = np.array([0]*len(po_benign) + [1]*len(po_phish), dtype=np.int32)
po_perm = np.random.RandomState(SEED).permutation(len(po_labels))
po_urls = [po_urls[i] for i in po_perm]
po_y = po_labels[po_perm]
po_text = np.array([canonicalize(u) for u in po_urls], dtype=object)
po_groups = np.array([registrable(u) for u in po_urls], dtype=object)

rows_c1 = run_ngram(po_text, po_y, list(skf.split(po_text, po_y)))
rows_c2 = run_ngram(po_text, po_y, list(sgkf.split(po_text, po_y, po_groups)))
agg_c1 = {k: float(np.mean([r[k] for r in rows_c1])) for k in ("acc", "f1", "auc")}
agg_c2 = {k: float(np.mean([r[k] for r in rows_c2])) for k in ("acc", "f1", "auc")}
print(f"    PHISH-only, random     : acc={agg_c1['acc']*100:.2f} f1={agg_c1['f1']*100:.2f} auc={agg_c1['auc']:.4f}")
print(f"    PHISH-only, grouped    : acc={agg_c2['acc']*100:.2f} f1={agg_c2['f1']*100:.2f} auc={agg_c2['auc']:.4f}")

# 5d. per-type AUROC on V2 (grouped split val predictions pooled, benign-vs-type subsets)
pooled = []  # (url_lower, type, label, grouped_val_score)
for r in rows_b:
    va = r["val_idx"]
    for i_val, i_abs in enumerate(va):
        pooled.append((str(urls[i_abs]).strip().lower(), types[i_abs], int(y[i_abs]), float(r["score"][i_val])))
ytype_score = {}
per_type_auc = {}
ben_rows = [(t, l, s) for (u, t, l, s) in pooled if l == 0]
for t in sorted({p[1] for p in pooled}):
    if t in ("benign", "unknown"):
        continue
    type_rows = [(l, s) for (u2, t2, l, s) in pooled if t2 == t]
    labels = [0] * len(ben_rows) + [1] * len(type_rows)
    scores = [s for (_, _, s) in ben_rows] + [s for (l, s) in type_rows]
    if len(set(labels)) < 2 or len(scores) == 0:
        per_type_auc[t] = None
        print(f"    per-type pooled grouped-split AUROC [{t}] = UNDEFINED (single-class subset, n={len(scores)})")
        continue
    per_type_auc[t] = float(roc_auc_score(labels, scores))
    print(f"    per-type pooled grouped-split AUROC [benign vs {t}] = {per_type_auc[t]:.4f} (n={len(scores)})")

# --------------------------------------------- 6. M1 vision variance + positive control
from tensorflow.keras.utils import set_random_seed

X_imgs = d_id["images"]
tr, va = parts_random[0]
print("\n[6] M1 vision-only checks (fold 1, 8 epochs):", flush=True)

set_random_seed(42)
from evaluate_quishing_research import build_unimodal_vision_model
m1 = build_unimodal_vision_model()
m1.fit(X_imgs[tr], y[tr], epochs=8, batch_size=128, verbose=0)
p1 = m1.predict(X_imgs[va], verbose=0)
hard1 = np.argmax(p1, axis=1)
const1 = float(max(np.mean(hard1 == 0), np.mean(hard1 == 1)))
m1_stats = {
    "std_of_positive_class_prob": float(np.std(p1[:, 1])),
    "min": float(np.min(p1[:, 1])), "max": float(np.max(p1[:, 1])),
    "constant_prediction_fraction": const1,
    "fold1_acc": float(accuracy_score(y[va], hard1) * 100),
    "fold1_auc": float(roc_auc_score(y[va], p1[:, 1])),
}
print(f"    p1[:,1] std = {m1_stats['std_of_positive_class_prob']:.6f} (near 0 => constant output)")
print(f"    range = [{m1_stats['min']:.4f}, {m1_stats['max']:.4f}] | const_frac = {const1:.3f}")
print(f"    fold1 acc = {m1_stats['fold1_acc']:.2f}% | fold1 auROC = {m1_stats['fold1_auc']:.4f}")

# Positive control: URL-length bucket from image alone
canon_len = np.array([len(canonicalize(u)) for u in urls], dtype=np.float32)
edges = np.percentile(canon_len, [33.33, 66.67])
bucket = np.ones(len(canon_len), dtype=np.int32)
bucket[canon_len < edges[0]] = 0
bucket[canon_len > edges[1]] = 2
from tensorflow.keras import Model, layers as KL
# 3-class positive control: predict URL-length bucket (terciles) from the image alone
def build_length_bucket_model():
    import tensorflow as tf
    from evaluate_quishing_research import encode_visual_stream, MAX_LEN, NUM_CLASSES
    import inspect as _insp
    from evaluate_quishing_research import IMG_SHAPE
    inp = KL.Input(shape=IMG_SHAPE)
    v = encode_visual_stream(inp)
    h = KL.Dense(48, activation="relu")(v)
    h = KL.Dropout(0.2)(h)
    h = KL.Dense(32, activation="relu")(h)
    out = KL.Dense(3, activation="softmax")(h)
    mdl = Model(inp, out, name="M1_lenbucket_control")
    mdl.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return mdl
set_random_seed(1234)
pc = build_length_bucket_model()
pc.fit(X_imgs[tr], bucket[tr], epochs=8, batch_size=128, verbose=0)
pp = pc.predict(X_imgs[va], verbose=0)
hardp = np.argmax(pp, axis=1)
pc_acc = float(accuracy_score(bucket[va], hardp) * 100)
pc_const = float(max(np.mean(hardp == 0), np.mean(hardp == 1), np.mean(hardp == 2)))
chance = 100.0 / 3.0
positive_control = {"fold1_acc_pct": pc_acc, "chance_pct": chance, "constant_frac": pc_const, "above_chance": bool(pc_acc > chance + 2.0)}
print(f"    POSITIVE CONTROL (length bucket from image) acc = {pc_acc:.2f}% vs chance {chance:.1f}% | above chance? {positive_control['above_chance']}")

# ---------------------------------- 7. V2 image-artifact + URL-artifact probes
print("\n[7] ARTIFACT PROBES (are V2 samples separable by non-semantic statistics?)", flush=True)
img_feats = np.array([list(image_pixel_features(im).values()) for im in X_imgs], dtype=np.float32)
rows_d = []
from sklearn.preprocessing import StandardScaler
for fold, (trf, vaf) in enumerate(parts_random):
    sc = StandardScaler().fit(img_feats[trf])
    clf = LogisticRegression(max_iter=2000, solver="liblinear")
    clf.fit(sc.transform(img_feats[trf]), y[trf])
    pf = clf.decision_function(sc.transform(img_feats[vaf]))
    rows_d.append(roc_auc_score(y[vaf], pf))
img_probe_auc = float(np.mean(rows_d))
print(f"    IMAGE pixel-artifier probe (random split, mean AUROC) = {img_probe_auc:.4f}")

urlf = np.array([[*url_artifact_features(u).values()] for u in urls], dtype=np.float32)
rows_e = []
for fold, (trf, vaf) in enumerate(parts_random):
    sc = StandardScaler().fit(urlf[trf])
    clf = LogisticRegression(max_iter=2000, solver="liblinear")
    clf.fit(sc.transform(urlf[trf]), y[trf])
    pe = clf.decision_function(sc.transform(urlf[vaf]))
    rows_e.append(roc_auc_score(y[vaf], pe))
url_probe_auc = float(np.mean(rows_e))
print(f"    URL 8-artifact probe (random split, mean AUROC) = {url_probe_auc:.4f}")

# grouped variant for URL artifact probe
rows_e2 = []
for fold, (trf, vaf) in enumerate(parts_grouped):
    sc = StandardScaler().fit(urlf[trf])
    clf = LogisticRegression(max_iter=2000, solver="liblinear")
    clf.fit(sc.transform(urlf[trf]), y[trf])
    pe = clf.decision_function(sc.transform(urlf[vaf]))
    rows_e2.append(roc_auc_score(y[vaf], pe))
url_probe_auc_grouped = float(np.mean(rows_e2))
print(f"    URL 8-artifact probe (domain-grouped) = {url_probe_auc_grouped:.4f}")

# ------------------------------------------------------------ 8. Manifest / JSON
manifest_rel = os.path.join("research_paper", "quish_v2_dataset_audit.json")
manifest = {
    "source_file": src,
    "source_sha256": sha256(src),
    "source_rows": int(len(df)),
    "source_label_distribution": {k: int(v) for k, v in label_counts.items()},
    "render_sample": {"n": len(urls_render_order), "benign": len(benign_urls), "malicious": len(phish_urls)},
    "positive_class_composition": pos_types,
    "npz": {
        "id": sha256(_p("backend/data/quishing_id_dataset.npz")),
        "id_data_copy": sha256(os.path.join(ROOT, "data/quishing_id_dataset.npz")),
        "ood": sha256(_p("backend/data/quishing_ood_dataset.npz")),
    },
    "reconstruction_label_match_pct": match * 100,
    "cross_class_overlap": {
        "domains_in_both_classes": len(inter_domains),
        "domains_in_both_examples": inter_domains[:20],
        "exact_urls_in_both_classes": len(inter_urls),
        "duplicate_rows_in_render_set": int(dup_urls_in_set),
    },
    "fold_domain_disjointness": {"per_fold": fold_rows, "mean_shared_registrable_domains": mean_shared,
                                 "mean_val_fraction_from_shared_domains": mean_frac},
    "ngram_baselines": {
        "v2_random": agg_a, "v2_domain_grouped": agg_b,
        "phishing_only_random": agg_c1, "phishing_only_domain_grouped": agg_c2,
        "v2_per_type_pooled_grouped_auc": per_type_auc,
    },
    "m1_checks": {**m1_stats, "positive_control_length_bucket": positive_control},
    "artifact_probes": {
        "image_pixel_probe_random_auc": img_probe_auc,
        "url_artifact_probe_random_auc": url_probe_auc,
        "url_artifact_probe_grouped_auc": url_probe_auc_grouped,
    },
}
os.makedirs(os.path.dirname(manifest_rel), exist_ok=True)
with open(manifest_rel, "w") as f:
    json.dump(manifest, f, indent=2)
print("\nSaved audit -> research_paper/quish_v2_dataset_audit.json")
