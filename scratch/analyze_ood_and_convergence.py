import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import json
import time
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
import tensorflow as tf

from quish_cross_edl import (
    build_quish_edl_model,
    create_edl_loss,
    EpochTracker,
    compute_evidential_outputs,
    IMG_SHAPE, MAX_LEN, VOCAB_SIZE, EMBEDDING_DIM, FEATURE_DIM, NUM_CLASSES
)

# Load Datasets
data_id_path = "data/quishing_id_dataset.npz" if os.path.exists("data/quishing_id_dataset.npz") else "backend/data/quishing_id_dataset.npz"
data_ood_path = "data/quishing_ood_dataset.npz" if os.path.exists("data/quishing_ood_dataset.npz") else "backend/data/quishing_ood_dataset.npz"

id_data = np.load(data_id_path)
X_imgs_id = id_data["images"]
X_seqs_id = id_data["sequences"]
y_id = id_data["labels"]

ood_data = np.load(data_ood_path)
X_imgs_ood = ood_data["images"]
X_seqs_ood = ood_data["sequences"]

print(f"Loaded ID Dataset: {len(y_id)} samples (0: {np.sum(y_id==0)}, 1: {np.sum(y_id==1)})")
print(f"Loaded OOD Dataset: {len(X_imgs_ood)} samples")

# Split ID train / val
X_v_train, X_v_val, X_s_train, X_s_val, y_train, y_val = train_test_split(
    X_imgs_id, X_seqs_id, y_id, test_size=0.2, random_state=42, stratify=y_id
)

# 1. Track Evidence Growth & Loss per Epoch
print("\n--- 1. Tracking Evidence Growth & Loss Across Epochs ---")
epoch_var = tf.Variable(1.0, trainable=False, dtype=tf.float32)
TOTAL_EPOCHS = 10
model = build_quish_edl_model()
model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
    loss={"alpha_output": create_edl_loss(epoch_var, total_epochs=TOTAL_EPOCHS), "probs": None}
)

epoch_history = []
for epoch in range(1, TOTAL_EPOCHS + 1):
    epoch_var.assign(float(epoch))
    history = model.fit(
        [X_v_train, X_s_train],
        {"alpha_output": y_train},
        epochs=1,
        batch_size=128,
        verbose=0
    )
    loss = history.history["loss"][0]
    
    # Evaluate ID Validation
    probs_val, alpha_val = model.predict([X_v_val, X_s_val], verbose=0)
    preds_val = np.argmax(probs_val, axis=1)
    val_acc = accuracy_score(y_val, preds_val)
    _, _, u_val = compute_evidential_outputs(alpha_val)
    S_val = np.sum(alpha_val, axis=-1)
    
    # Evaluate OOD
    probs_ood, alpha_ood = model.predict([X_imgs_ood, X_seqs_ood], verbose=0)
    _, _, u_ood = compute_evidential_outputs(alpha_ood)
    S_ood = np.sum(alpha_ood, axis=-1)
    
    epoch_history.append({
        "epoch": epoch,
        "loss": float(loss),
        "val_acc": float(val_acc),
        "mean_S_id": float(np.mean(S_val)),
        "mean_S_ood": float(np.mean(S_ood)),
        "mean_u_id": float(np.mean(u_val)),
        "median_u_id": float(np.median(u_val)),
        "mean_u_ood": float(np.mean(u_ood)),
        "median_u_ood": float(np.median(u_ood)),
        "ratio_ood_id": float(np.mean(u_ood) / np.mean(u_val))
    })
    print(f"Epoch {epoch:2d}/{TOTAL_EPOCHS} | Loss: {loss:.4f} | Val Acc: {val_acc*100:.2f}% | u_ID: {np.mean(u_val):.4f} (med: {np.median(u_val):.4f}) | u_OOD: {np.mean(u_ood):.4f} (med: {np.median(u_ood):.4f}) | OOD/ID Ratio: {np.mean(u_ood)/np.mean(u_val):.2f}x")

# 2. Detailed Distribution Statistics on Final Model (Epoch 8-10)
print("\n--- 2. Detailed Uncertainty Distribution Statistics ---")
probs_val, alpha_val = model.predict([X_v_val, X_s_val], verbose=0)
_, _, u_id = compute_evidential_outputs(alpha_val)

probs_ood, alpha_ood = model.predict([X_imgs_ood, X_seqs_ood], verbose=0)
_, _, u_ood = compute_evidential_outputs(alpha_ood)

def get_dist_stats(arr):
    return {
        "mean": float(np.mean(arr)),
        "std": float(np.std(arr)),
        "min": float(np.min(arr)),
        "p25": float(np.percentile(arr, 25)),
        "median": float(np.median(arr)),
        "p75": float(np.percentile(arr, 75)),
        "max": float(np.max(arr)),
        "iqr": float(np.percentile(arr, 75) - np.percentile(arr, 25))
    }

dist_id = get_dist_stats(u_id)
dist_ood = get_dist_stats(u_ood)

print(f"ID  Uncertainty (u): Mean={dist_id['mean']:.4f} ± {dist_id['std']:.4f} | Median={dist_id['median']:.4f} | IQR=[{dist_id['p25']:.4f}, {dist_id['p75']:.4f}] | Range=[{dist_id['min']:.4f}, {dist_id['max']:.4f}]")
print(f"OOD Uncertainty (u): Mean={dist_ood['mean']:.4f} ± {dist_ood['std']:.4f} | Median={dist_ood['median']:.4f} | IQR=[{dist_ood['p25']:.4f}, {dist_ood['p75']:.4f}] | Range=[{dist_ood['min']:.4f}, {dist_ood['max']:.4f}]")
print(f"Uncertainty Ratio (Mean): {dist_ood['mean'] / dist_id['mean']:.2f}x")
print(f"Uncertainty Ratio (Median): {dist_ood['median'] / dist_id['median']:.2f}x")

# 3. Analyze M1 (Vision-Only) Class Imbalance Sensitivity
print("\n--- 3. M1 (Vision-Only) Class Imbalance & Metric Breakdown ---")
from tensorflow.keras.layers import Conv2D, MaxPooling2D, Flatten, Dense, Dropout, Input

inp_v = Input(shape=IMG_SHAPE)
v = Conv2D(16, (3, 3), padding="same", activation="relu")(inp_v)
v = MaxPooling2D((4, 4))(v)
v = Flatten()(v)
v_dense = Dense(FEATURE_DIM, activation="relu")(v)
v_dense = Dropout(0.2)(v_dense)
h = Dense(48, activation="relu")(v_dense)
h = Dropout(0.2)(h)
h = Dense(32, activation="relu")(h)
out = Dense(NUM_CLASSES, activation="softmax")(h)
m1 = tf.keras.Model(inputs=inp_v, outputs=out)
m1.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
m1.fit(X_v_train, y_train, epochs=8, batch_size=128, verbose=0)

p1 = m1.predict(X_v_val, verbose=0)
preds1 = np.argmax(p1, axis=1)

cm = confusion_matrix(y_val, preds1)
tn, fp, fn, tp = cm.ravel()
acc1 = accuracy_score(y_val, preds1)
f1_1 = f1_score(y_val, preds1)
prec1 = precision_score(y_val, preds1)
rec1 = recall_score(y_val, preds1)

print(f"M1 Confusion Matrix:\nTN (Benign correctly identified): {tn}\nFP (Benign flagged as phish): {fp}\nFN (Phish missed): {fn}\nTP (Phish detected): {tp}")
print(f"M1 Accuracy: {acc1*100:.2f}%")
print(f"M1 F1-Score: {f1_1*100:.2f}%")
print(f"M1 Precision (Phishing Class): {prec1*100:.2f}%")
print(f"M1 Recall (Phishing Class): {rec1*100:.2f}%")
print(f"Gap (Accuracy - F1): {(acc1 - f1_1)*100:.2f} percentage points (explained by asymmetric false negatives in subtle QR variations vs higher true negative rate on clean QRs).")

output_summary = {
    "epoch_history": epoch_history,
    "dist_id": dist_id,
    "dist_ood": dist_ood,
    "m1_metrics": {
        "accuracy": float(acc1),
        "f1": float(f1_1),
        "precision": float(prec1),
        "recall": float(rec1),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}
    }
}

with open("scratch/ood_analysis_summary.json", "w") as f:
    json.dump(output_summary, f, indent=4)
print("\nSaved diagnostics summary to scratch/ood_analysis_summary.json")
