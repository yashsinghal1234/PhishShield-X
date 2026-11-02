"""
Fast Clean M1–M6 Benchmark & OOD Evaluation
============================================
Evaluates all model tiers (M1–M6) on the clean 256x256 dataset and OOD zero-day benchmark.
Uses a single 80/20 train/test split for fast, direct results (<2.5 minutes total runtime).

Models:
  M1: Vision-Only 3-stage depthwise backbone
  M2: Lexical-Only Pyramidal char-CNN
  M3: Softmax Early Fusion (naive concatenation)
  M4: Softmax + Outlier Exposure (OE)
  M5: Non-neural baseline (Char N-gram LR)
  M6: Quish-EDL v3 (CAAMF + CosineEvidenceHead + DIP Density Gate)

Metrics:
  ID: Accuracy, F1-Score, AUROC, PR-AUC, Brier Score, ECE
  OOD: OOD Detection AUROC, Mean Uncertainty / Entropy by Evasion Family
"""

import os, sys, json, pickle, warnings, time
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import numpy as np
import tensorflow as tf
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import roc_auc_score, accuracy_score, f1_score, average_precision_score, brier_score_loss
from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer

warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

BASE = os.path.dirname(os.path.abspath(__file__))
ID_PATH = os.path.join(BASE, "data", "clean_quishing_id_256.npz")
OOD_PATH = os.path.join(BASE, "data", "clean_quishing_ood_256.npz")
OUT_PATH = os.path.join(BASE, "clean_m1_m6_fast_results.json")

print("=" * 72)
print("FAST CLEAN M1-M6 BENCHMARK & MULTI-FAMILY ZERO-DAY EVALUATION (256x256)")
print("=" * 72)

# Load ID Dataset
d_id = np.load(ID_PATH, allow_pickle=True)
images_id = d_id["images"]
seqs_id = d_id["sequences"]
labels_id = d_id["labels"].astype(int)
urls_id = list(d_id["urls"])
print(f"ID Dataset: {images_id.shape[0]} samples (Safe: {np.sum(labels_id==0)}, Phish: {np.sum(labels_id==1)})")

# Load OOD Dataset
d_ood = np.load(OOD_PATH, allow_pickle=True)
images_ood = d_ood["images"]
seqs_ood = d_ood["sequences"]
labels_ood = d_ood["labels"].astype(int)
families_ood = list(d_ood["families"])
print(f"OOD Dataset: {images_ood.shape[0]} zero-day evasion samples across {len(set(families_ood))} families")

# 80/20 Split
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
train_idx, test_idx = next(skf.split(labels_id, labels_id))

Xv_tr, Xv_ts = images_id[train_idx], images_id[test_idx]
Xl_tr, Xl_ts = seqs_id[train_idx], seqs_id[test_idx]
y_tr, y_ts = labels_id[train_idx], labels_id[test_idx]
urls_tr = [urls_id[i] for i in train_idx]
urls_ts = [urls_id[i] for i in test_idx]

print(f"Train set: {len(train_idx)} | Test set: {len(test_idx)}")
print("=" * 72)

sys.path.insert(0, BASE)
from quish_cross_edl import (
    build_quish_edl_model, compile_quish_edl, make_gate_targets,
    compute_evidential_outputs, IMG_SHAPE, MAX_LEN, VOCAB_SIZE, EMBEDDING_DIM,
    FEATURE_DIM, NUM_CLASSES, EpochTracker, CosineEvidenceHead,
    build_visual_backbone, build_caamf_fusion
)
from tensorflow.keras.layers import Input, Embedding, Conv1D, MaxPooling1D, Dense, Dropout, Flatten, concatenate
from tensorflow.keras.models import Model

# Helpers
def compute_ece(y_true, probs, n_bins=10):
    bin_limits = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for i in range(n_bins):
        in_bin = (probs >= bin_limits[i]) & (probs < bin_limits[i+1])
        if np.sum(in_bin) > 0:
            bin_acc = np.mean(y_true[in_bin] == (probs[in_bin] >= 0.5))
            bin_conf = np.mean(np.maximum(probs[in_bin], 1.0 - probs[in_bin]))
            ece += np.abs(bin_acc - bin_conf) * (np.sum(in_bin) / len(y_true))
    return float(ece)

def eval_id_metrics(y_true, probs_phish):
    preds = (probs_phish >= 0.5).astype(int)
    return {
        "acc": float(accuracy_score(y_true, preds)),
        "f1": float(f1_score(y_true, preds, zero_division=0)),
        "auroc": float(roc_auc_score(y_true, probs_phish)),
        "prauc": float(average_precision_score(y_true, probs_phish)),
        "brier": float(brier_score_loss(y_true, probs_phish)),
        "ece": compute_ece(y_true, probs_phish),
    }

def eval_ood_metrics(id_unc, ood_unc):
    # Higher uncertainty/entropy on OOD -> good OOD detector
    y_ood_eval = np.array([0] * len(id_unc) + [1] * len(ood_unc))
    scores_ood = np.concatenate([id_unc, ood_unc])
    return float(roc_auc_score(y_ood_eval, scores_ood))

results = {}
t0_all = time.time()

# ─────────────────────────────────────────────────────────────────────────────
# M5: Non-Neural Char N-Gram Baseline
# ─────────────────────────────────────────────────────────────────────────────
print("\n[1/6] Running M5: Char N-Gram Logistic Regression...")
vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=50000)
Xtr_vec = vec.fit_transform(urls_tr)
Xts_vec = vec.transform(urls_ts)
lr = LogisticRegression(C=1.0, max_iter=2000, solver="lbfgs")
lr.fit(Xtr_vec, y_tr)
probs_m5 = lr.predict_proba(Xts_vec)[:, 1]
m5_res = eval_id_metrics(y_ts, probs_m5)
# Entropy as uncertainty for M5
p_clamped = np.clip(probs_m5, 1e-7, 1 - 1e-7)
ent_id_m5 = -(p_clamped * np.log2(p_clamped) + (1 - p_clamped) * np.log2(1 - p_clamped))
Xood_vec = vec.transform(d_ood["payloads"])
probs_ood_m5 = lr.predict_proba(Xood_vec)[:, 1]
p_ood_c = np.clip(probs_ood_m5, 1e-7, 1 - 1e-7)
ent_ood_m5 = -(p_ood_c * np.log2(p_ood_c) + (1 - p_ood_c) * np.log2(1 - p_ood_c))
m5_res["ood_auroc"] = eval_ood_metrics(ent_id_m5, ent_ood_m5)
results["M5_NgNgramLR"] = m5_res
print(f"  M5 -> ACC: {m5_res['acc']*100:.2f}% | AUROC: {m5_res['auroc']:.4f} | PR-AUC: {m5_res['prauc']:.4f} | OOD-AUROC: {m5_res['ood_auroc']:.4f}")

# ─────────────────────────────────────────────────────────────────────────────
# M1: Vision-Only 3-Stage Backbone
# ─────────────────────────────────────────────────────────────────────────────
print("\n[2/6] Training M1: Vision-Only 3-Stage Backbone...")
inp_v = Input(shape=IMG_SHAPE, name="qr_image_input")
v = build_visual_backbone(inp_v)
v = Dense(32, activation="relu")(v)
out_v = Dense(NUM_CLASSES, activation="softmax")(v)
m1 = Model(inputs=inp_v, outputs=out_v, name="M1_VisionOnly")
m1.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
m1.fit(Xv_tr, y_tr, epochs=6, batch_size=64, verbose=0, validation_split=0.1)
probs_m1 = m1.predict(Xv_ts, verbose=0)[:, 1]
m1_res = eval_id_metrics(y_ts, probs_m1)
results["M1_VisionOnly"] = m1_res
print(f"  M1 -> ACC: {m1_res['acc']*100:.2f}% | AUROC: {m1_res['auroc']:.4f} | PR-AUC: {m1_res['prauc']:.4f}")

# ─────────────────────────────────────────────────────────────────────────────
# M2: Lexical-Only Char-CNN
# ─────────────────────────────────────────────────────────────────────────────
print("\n[3/6] Training M2: Lexical-Only Pyramidal Char-CNN...")
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
out_l = Dense(NUM_CLASSES, activation="softmax")(l)
m2 = Model(inputs=inp_l, outputs=out_l, name="M2_LexicalOnly")
m2.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
m2.fit(Xl_tr, y_tr, epochs=8, batch_size=64, verbose=0, validation_split=0.1)
probs_m2 = m2.predict(Xl_ts, verbose=0)[:, 1]
m2_res = eval_id_metrics(y_ts, probs_m2)
results["M2_LexicalOnly"] = m2_res
print(f"  M2 -> ACC: {m2_res['acc']*100:.2f}% | AUROC: {m2_res['auroc']:.4f} | PR-AUC: {m2_res['prauc']:.4f}")

# ─────────────────────────────────────────────────────────────────────────────
# M3: Early Fusion Softmax
# ─────────────────────────────────────────────────────────────────────────────
print("\n[4/6] Training M3: Softmax Early Fusion (Concatenation)...")
inp_v3 = Input(shape=IMG_SHAPE, name="qr_image_input")
v3 = build_visual_backbone(inp_v3)
inp_l3 = Input(shape=(MAX_LEN,), name="url_seq_input")
embed3 = Embedding(VOCAB_SIZE, EMBEDDING_DIM)(inp_l3)
c3_3 = Conv1D(FEATURE_DIM // 2, 3, padding="same", activation="relu")(embed3)
c5_3 = Conv1D(FEATURE_DIM // 2, 5, padding="same", activation="relu")(embed3)
lex3 = concatenate([c3_3, c5_3])
lex3 = MaxPooling1D(6)(lex3)
lex3 = Flatten()(lex3)
l3 = Dense(FEATURE_DIM, activation="relu")(lex3)
l3 = Dropout(0.2)(l3)
fused3 = concatenate([v3, l3])
h3 = Dense(48, activation="relu")(fused3)
h3 = Dropout(0.2)(h3)
h3 = Dense(32, activation="relu")(h3)
out3 = Dense(NUM_CLASSES, activation="softmax")(h3)
m3 = Model(inputs=[inp_v3, inp_l3], outputs=out3, name="M3_SoftmaxFusion")
m3.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
m3.fit([Xv_tr, Xl_tr], y_tr, epochs=8, batch_size=64, verbose=0, validation_split=0.1)
probs_m3 = m3.predict([Xv_ts, Xl_ts], verbose=0)[:, 1]
m3_res = eval_id_metrics(y_ts, probs_m3)
p3_c = np.clip(probs_m3, 1e-7, 1 - 1e-7)
ent_id_m3 = -(p3_c * np.log2(p3_c) + (1 - p3_c) * np.log2(1 - p3_c))
probs_ood_m3 = m3.predict([images_ood, seqs_ood], verbose=0)[:, 1]
p3_ood_c = np.clip(probs_ood_m3, 1e-7, 1 - 1e-7)
ent_ood_m3 = -(p3_ood_c * np.log2(p3_ood_c) + (1 - p3_ood_c) * np.log2(1 - p3_ood_c))
m3_res["ood_auroc"] = eval_ood_metrics(ent_id_m3, ent_ood_m3)
results["M3_SoftmaxFusion"] = m3_res
print(f"  M3 -> ACC: {m3_res['acc']*100:.2f}% | AUROC: {m3_res['auroc']:.4f} | PR-AUC: {m3_res['prauc']:.4f} | OOD-AUROC: {m3_res['ood_auroc']:.4f}")

# ─────────────────────────────────────────────────────────────────────────────
# M4: Softmax + Outlier Exposure (OE)
# ─────────────────────────────────────────────────────────────────────────────
print("\n[5/6] Training M4: Softmax + Outlier Exposure...")
# Mix 200 OOD samples into training as OE (uniform soft targets)
n_oe = 200
Xv_oe = np.concatenate([Xv_tr, images_ood[:n_oe]])
Xl_oe = np.concatenate([Xl_tr, seqs_ood[:n_oe]])
# One-hot targets: ID gets [1,0] or [0,1], OE gets [0.5, 0.5]
y_tr_oh = tf.one_hot(y_tr, depth=2).numpy()
y_oe_oh = np.ones((n_oe, 2), dtype=np.float32) * 0.5
y_combined_oh = np.concatenate([y_tr_oh, y_oe_oh])

inp_v4 = Input(shape=IMG_SHAPE, name="qr_image_input")
v4 = build_visual_backbone(inp_v4)
inp_l4 = Input(shape=(MAX_LEN,), name="url_seq_input")
embed4 = Embedding(VOCAB_SIZE, EMBEDDING_DIM)(inp_l4)
c3_4 = Conv1D(FEATURE_DIM // 2, 3, padding="same", activation="relu")(embed4)
c5_4 = Conv1D(FEATURE_DIM // 2, 5, padding="same", activation="relu")(embed4)
lex4 = concatenate([c3_4, c5_4])
lex4 = MaxPooling1D(6)(lex4)
lex4 = Flatten()(lex4)
l4 = Dense(FEATURE_DIM, activation="relu")(lex4)
fused4 = concatenate([v4, l4])
h4 = Dense(48, activation="relu")(fused4)
h4 = Dropout(0.2)(h4)
out4 = Dense(NUM_CLASSES, activation="softmax")(h4)
m4 = Model(inputs=[inp_v4, inp_l4], outputs=out4, name="M4_Softmax_OE")
m4.compile(optimizer="adam", loss="categorical_crossentropy", metrics=["accuracy"])
m4.fit([Xv_oe, Xl_oe], y_combined_oh, epochs=8, batch_size=64, verbose=0, validation_split=0.1)
probs_m4 = m4.predict([Xv_ts, Xl_ts], verbose=0)[:, 1]
m4_res = eval_id_metrics(y_ts, probs_m4)
p4_c = np.clip(probs_m4, 1e-7, 1 - 1e-7)
ent_id_m4 = -(p4_c * np.log2(p4_c) + (1 - p4_c) * np.log2(1 - p4_c))
probs_ood_m4 = m4.predict([images_ood[n_oe:], seqs_ood[n_oe:]], verbose=0)[:, 1]
p4_ood_c = np.clip(probs_ood_m4, 1e-7, 1 - 1e-7)
ent_ood_m4 = -(p4_ood_c * np.log2(p4_ood_c) + (1 - p4_ood_c) * np.log2(1 - p4_ood_c))
m4_res["ood_auroc"] = eval_ood_metrics(ent_id_m4, ent_ood_m4)
results["M4_Softmax_OE"] = m4_res
print(f"  M4 -> ACC: {m4_res['acc']*100:.2f}% | AUROC: {m4_res['auroc']:.4f} | PR-AUC: {m4_res['prauc']:.4f} | OOD-AUROC: {m4_res['ood_auroc']:.4f}")

# ─────────────────────────────────────────────────────────────────────────────
# M6: Quish-EDL v3 (CAAMF + CosineEvidenceHead + DIP Gate)
# ─────────────────────────────────────────────────────────────────────────────
print("\n[6/6] Training M6: Quish-EDL v3 (CAAMF + Cosine Evidence + DIP Gate)...")
epoch_var = tf.Variable(1.0, trainable=False, dtype=tf.float32)
m6 = build_quish_edl_model(epoch_var=epoch_var, total_epochs=8)
compile_quish_edl(m6, epoch_var=epoch_var, total_epochs=8)
gate_tr = make_gate_targets(y_tr)
cb = [EpochTracker(epoch_var)]
m6.fit(
    [Xv_tr, Xl_tr],
    {"alpha_output": y_tr, "density_gate": gate_tr},
    epochs=8, batch_size=64, verbose=0,
    validation_split=0.1, callbacks=cb
)
preds_m6_id = m6.predict([Xv_ts, Xl_ts], verbose=0)
probs_m6_id, beliefs_id, unc_m6_id = compute_evidential_outputs(preds_m6_id)
probs_phish_m6 = probs_m6_id[:, 1]
m6_res = eval_id_metrics(y_ts, probs_phish_m6)

# OOD Evaluation for M6
preds_m6_ood = m6.predict([images_ood, seqs_ood], verbose=0)
probs_m6_ood, beliefs_ood, unc_m6_ood = compute_evidential_outputs(preds_m6_ood)
m6_res["ood_auroc"] = eval_ood_metrics(unc_m6_id, unc_m6_ood)
m6_res["u_mean_id"] = float(np.mean(unc_m6_id))
m6_res["u_mean_ood"] = float(np.mean(unc_m6_ood))
m6_res["u_ratio"] = float(np.mean(unc_m6_ood) / max(1e-4, np.mean(unc_m6_id)))
results["M6_QuishEDL_v3"] = m6_res
print(f"  M6 -> ACC: {m6_res['acc']*100:.2f}% | AUROC: {m6_res['auroc']:.4f} | PR-AUC: {m6_res['prauc']:.4f} | OOD-AUROC: {m6_res['ood_auroc']:.4f} | U-Ratio: {m6_res['u_ratio']:.2f}x")

# Family Breakdown for OOD
family_breakdown = {}
for fam in sorted(set(families_ood)):
    fam_mask = np.array([f == fam for f in families_ood])
    fam_unc_m6 = unc_m6_ood[fam_mask]
    fam_probs_m6 = probs_m6_ood[fam_mask, 1]
    fam_probs_m3 = probs_ood_m3[fam_mask]
    fam_ent_m3 = ent_ood_m3[fam_mask]
    family_breakdown[fam] = {
        "m6_mean_uncertainty": float(np.mean(fam_unc_m6)),
        "m6_mean_phish_prob": float(np.mean(fam_probs_m6)),
        "m3_mean_entropy": float(np.mean(fam_ent_m3)),
        "m3_mean_phish_prob": float(np.mean(fam_probs_m3)),
    }
results["family_breakdown"] = family_breakdown

t_total = time.time() - t0_all
print(f"\nAll models completed in {t_total:.1f} seconds!")

# Summary Table
print("\n" + "=" * 78)
print(f"{'Model':<18} {'ACC%':>8} {'AUROC':>8} {'PR-AUC':>8} {'Brier':>8} {'ECE':>8} {'OOD-AUC':>8}")
print("-" * 78)
for name, r in results.items():
    if name == "family_breakdown":
        continue
    ood_s = f"{r.get('ood_auroc', 0.0):.4f}" if 'ood_auroc' in r else "N/A"
    print(f"{name:<18} {r['acc']*100:>7.2f}% {r['auroc']:>8.4f} {r['prauc']:>8.4f} {r['brier']:>8.4f} {r['ece']:>8.4f} {ood_s:>8}")
print("=" * 78)

print("\n--- ZERO-DAY EVASION FAMILY UNCERTAINTY BREAKDOWN ---")
for fam, fb in family_breakdown.items():
    print(f"  {fam:<26} -> M6 Mean Uncertainty: {fb['m6_mean_uncertainty']:.4f} | M6 P(Phish): {fb['m6_mean_phish_prob']:.4f}")

# Save JSON
with open(OUT_PATH, "w") as f:
    json.dump(results, f, indent=2)
print(f"\nResults successfully written to {OUT_PATH}")

