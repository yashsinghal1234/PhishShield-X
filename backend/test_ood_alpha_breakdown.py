import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
import numpy as np
import tensorflow as tf
from quish_cross_edl import build_quish_edl_model, compute_evidential_outputs

# Load datasets
data_id = np.load("data/quishing_id_dataset.npz" if os.path.exists("data/quishing_id_dataset.npz") else "backend/data/quishing_id_dataset.npz")
data_ood = np.load("data/quishing_ood_dataset.npz" if os.path.exists("data/quishing_ood_dataset.npz") else "backend/data/quishing_ood_dataset.npz")

X_imgs_id, X_seqs_id, y_id = data_id["images"], data_id["sequences"], data_id["labels"]
X_imgs_ood, X_seqs_ood = data_ood["images"], data_ood["sequences"]

from quish_cross_edl import create_edl_loss, EpochTracker
epoch_var = tf.Variable(1.0, trainable=False, dtype=tf.float32)
model = build_quish_edl_model()
model.compile(optimizer=tf.keras.optimizers.Adam(0.001), loss=create_edl_loss(epoch_var, total_epochs=8))
model.fit([X_imgs_id[:2400], X_seqs_id[:2400]], y_id[:2400], epochs=8, batch_size=64, callbacks=[EpochTracker(epoch_var)], verbose=0)

alpha_id = model.predict([X_imgs_id[2400:], X_seqs_id[2400:]], verbose=0)
alpha_ood = model.predict([X_imgs_ood, X_seqs_ood], verbose=0)

print(f"ID  alpha_0 mean: {np.mean(alpha_id[:, 0]):.4f}, alpha_1 mean: {np.mean(alpha_id[:, 1]):.4f}, total S mean: {np.mean(np.sum(alpha_id, axis=-1)):.4f}")
print(f"OOD alpha_0 mean: {np.mean(alpha_ood[:, 0]):.4f}, alpha_1 mean: {np.mean(alpha_ood[:, 1]):.4f}, total S mean: {np.mean(np.sum(alpha_ood, axis=-1)):.4f}")

probs_ood, beliefs_ood, u_ood = compute_evidential_outputs(alpha_ood)
probs_id, beliefs_id, u_id = compute_evidential_outputs(alpha_id)

print(f"ID  predicted class distribution: Class 0 = {np.sum(np.argmax(probs_id, axis=1)==0)}, Class 1 = {np.sum(np.argmax(probs_id, axis=1)==1)}")
print(f"OOD predicted class distribution: Class 0 = {np.sum(np.argmax(probs_ood, axis=1)==0)}, Class 1 = {np.sum(np.argmax(probs_ood, axis=1)==1)}")
print(f"ID  Mean uncertainty u: {np.mean(u_id):.4f}")
print(f"OOD Mean uncertainty u: {np.mean(u_ood):.4f}")
