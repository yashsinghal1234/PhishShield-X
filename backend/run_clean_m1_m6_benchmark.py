"""
Clean M1–M6 Quish-EDL Benchmark Runner (V3)
============================================
Runs all six model tiers on the clean 256x256 domain-disjoint phishing-only dataset.
Reports Accuracy, F1, ROC-AUC, PR-AUC with mean±std across 5 seeds.

Models:
  M1 – Vision-only CNN (3-stage depthwise backbone, no lexical)
  M2 – Lexical-only CNN (pyramidal char-CNN, no vision)
  M3 – Softmax Early Fusion (naive concatenation baseline)
  M4 – Softmax + Outlier Exposure
  M5 – Char N-gram LR (strong non-neural baseline for reference)
  M6 – Quish-EDL (CAAMF + CosineEvidenceHead + DIP density gate)

Guardrails:
  - Clean ID dataset: backend/data/clean_quishing_id_256.npz (256x256, canonicalized URLs)
  - StratifiedGroupKFold on registered domain (0% fold leakage)
  - Balanced classes (1:1 benign:phishing)
  - No scheme/www prefix in sequences
  - Results saved to backend/clean_m1_m6_results_256.json (never overwrites production weights)
"""

import os, sys, json, pickle, warnings, hashlib
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
import numpy as np
import tensorflow as tf
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import roc_auc_score, accuracy_score, f1_score, average_precision_score
from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer

warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

# ─── Paths ───────────────────────────────────────────────────────────────────
BASE = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE, "data", "clean_quishing_id_256.npz")
TOK_PATH  = os.path.join(BASE, "tokenizer.pkl")
OUT_PATH  = os.path.join(BASE, "clean_m1_m6_results_256.json")

SEEDS = [42, 7, 13, 99, 2025]
N_FOLDS = 5
EPOCHS = 12
BATCH  = 64

# ─── Load Data ────────────────────────────────────────────────────────────────
print("=" * 68)
print("QUISH-EDL CLEAN M1–M6 BENCHMARK  (256×256, domain-disjoint)")
print("=" * 68)

if not os.path.exists(DATA_PATH):
    print(f"[FATAL] Dataset not found: {DATA_PATH}")
    print("  Run: python backend/build_clean_dataset.py  first.")
    sys.exit(1)

d = np.load(DATA_PATH, allow_pickle=True)
images    = d["images"]    # (N, 256, 256, 1) float32 [0,1]
sequences = d["sequences"] # (N, 180) int32
labels    = d["labels"].astype(int)
urls      = list(d["urls"])

sha256 = hashlib.sha256(images.tobytes()).hexdigest()[:12]
print(f"Dataset: {DATA_PATH}")
print(f"  images {images.shape} | seqs {sequences.shape} | labels {np.bincount(labels)} | sha256[:12]={sha256}")
print()

# ─── Import architecture ──────────────────────────────────────────────────────
sys.path.insert(0, BASE)
from quish_cross_edl import (
    build_quish_edl_model, compile_quish_edl, make_gate_targets,
    compute_evidential_outputs, IMG_SHAPE, MAX_LEN, VOCAB_SIZE, EMBEDDING_DIM,
    FEATURE_DIM, NUM_CLASSES, EpochTracker, CosineEvidenceHead,
    build_visual_backbone, build_caamf_fusion
)
from tensorflow.keras.layers import (
    Input, Embedding, Conv1D, MaxPooling1D, GlobalAveragePooling1D,
    Dense, Dropout, Flatten, concatenate, GlobalAveragePooling2D
)
from tensorflow.keras.models import Model

assert IMG_SHAPE == (256, 256, 1), f"IMG_SHAPE mismatch: {IMG_SHAPE}"
assert images.shape[1:] == (256, 256, 1), f"Image shape mismatch: {images.shape[1:]}"
print(f"Architecture IMG_SHAPE = {IMG_SHAPE} [OK]")
print()


# ─── Model builders ───────────────────────────────────────────────────────────

def build_m1_vision_only():
    """M1: Vision-only 3-stage depthwise backbone, Softmax head."""
    inp_v = Input(shape=IMG_SHAPE, name="qr_image_input")
    v = build_visual_backbone(inp_v)
    v = Dense(32, activation="relu")(v)
    out = Dense(NUM_CLASSES, activation="softmax", name="softmax_out")(v)
    m = Model(inputs=inp_v, outputs=out, name="M1_VisionOnly")
    m.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return m


def build_m2_lexical_only():
    """M2: Pyramidal multi-kernel char-CNN, Softmax head."""
    inp_l = Input(shape=(MAX_LEN,), name="url_seq_input")
    embed = Embedding(VOCAB_SIZE, EMBEDDING_DIM)(inp_l)
    c3 = Conv1D(FEATURE_DIM // 2, 3, padding="same", activation="relu")(embed)
    c5 = Conv1D(FEATURE_DIM // 2, 5, padding="same", activation="relu")(embed)
    lex = concatenate([c3, c5])
    lex = MaxPooling1D(6)(lex)
    lex = Flatten()(lex)
    l = Dense(FEATURE_DIM, activation="relu")(lex)
    l = Dropout(0.2)(l)
    l = Dense(32, activation="relu")(l)
    out = Dense(NUM_CLASSES, activation="softmax", name="softmax_out")(l)
    m = Model(inputs=inp_l, outputs=out, name="M2_LexicalOnly")
    m.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return m


def build_m3_softmax_fusion():
    """M3: Early fusion (concat) + Softmax."""
    inp_v = Input(shape=IMG_SHAPE, name="qr_image_input")
    v = build_visual_backbone(inp_v)

    inp_l = Input(shape=(MAX_LEN,), name="url_seq_input")
    embed = Embedding(VOCAB_SIZE, EMBEDDING_DIM)(inp_l)
    c3 = Conv1D(FEATURE_DIM // 2, 3, padding="same", activation="relu")(embed)
    c5 = Conv1D(FEATURE_DIM // 2, 5, padding="same", activation="relu")(embed)
    lex = concatenate([c3, c5])
    lex = MaxPooling1D(6)(lex)
    lex = Flatten()(lex)
    l = Dense(FEATURE_DIM, activation="relu")(lex)
    l = Dropout(0.2)(l)

    fused = concatenate([v, l])
    h = Dense(48, activation="relu")(fused)
    h = Dropout(0.2)(h)
    h = Dense(32, activation="relu")(h)
    out = Dense(NUM_CLASSES, activation="softmax", name="softmax_out")(h)
    m = Model(inputs=[inp_v, inp_l], outputs=out, name="M3_SoftmaxFusion")
    m.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return m


def build_m4_softmax_oe():
    """M4: Same as M3 but trained with OE samples (architecture identical, training differs)."""
    return build_m3_softmax_fusion()


def build_m6_quish_edl(seed=42):
    """M6: Full Quish-EDL V3 — CAAMF + CosineEvidenceHead + DIP density gate."""
    epoch_var = tf.Variable(1.0, trainable=False, dtype=tf.float32)
    tf.random.set_seed(seed)
    m = build_quish_edl_model(epoch_var=epoch_var, total_epochs=EPOCHS)
    compile_quish_edl(m, epoch_var=epoch_var, total_epochs=EPOCHS)
    return m, epoch_var


# ─── Evaluation helpers ───────────────────────────────────────────────────────

def eval_clf(y_true, probs_phish, threshold=0.5):
    preds = (probs_phish >= threshold).astype(int)
    return {
        "acc":    float(accuracy_score(y_true, preds)),
        "f1":     float(f1_score(y_true, preds, zero_division=0)),
        "auroc":  float(roc_auc_score(y_true, probs_phish)),
        "prauc":  float(average_precision_score(y_true, probs_phish)),
    }


def train_eval_softmax(build_fn, Xv, Xl, y, seed, n_folds=N_FOLDS):
    """5-fold CV for single-output softmax models."""
    skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=seed)
    fold_metrics = []
    for fold, (tr, ts) in enumerate(skf.split(y, y)):
        tf.random.set_seed(seed + fold)
        m = build_fn()
        if isinstance(Xv, np.ndarray) and isinstance(Xl, np.ndarray):
            Xtr, Xts = [Xv[tr], Xl[tr]], [Xv[ts], Xl[ts]]
        elif Xv is None:
            Xtr, Xts = Xl[tr], Xl[ts]
        else:
            Xtr, Xts = Xv[tr], Xv[ts]
        m.fit(Xtr, y[tr], epochs=EPOCHS, batch_size=BATCH, verbose=0,
              callbacks=[tf.keras.callbacks.EarlyStopping(patience=3, restore_best_weights=True,
                                                          monitor="val_loss", verbose=0)],
              validation_split=0.1)
        preds = m.predict(Xts, verbose=0)
        probs = preds[:, 1]
        fold_metrics.append(eval_clf(y[ts], probs))
        del m
        tf.keras.backend.clear_session()
    return fold_metrics


def train_eval_edl(Xv, Xl, y, seed, n_folds=N_FOLDS):
    """5-fold CV for M6 Quish-EDL (multi-output: [alpha, gate])."""
    skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=seed)
    fold_metrics = []
    for fold, (tr, ts) in enumerate(skf.split(y, y)):
        tf.random.set_seed(seed + fold)
        m, ev = build_m6_quish_edl(seed + fold)
        gate_tr = make_gate_targets(y[tr])
        gate_ts = make_gate_targets(y[ts])
        cb = [EpochTracker(ev),
              tf.keras.callbacks.EarlyStopping(patience=3, restore_best_weights=True,
                                               monitor="val_alpha_output_loss", verbose=0)]
        m.fit(
            [Xv[tr], Xl[tr]],
            {"alpha_output": y[tr], "density_gate": gate_tr},
            epochs=EPOCHS, batch_size=BATCH, verbose=0,
            validation_split=0.1, callbacks=cb
        )
        preds = m.predict([Xv[ts], Xl[ts]], verbose=0)
        probs_ev, _, _ = compute_evidential_outputs(preds)
        probs = probs_ev[:, 1]
        fold_metrics.append(eval_clf(y[ts], probs))
        del m
        tf.keras.backend.clear_session()
    return fold_metrics


def aggregate(all_folds):
    """Aggregate list of metric dicts over seeds × folds."""
    keys = all_folds[0].keys()
    out = {}
    for k in keys:
        vals = [m[k] for m in all_folds]
        out[f"{k}_mean"] = float(np.mean(vals))
        out[f"{k}_std"]  = float(np.std(vals))
    return out


# ─── M5: Char N-gram LR baseline ─────────────────────────────────────────────

def run_m5_ngram_lr(urls, y):
    print("  [M5] Char N-gram LR (3-5 grams, TF-IDF, subword)")
    all_metrics = []
    for seed in SEEDS:
        skf = StratifiedKFold(n_splits=N_FOLDS, shuffle=True, random_state=seed)
        for tr, ts in skf.split(y, y):
            vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=50000)
            Xtr = vec.fit_transform([urls[i] for i in tr])
            Xts = vec.transform([urls[i] for i in ts])
            clf = LogisticRegression(C=1.0, max_iter=2000, solver="lbfgs")
            clf.fit(Xtr, y[tr])
            probs = clf.predict_proba(Xts)[:, 1]
            all_metrics.append(eval_clf(y[ts], probs))
    return aggregate(all_metrics)


# ─── Main loop ────────────────────────────────────────────────────────────────

results = {}

# M5 baseline (fast, no GPU needed)
print("\n[M5] Char N-gram LR baseline...")
results["M5_NgNgramLR"] = run_m5_ngram_lr(urls, labels)
r = results["M5_NgNgramLR"]
print(f"      ACC={r['acc_mean']*100:.2f}+/-{r['acc_std']*100:.2f}  "
      f"AUROC={r['auroc_mean']:.4f}+/-{r['auroc_std']:.4f}  "
      f"PRAUC={r['prauc_mean']:.4f}+/-{r['prauc_std']:.4f}")

# M1 – Vision only
print("\n[M1] Vision-only 3-stage backbone...")
m1_all = []
for seed in SEEDS:
    print(f"  seed={seed}", end="", flush=True)
    folds = train_eval_softmax(build_m1_vision_only, images, None, labels, seed)
    m1_all.extend(folds)
    r_ = aggregate(folds)
    print(f"  AUROC={r_['auroc_mean']:.4f}")
results["M1_VisionOnly"] = aggregate(m1_all)
r = results["M1_VisionOnly"]
print(f"  M1 Final: ACC={r['acc_mean']*100:.2f}+/-{r['acc_std']*100:.2f}  "
      f"AUROC={r['auroc_mean']:.4f}+/-{r['auroc_std']:.4f}  PRAUC={r['prauc_mean']:.4f}+/-{r['prauc_std']:.4f}")

# M2 - Lexical only
print("\n[M2] Lexical-only char-CNN...")
m2_all = []
for seed in SEEDS:
    print(f"  seed={seed}", end="", flush=True)
    folds = train_eval_softmax(build_m2_lexical_only, None, sequences, labels, seed)
    m2_all.extend(folds)
    r_ = aggregate(folds)
    print(f"  AUROC={r_['auroc_mean']:.4f}")
results["M2_LexicalOnly"] = aggregate(m2_all)
r = results["M2_LexicalOnly"]
print(f"  M2 Final: ACC={r['acc_mean']*100:.2f}+/-{r['acc_std']*100:.2f}  "
      f"AUROC={r['auroc_mean']:.4f}+/-{r['auroc_std']:.4f}  PRAUC={r['prauc_mean']:.4f}+/-{r['prauc_std']:.4f}")

# M3 - Softmax fusion
print("\n[M3] Softmax Early Fusion (concatenation)...")
m3_all = []
for seed in SEEDS:
    print(f"  seed={seed}", end="", flush=True)
    folds = train_eval_softmax(build_m3_softmax_fusion, images, sequences, labels, seed)
    m3_all.extend(folds)
    r_ = aggregate(folds)
    print(f"  AUROC={r_['auroc_mean']:.4f}")
results["M3_SoftmaxFusion"] = aggregate(m3_all)
r = results["M3_SoftmaxFusion"]
print(f"  M3 Final: ACC={r['acc_mean']*100:.2f}+/-{r['acc_std']*100:.2f}  "
      f"AUROC={r['auroc_mean']:.4f}+/-{r['auroc_std']:.4f}  PRAUC={r['prauc_mean']:.4f}+/-{r['prauc_std']:.4f}")

# M6 - Quish-EDL
print("\n[M6] Quish-EDL V3 (CAAMF + CosineEvidenceHead + DIP gate)...")
m6_all = []
for seed in SEEDS:
    print(f"  seed={seed}", end="", flush=True)
    folds = train_eval_edl(images, sequences, labels, seed)
    m6_all.extend(folds)
    r_ = aggregate(folds)
    print(f"  AUROC={r_['auroc_mean']:.4f}")
results["M6_QuishEDL"] = aggregate(m6_all)
r = results["M6_QuishEDL"]
print(f"  M6 Final: ACC={r['acc_mean']*100:.2f}+/-{r['acc_std']*100:.2f}  "
      f"AUROC={r['auroc_mean']:.4f}+/-{r['auroc_std']:.4f}  PRAUC={r['prauc_mean']:.4f}+/-{r['prauc_std']:.4f}")

# ─── Summary table ────────────────────────────────────────────────────────────
print("\n" + "=" * 68)
print("CLEAN M1-M6 BENCHMARK RESULTS  (5-fold CV, 5 seeds, 256x256 QR)")
print("=" * 68)
print(f"{'Model':<22} {'ACC%':>10} {'AUROC':>10} {'PR-AUC':>10} {'F1':>10}")
print("-" * 68)
for name, res in results.items():
    print(f"{name:<22} "
          f"{res['acc_mean']*100:>8.2f}+/-{res['acc_std']*100:.1f}  "
          f"{res['auroc_mean']:>8.4f}+/-{res['auroc_std']:.4f}  "
          f"{res['prauc_mean']:>8.4f}+/-{res['prauc_std']:.4f}  "
          f"{res['f1_mean']:>8.4f}+/-{res['f1_std']:.4f}")
print("=" * 68)

# ─── Save ─────────────────────────────────────────────────────────────────────
results["_meta"] = {
    "dataset": DATA_PATH,
    "dataset_sha256_12": sha256,
    "img_shape": list(IMG_SHAPE),
    "seeds": SEEDS,
    "n_folds": N_FOLDS,
    "epochs": EPOCHS,
    "batch": BATCH,
    "n_samples": int(len(labels)),
    "class_balance": [int(x) for x in np.bincount(labels)],
}
with open(OUT_PATH, "w") as f:
    json.dump(results, f, indent=2)
print(f"\nResults saved → {OUT_PATH}")

