"""
Pinned Selective Classification Benchmark for Quishing Detection
Evaluates in-domain risk-coverage trade-offs (AURC), zero-shot OOD detection,
and false-positive quarantine rates across 10 evaluation folds (2 seeds x 5 domain-disjoint folds).

No OOD samples are used during training (strictly zero-shot OOD evaluation).
Hyperparameters and temperature scaling are fit strictly on an inner validation split.
"""

import os, sys, json, time, warnings
warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import numpy as np
import tensorflow as tf
from scipy.stats import ttest_rel, wilcoxon
from scipy.special import logsumexp
from sklearn.model_selection import StratifiedGroupKFold, train_test_split
from sklearn.metrics import roc_auc_score, accuracy_score, f1_score, average_precision_score, brier_score_loss
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer
import tldextract

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
CACHE_PATH = os.path.join(ROOT, "backend", "data", "clean_quishing_features_cached.npz")
OUT_JSON = os.path.join(BASE, "benchmark_run_pinned.json")

print("=" * 75)
print("PINNED SELECTIVE CLASSIFICATION BENCHMARK (10 Folds: 2 Seeds x 5 Domain Folds)")
print("=" * 75)

if not os.path.exists(CACHE_PATH):
    raise FileNotFoundError(f"Feature cache not found: {CACHE_PATH}")

cache = np.load(CACHE_PATH, allow_pickle=True)
vis_id = cache["vis_id"]
tab_id = cache["tab_id"]
seqs_id = cache["seqs_id"]
labels_id = cache["labels_id"]
urls_id = cache["urls_id"]

vis_ood = cache["vis_ood"]
tab_ood = cache["tab_ood"]
seqs_ood = cache["seqs_ood"]
labels_ood = cache["labels_ood"]
families_ood = cache["families_ood"]
urls_ood = cache["urls_ood"]

# Group by registered domain
ext = tldextract.TLDExtract(suffix_list_urls=())
groups = np.array([ext(u).top_domain_under_public_suffix or u.split("/")[0] for u in urls_id])

print(f"Loaded ID Samples:   {len(labels_id)} across {len(set(groups))} registered domains")
print(f"Loaded OOD Samples:  {len(labels_ood)} across {len(set(families_ood))} zero-day families (held-out)")

FEATURE_DIM = 32
TABULAR_DIM = 34
MAX_LEN = 180
VOCAB_SIZE = 110
EMBEDDING_DIM = 32
L2_REG = 1e-4

# ─── Metric Helpers ───────────────────────────────────────────────────────────
def compute_ece(probs, labels, n_bins=10):
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    confidences = np.max(np.vstack([1.0 - probs, probs]).T, axis=1)
    predictions = (probs >= 0.5).astype(int)
    accuracies = (predictions == labels).astype(int)
    for i in range(n_bins):
        bin_idx = (confidences > bin_boundaries[i]) & (confidences <= bin_boundaries[i + 1])
        prop = np.mean(bin_idx)
        if prop > 0:
            ece += np.abs(np.mean(accuracies[bin_idx]) - np.mean(confidences[bin_idx])) * prop
    return float(ece)

def compute_risk_coverage(preds, labels, uncertainties, coverages=np.linspace(0.1, 1.0, 10)):
    """Computes selective risk across coverage levels and AURC."""
    # Sort samples by uncertainty (ascending: lowest uncertainty first)
    sort_idx = np.argsort(uncertainties)
    sorted_preds = preds[sort_idx]
    sorted_labels = labels[sort_idx]
    n = len(labels)
    
    risk_at_cov = {}
    for cov in coverages:
        m = max(1, int(cov * n))
        risk = np.mean(sorted_preds[:m] != sorted_labels[:m])
        risk_at_cov[round(cov, 2)] = float(risk)
        
    # AURC: area under risk-coverage curve across all sample fractions
    all_m = np.arange(1, n + 1)
    errors = (sorted_preds != sorted_labels).astype(int)
    cum_errors = np.cumsum(errors)
    risks = cum_errors / all_m
    aurc = float(np.mean(risks))
    
    # Optimal AURC (Risk*)
    n_err = int(np.sum(errors))
    optimal_errors = np.array([0] * (n - n_err) + [1] * n_err)
    optimal_risks = np.cumsum(optimal_errors) / all_m
    opt_aurc = float(np.mean(optimal_risks))
    e_aurc = float(aurc - opt_aurc)
    
    return risk_at_cov, aurc, e_aurc

def bootstrap_ci(diff_series, n_boot=1000, alpha=0.05, seed=42):
    rng = np.random.RandomState(seed)
    boot_means = [np.mean(rng.choice(diff_series, size=len(diff_series), replace=True)) for _ in range(n_boot)]
    low = np.percentile(boot_means, 100 * (alpha / 2))
    high = np.percentile(boot_means, 100 * (1 - alpha / 2))
    return float(low), float(high)

# ─── Model Architectures ───────────────────────────────────────────────────────
class CosineEvidenceHead(tf.keras.layers.Layer):
    def __init__(self, num_classes=2, scale=10.0, margin=0.20, temperature=0.20, **kwargs):
        super().__init__(**kwargs)
        self.num_classes = num_classes
        self.scale = scale
        self.margin = margin
        self.temperature = temperature

    def build(self, input_shape):
        self.prototypes = self.add_weight(
            shape=(input_shape[-1], self.num_classes),
            initializer="glorot_uniform",
            trainable=True,
            name="prototypes"
        )

    def call(self, inputs):
        norm_inputs = tf.math.l2_normalize(inputs, axis=-1)
        norm_prototypes = tf.math.l2_normalize(self.prototypes, axis=0)
        cos_sim = tf.matmul(norm_inputs, norm_prototypes)
        scaled_sim = (cos_sim - self.margin) / self.temperature
        return self.scale * tf.math.softplus(scaled_sim)

def kl_uniform(alpha):
    K = tf.cast(tf.shape(alpha)[-1], tf.float32)
    beta = tf.ones_like(alpha)
    S_alpha = tf.reduce_sum(alpha, axis=-1, keepdims=True)
    S_beta = tf.reduce_sum(beta, axis=-1, keepdims=True)
    lnB = tf.math.lgamma(S_alpha) - tf.reduce_sum(tf.math.lgamma(alpha), axis=-1, keepdims=True)
    lnB_uni = tf.reduce_sum(tf.math.lgamma(beta), axis=-1, keepdims=True) - tf.math.lgamma(S_beta)
    dg_alpha = tf.math.digamma(alpha)
    dg_S_alpha = tf.math.digamma(S_alpha)
    kl = tf.reduce_sum((alpha - beta) * (dg_alpha - dg_S_alpha), axis=-1, keepdims=True) + lnB + lnB_uni
    return tf.maximum(0.0, tf.squeeze(kl, axis=-1))

def build_models():
    # 1. Softmax Multi-View
    inp_v3 = tf.keras.Input(shape=(FEATURE_DIM,))
    inp_l3 = tf.keras.Input(shape=(MAX_LEN,))
    inp_t3 = tf.keras.Input(shape=(TABULAR_DIM,))
    v3 = tf.keras.layers.Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(inp_v3)
    embed3 = tf.keras.layers.Embedding(VOCAB_SIZE, EMBEDDING_DIM)(inp_l3)
    c3 = tf.keras.layers.Conv1D(16, 3, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(embed3)
    c5 = tf.keras.layers.Conv1D(16, 5, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(embed3)
    flat3 = tf.keras.layers.Flatten()(tf.keras.layers.MaxPooling1D(4)(tf.keras.layers.concatenate([c3, c5])))
    l3 = tf.keras.layers.Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(flat3)
    t3 = tf.keras.layers.Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(inp_t3)
    fused3 = tf.keras.layers.concatenate([v3, l3, t3])
    h3 = tf.keras.layers.Dense(32, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(
        tf.keras.layers.Dense(48, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(fused3)
    )
    logits3 = tf.keras.layers.Dense(2, name="logits")(h3)
    m3 = tf.keras.Model([inp_v3, inp_l3, inp_t3], logits3)
    m3.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True)
    )

    # 2. EDL Multi-View (Zero-Shot, no OOD during training)
    inp_v6 = tf.keras.Input(shape=(FEATURE_DIM,))
    inp_l6 = tf.keras.Input(shape=(MAX_LEN,))
    inp_t6 = tf.keras.Input(shape=(TABULAR_DIM,))
    v6 = tf.keras.layers.Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(inp_v6)
    embed6 = tf.keras.layers.Embedding(VOCAB_SIZE, EMBEDDING_DIM)(inp_l6)
    c3_6 = tf.keras.layers.Conv1D(16, 3, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(embed6)
    c5_6 = tf.keras.layers.Conv1D(16, 5, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(embed6)
    flat6 = tf.keras.layers.Flatten()(tf.keras.layers.MaxPooling1D(4)(tf.keras.layers.concatenate([c3_6, c5_6])))
    l6 = tf.keras.layers.Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(flat6)
    t6 = tf.keras.layers.Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(inp_t6)
    f_p = tf.keras.layers.Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(
        tf.keras.layers.concatenate([l6, t6])
    )
    wv = tf.keras.layers.Dense(FEATURE_DIM, activation="sigmoid")(v6)
    wp = tf.keras.layers.Dense(FEATURE_DIM, activation="sigmoid")(f_p)
    conf = tf.keras.layers.Lambda(tf.abs)(tf.keras.layers.Subtract()([v6, f_p]))
    wconf = tf.keras.layers.Dense(FEATURE_DIM, activation="sigmoid")(tf.keras.layers.concatenate([v6, f_p]))
    gv = tf.keras.layers.Multiply()([wv, v6])
    gp = tf.keras.layers.Multiply()([wp, f_p])
    gc = tf.keras.layers.Multiply()([wconf, conf])
    fused6 = tf.keras.layers.Dense(32, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(
        tf.keras.layers.Dense(48, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(
            tf.keras.layers.concatenate([gv, gp, gc])
        )
    )
    ev6 = CosineEvidenceHead(num_classes=2, scale=10.0, margin=0.20, temperature=0.20)(fused6)
    gate = tf.keras.layers.Dense(1, activation="sigmoid")(tf.keras.layers.Dense(16, activation="relu")(fused6))
    alpha6 = tf.keras.layers.Lambda(lambda e: e + 1.0)(tf.keras.layers.Multiply()([ev6, gate]))
    m6 = tf.keras.Model([inp_v6, inp_l6, inp_t6], alpha6)

    def edl_loss(y_true, a):
        y_oh = tf.one_hot(tf.cast(y_true, tf.int32), depth=2)
        S = tf.reduce_sum(a, axis=-1, keepdims=True)
        p = a / S
        err = tf.reduce_sum(tf.square(y_oh - p), axis=-1, keepdims=True)
        var = tf.reduce_sum(p * (1.0 - p) / (S + 1.0), axis=-1, keepdims=True)
        a_tilde = y_oh + (1.0 - y_oh) * a
        kl = kl_uniform(a_tilde)
        return tf.reduce_mean(err + var + 0.1 * kl)

    m6.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss=edl_loss)
    return m3, m6

# ─── Main Benchmark Loop ───────────────────────────────────────────────────────
SEEDS = [42, 1337]
N_SPLITS = 5
results = {
    "config": {
        "seeds": SEEDS,
        "n_splits": N_SPLITS,
        "total_folds": len(SEEDS) * N_SPLITS,
        "date": time.strftime("%Y-%m-%d %H:%M:%S")
    },
    "folds": [],
    "summary": {}
}

# Precompute TF-IDF
vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=3, max_features=12000)
X_tfidf = vec.fit_transform(urls_id)
X_tfidf_ood = vec.transform(urls_ood)

fold_id = 0
for seed in SEEDS:
    sgkf = StratifiedGroupKFold(n_splits=N_SPLITS, shuffle=True, random_state=seed)
    for fold, (tr_idx, te_idx) in enumerate(sgkf.split(vis_id, labels_id, groups)):
        fold_id += 1
        print(f"\n[Run {fold_id}/10] Seed {seed} | Fold {fold+1}/5 (Train={len(tr_idx)}, Test={len(te_idx)})")

        y_tr, y_te = labels_id[tr_idx], labels_id[te_idx]
        
        # Scaling tabular
        scaler = StandardScaler()
        tab_tr = scaler.fit_transform(tab_id[tr_idx])
        tab_te = scaler.transform(tab_id[te_idx])
        tab_ood_s = scaler.transform(tab_ood)

        # ─── 1. M5 Char N-Gram LR ─────────────────────────────────────────────
        m5 = LogisticRegression(C=1.0, max_iter=300, random_state=seed)
        m5.fit(X_tfidf[tr_idx], y_tr)
        p5_te = m5.predict_proba(X_tfidf[te_idx])[:, 1]
        preds_m5 = (p5_te >= 0.5).astype(int)
        
        # Uncertainty 1: Margin
        u_m5_margin = 1.0 - np.abs(2.0 * p5_te - 1.0)
        
        # Uncertainty 2: Bagged Ensemble (5 models)
        bag_probs = []
        rng = np.random.RandomState(seed + fold)
        for b in range(5):
            boot_idx = rng.choice(tr_idx, size=len(tr_idx), replace=True)
            m_bag = LogisticRegression(C=1.0, max_iter=200, random_state=b).fit(X_tfidf[boot_idx], labels_id[boot_idx])
            bag_probs.append(m_bag.predict_proba(X_tfidf[te_idx])[:, 1])
        u_m5_bagged_var = np.var(np.array(bag_probs), axis=0)

        # Uncertainty 3: Temperature Scaled Entropy (T tuned on inner val)
        inner_tr, inner_val = train_test_split(tr_idx, test_size=0.15, random_state=seed, stratify=labels_id[tr_idx])
        m_inner = LogisticRegression(C=1.0, max_iter=200, random_state=seed).fit(X_tfidf[inner_tr], labels_id[inner_tr])
        p_val = m_inner.predict_proba(X_tfidf[inner_val])[:, 1]
        # Best temperature T
        T_grid = np.linspace(0.5, 3.0, 26)
        best_T, best_nll = 1.0, float("inf")
        for T in T_grid:
            scaled_p = np.clip(p_val ** (1.0 / T) / (p_val ** (1.0 / T) + (1.0 - p_val) ** (1.0 / T)), 1e-7, 1.0 - 1e-7)
            nll = -np.mean(labels_id[inner_val] * np.log(scaled_p) + (1.0 - labels_id[inner_val]) * np.log(1.0 - scaled_p))
            if nll < best_nll:
                best_nll, best_T = nll, T
        p5_scaled = np.clip(p5_te ** (1.0 / best_T) / (p5_te ** (1.0 / best_T) + (1.0 - p5_te) ** (1.0 / best_T)), 1e-7, 1.0 - 1e-7)
        u_m5_temp_ent = - (p5_scaled * np.log(p5_scaled) + (1.0 - p5_scaled) * np.log(1.0 - p5_scaled))

        # ─── 2. Softmax Multi-View ─────────────────────────────────────────────
        m3, m6 = build_models()
        m3.fit([vis_id[tr_idx], seqs_id[tr_idx], tab_tr], y_tr, epochs=8, batch_size=64, verbose=0)
        logits3_te = m3.predict([vis_id[te_idx], seqs_id[te_idx], tab_te], verbose=0)
        probs3_te = tf.nn.softmax(logits3_te).numpy()
        p3_te = probs3_te[:, 1]
        preds_m3 = (p3_te >= 0.5).astype(int)

        u_m3_msp = 1.0 - np.max(probs3_te, axis=-1)
        u_m3_entropy = - np.sum(probs3_te * np.log(np.clip(probs3_te, 1e-7, 1.0)), axis=-1)
        u_m3_energy = - logsumexp(logits3_te, axis=-1)

        # ─── 3. Quish-EDL Multi-View (Vacuity) ─────────────────────────────────
        m6.fit([vis_id[tr_idx], seqs_id[tr_idx], tab_tr], y_tr, epochs=8, batch_size=64, verbose=0)
        a6_te = m6.predict([vis_id[te_idx], seqs_id[te_idx], tab_te], verbose=0)
        S6_te = np.sum(a6_te, axis=-1)
        p6_te = a6_te[:, 1] / S6_te
        preds_m6 = (p6_te >= 0.5).astype(int)
        u_m6_vacuity = 2.0 / S6_te

        # ─── Risk-Coverage (AURC) on M5 Verdict ──────────────────────────────
        rc_m5_margin, aurc_m5_margin, e_aurc_m5_margin = compute_risk_coverage(preds_m5, y_te, u_m5_margin)
        rc_m5_bagged, aurc_m5_bagged, e_aurc_m5_bagged = compute_risk_coverage(preds_m5, y_te, u_m5_bagged_var)
        rc_m5_temp,   aurc_m5_temp,   e_aurc_m5_temp   = compute_risk_coverage(preds_m5, y_te, u_m5_temp_ent)
        rc_m5_edl,    aurc_m5_edl,    e_aurc_m5_edl    = compute_risk_coverage(preds_m5, y_te, u_m6_vacuity)
        rc_m5_energy, aurc_m5_energy, e_aurc_m5_energy = compute_risk_coverage(preds_m5, y_te, u_m3_energy)

        # ─── Zero-Shot OOD Evaluation (Strictly Unseen) ───────────────────────
        # M5 on OOD
        p5_ood = m5.predict_proba(X_tfidf_ood)[:, 1]
        u_m5_margin_ood = 1.0 - np.abs(2.0 * p5_ood - 1.0)
        
        # M3 on OOD
        logits3_ood = m3.predict([vis_ood, seqs_ood, tab_ood_s], verbose=0)
        probs3_ood = tf.nn.softmax(logits3_ood).numpy()
        u_m3_msp_ood = 1.0 - np.max(probs3_ood, axis=-1)
        u_m3_energy_ood = - logsumexp(logits3_ood, axis=-1)

        # M6 on OOD
        a6_ood = m6.predict([vis_ood, seqs_ood, tab_ood_s], verbose=0)
        S6_ood = np.sum(a6_ood, axis=-1)
        u_m6_vacuity_ood = 2.0 / S6_ood

        # Compute OOD AUROC (ID vs OOD)
        y_eval = np.concatenate([np.zeros(len(y_te)), np.ones(len(labels_ood))])
        ood_auroc_m5_margin = float(roc_auc_score(y_eval, np.concatenate([u_m5_margin, u_m5_margin_ood])))
        ood_auroc_m3_msp    = float(roc_auc_score(y_eval, np.concatenate([u_m3_msp, u_m3_msp_ood])))
        ood_auroc_m3_energy = float(roc_auc_score(y_eval, np.concatenate([u_m3_energy, u_m3_energy_ood])))
        ood_auroc_m6_vacuity= float(roc_auc_score(y_eval, np.concatenate([u_m6_vacuity, u_m6_vacuity_ood])))

        # Quarantine rates at thresholds
        quar_rates = {}
        for th in [0.20, 0.30, 0.40]:
            quar_rates[str(th)] = {
                "id_benign_fpqr": float(np.mean(u_m6_vacuity[y_te == 0] > th)),
                "id_phish_quar":  float(np.mean(u_m6_vacuity[y_te == 1] > th)),
                "punycode":       float(np.mean(u_m6_vacuity_ood[families_ood == "punycode_homoglyph"] > th)),
                "redirect":       float(np.mean(u_m6_vacuity_ood[families_ood == "open_redirect"] > th)),
                "conflict":       float(np.mean(u_m6_vacuity_ood[families_ood == "modality_conflict"] > th)),
                "novel_tld":      float(np.mean(u_m6_vacuity_ood[families_ood == "novel_tld"] > th)),
                "branded_benign": float(np.mean(u_m6_vacuity_ood[families_ood == "benign_branded_high_ecl"] > th))
            }

        fold_record = {
            "fold_id": fold_id,
            "seed": seed,
            "fold": fold,
            "in_domain": {
                "m5_auroc": float(roc_auc_score(y_te, p5_te)),
                "m5_acc":   float(accuracy_score(y_te, preds_m5)),
                "m5_ece":   compute_ece(p5_te, y_te),
                "m3_auroc": float(roc_auc_score(y_te, p3_te)),
                "m3_acc":   float(accuracy_score(y_te, preds_m3)),
                "m3_ece":   compute_ece(p3_te, y_te),
                "m6_auroc": float(roc_auc_score(y_te, p6_te)),
                "m6_acc":   float(accuracy_score(y_te, preds_m6)),
                "m6_ece":   compute_ece(p6_te, y_te)
            },
            "aurc": {
                "m5_margin": aurc_m5_margin,
                "e_aurc_m5_margin": e_aurc_m5_margin,
                "m5_bagged": aurc_m5_bagged,
                "e_aurc_m5_bagged": e_aurc_m5_bagged,
                "m5_temp":   aurc_m5_temp,
                "e_aurc_m5_temp": e_aurc_m5_temp,
                "m5_with_edl_vacuity": aurc_m5_edl,
                "e_aurc_m5_with_edl_vacuity": e_aurc_m5_edl,
                "m5_with_energy": aurc_m5_energy,
                "e_aurc_m5_with_energy": e_aurc_m5_energy
            },
            "ood_auroc": {
                "m5_margin": ood_auroc_m5_margin,
                "m3_msp": ood_auroc_m3_msp,
                "m3_energy": ood_auroc_m3_energy,
                "m6_vacuity": ood_auroc_m6_vacuity
            },
            "quarantine_rates": quar_rates
        }
        results["folds"].append(fold_record)
        print(f"  M5 AUROC: {fold_record['in_domain']['m5_auroc']:.4f} | M6 AUROC: {fold_record['in_domain']['m6_auroc']:.4f}")
        print(f"  AURC (M5 Margin): {aurc_m5_margin:.4f} | AURC (M5 + EDL Vacuity): {aurc_m5_edl:.4f}")
        print(f"  Zero-Shot OOD AUROC: M5 Margin={ood_auroc_m5_margin:.4f}, Energy={ood_auroc_m3_energy:.4f}, Vacuity={ood_auroc_m6_vacuity:.4f}")

# ─── Summary & Paired Bootstrap Tests ─────────────────────────────────────────
print("\n" + "=" * 75)
print("AGGREGATE BENCHMARK RESULTS (10 Folds: Mean +/- Std & 95% Bootstrap CIs)")
print("=" * 75)

folds = results["folds"]
m5_aurocs = [f["in_domain"]["m5_auroc"] for f in folds]
m6_aurocs = [f["in_domain"]["m6_auroc"] for f in folds]
m3_aurocs = [f["in_domain"]["m3_auroc"] for f in folds]

aurc_margin = [f["aurc"]["m5_margin"] for f in folds]
aurc_bagged = [f["aurc"]["m5_bagged"] for f in folds]
aurc_temp   = [f["aurc"]["m5_temp"] for f in folds]
aurc_edl    = [f["aurc"]["m5_with_edl_vacuity"] for f in folds]

ood_m5 = [f["ood_auroc"]["m5_margin"] for f in folds]
ood_m3_energy = [f["ood_auroc"]["m3_energy"] for f in folds]
ood_m6_vacuity = [f["ood_auroc"]["m6_vacuity"] for f in folds]

# In-domain paired test
t_auc, p_auc = ttest_rel(m6_aurocs, m5_aurocs)
diff_auc = np.array(m6_aurocs) - np.array(m5_aurocs)
ci_low_auc, ci_high_auc = bootstrap_ci(diff_auc)

# AURC comparison (EDL vacuity vs N-gram margin on M5 verdict)
t_aurc, p_aurc = ttest_rel(aurc_edl, aurc_margin)
diff_aurc = np.array(aurc_edl) - np.array(aurc_margin)
ci_low_aurc, ci_high_aurc = bootstrap_ci(diff_aurc)

results["summary"] = {
    "in_domain": {
        "m5_auroc_mean": float(np.mean(m5_aurocs)),
        "m5_auroc_std": float(np.std(m5_aurocs)),
        "m6_auroc_mean": float(np.mean(m6_aurocs)),
        "m6_auroc_std": float(np.std(m6_aurocs)),
        "m6_minus_m5_diff_mean": float(np.mean(diff_auc)),
        "m6_minus_m5_ci_95": [ci_low_auc, ci_high_auc],
        "m6_vs_m5_paired_t": float(t_auc),
        "m6_vs_m5_p_val": float(p_auc)
    },
    "selective_classification_aurc": {
        "m5_margin_aurc_mean": float(np.mean(aurc_margin)),
        "m5_margin_aurc_std": float(np.std(aurc_margin)),
        "m5_bagged_aurc_mean": float(np.mean(aurc_bagged)),
        "m5_bagged_aurc_std": float(np.std(aurc_bagged)),
        "m5_temp_aurc_mean": float(np.mean(aurc_temp)),
        "m5_temp_aurc_std": float(np.std(aurc_temp)),
        "m5_edl_vacuity_aurc_mean": float(np.mean(aurc_edl)),
        "m5_edl_vacuity_aurc_std": float(np.std(aurc_edl)),
        "edl_vs_margin_diff_mean": float(np.mean(diff_aurc)),
        "edl_vs_margin_ci_95": [ci_low_aurc, ci_high_aurc],
        "edl_vs_margin_paired_t": float(t_aurc),
        "edl_vs_margin_p_val": float(p_aurc)
    },
    "ood_auroc": {
        "m5_margin_mean": float(np.mean(ood_m5)),
        "m5_margin_std": float(np.std(ood_m5)),
        "m3_energy_mean": float(np.mean(ood_m3_energy)),
        "m3_energy_std": float(np.std(ood_m3_energy)),
        "m6_vacuity_mean": float(np.mean(ood_m6_vacuity)),
        "m6_vacuity_std": float(np.std(ood_m6_vacuity))
    }
}

# Save pinned JSON
with open(OUT_JSON, "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print(f"\n[DONE] Pinned benchmark written to: {OUT_JSON}")
print(f"M5 AUROC:       {np.mean(m5_aurocs):.4f} +/- {np.std(m5_aurocs):.4f}")
print(f"M6 AUROC:       {np.mean(m6_aurocs):.4f} +/- {np.std(m6_aurocs):.4f} (Diff: {np.mean(diff_auc):.4f}, 95% CI: [{ci_low_auc:.4f}, {ci_high_auc:.4f}], p={p_auc:.4f})")
print(f"AURC (Margin):  {np.mean(aurc_margin):.4f} +/- {np.std(aurc_margin):.4f}")
print(f"AURC (Bagged):  {np.mean(aurc_bagged):.4f} +/- {np.std(aurc_bagged):.4f}")
print(f"AURC (EDL Vac): {np.mean(aurc_edl):.4f} +/- {np.std(aurc_edl):.4f} (Diff: {np.mean(diff_aurc):.4f}, 95% CI: [{ci_low_aurc:.4f}, {ci_high_aurc:.4f}], p={p_aurc:.4f})")
print(f"OOD AUROC:      M5 Margin={np.mean(ood_m5):.4f}, Energy={np.mean(ood_m3_energy):.4f}, EDL Vacuity={np.mean(ood_m6_vacuity):.4f}")
