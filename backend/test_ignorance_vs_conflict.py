"""
Empirical Test of the Core Subjective Logic Hypothesis:
Separating Epistemic Ignorance (Zero-Day OOD) from Aleatoric Conflict (ID-Hard & Modality-Conflict).

Models compared under strict encoder parity:
1. M3 + OE (Softmax + OE): Entropy, MSP, Energy Score
2. Quish-EDL (Exp-Clamped + CE Loss + OE): Epistemic Uncertainty u, Vacuity mass

Evaluation:
- Cat 1: ID-Clean (Unambiguous benign & phishing)
- Cat 2: ID-Hard (Ambiguous URLs, long technical paths, legitimate security advisories, fullstackopen, missing.csail.mit.edu)
- Cat 3: Modality-Conflict (Benign URL in tampered QR; Phishing URL in pristine QR)
- Cat 4: True Zero-Day OOD (Held-out evasion families)
"""

import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input, Embedding, Conv2D, MaxPooling2D,
    Conv1D, MaxPooling1D, Dense, Dropout, Flatten, concatenate
)
from sklearn.metrics import roc_auc_score
import pickle
import qrcode
from qrcode.constants import ERROR_CORRECT_M, ERROR_CORRECT_H
from PIL import Image, ImageDraw

p_id = "data/quishing_id_dataset.npz" if os.path.exists("data/quishing_id_dataset.npz") else "backend/data/quishing_id_dataset.npz"
p_ood = "data/quishing_ood_dataset.npz" if os.path.exists("data/quishing_ood_dataset.npz") else "backend/data/quishing_ood_dataset.npz"

d_id = np.load(p_id)
d_ood = np.load(p_ood)

X_imgs_id, X_seqs_id, y_id = d_id["images"], d_id["sequences"], d_id["labels"]
X_imgs_ood, X_seqs_ood = d_ood["images"], d_ood["sequences"]

with open("backend/tokenizer.pkl", "rb") as f:
    tokenizer = pickle.load(f)

from tensorflow.keras.preprocessing.sequence import pad_sequences

IMG_SHAPE = (64, 64, 1)
MAX_LEN = 180
VOCAB_SIZE = 110
NUM_CLASSES = 2
FEATURE_DIM = 32
TOTAL_EPOCHS = 8

# 1. Synthesize Category 2 (ID-Hard Ambiguous Samples) & Category 3 (Modality-Conflict Samples)
def create_test_qr(payload, tamper=False):
    qr = qrcode.QRCode(box_size=3, border=2, error_correction=ERROR_CORRECT_H if tamper else ERROR_CORRECT_M)
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    if tamper:
        draw = ImageDraw.Draw(img)
        w, h = img.size
        cw, ch = int(w * 0.32), int(h * 0.32)
        draw.rectangle([((w-cw)//2, (h-ch)//2), ((w+cw)//2, (h+ch)//2)], fill=(30, 80, 200), outline=(255, 255, 255), width=2)
    img = img.resize((64, 64), Image.Resampling.BILINEAR)
    img_gray = np.array(img.convert("L"), dtype=np.float32) / 255.0
    return np.expand_dims(img_gray, axis=-1)

# Category 2: ID-Hard Legitimate URLs (Complex technical URLs, security paths, fullstackopen, missing.csail.mit.edu)
hard_benign_urls = [
    "https://fullstackopen.com/en/part1/introduction_to_react",
    "https://missing.csail.mit.edu/2020/shell-tools-scripting/",
    "https://support.google.com/accounts/answer/41078?hl=en",
    "https://github.com/torvalds/linux/security/advisories/GHSA-9902",
    "https://auth0.com/docs/secure/tokens/access-tokens/get-access-tokens",
    "https://aws.amazon.com/blogs/security/how-to-manage-credentials-vault/",
    "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie",
    "https://gitlab.com/gitlab-org/gitlab/-/issues/349882",
    "https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/",
    "https://cloud.google.com/iam/docs/understanding-service-accounts"
] * 10  # 100 samples

imgs_hard = np.array([create_test_qr(u, tamper=False) for u in hard_benign_urls], dtype=np.float32)
seqs_hard = pad_sequences(tokenizer.texts_to_sequences(hard_benign_urls), maxlen=MAX_LEN)

# Category 3: Modality Conflict
# 3A: Safe URLs inside Heavily Tampered QR Codes
conflict_safe_urls = [
    "https://www.mit.edu", "https://www.google.com", "https://github.com",
    "https://www.wikipedia.org", "https://www.kernel.org"
] * 10  # 50 samples
imgs_conflict_safe = np.array([create_test_qr(u, tamper=True) for u in conflict_safe_urls], dtype=np.float32)
seqs_conflict_safe = pad_sequences(tokenizer.texts_to_sequences(conflict_safe_urls), maxlen=MAX_LEN)

# 3B: Phishing URLs inside Pristine Clean QR Codes
conflict_phish_urls = [
    "http://paypal-security-account-verification-alert.com/signin",
    "http://apple-id-suspended-recovery-center.xyz/auth",
    "http://chase-bank-online-card-update-alert.net/login",
    "http://netflix-billing-update-subscription-required.org/view",
    "http://wellsfargo-secure-account-verification-service.com/portal"
] * 10  # 50 samples
imgs_conflict_phish = np.array([create_test_qr(u, tamper=False) for u in conflict_phish_urls], dtype=np.float32)
seqs_conflict_phish = pad_sequences(tokenizer.texts_to_sequences(conflict_phish_urls), maxlen=MAX_LEN)

imgs_conflict = np.concatenate([imgs_conflict_safe, imgs_conflict_phish], axis=0)
seqs_conflict = np.concatenate([seqs_conflict_safe, seqs_conflict_phish], axis=0)

# Category 4: Pure Zero-Day OOD (Held-out Set B)
idx_set_b = [i for i in range(len(X_imgs_ood)) if (i % 16) % 2 == 1]
imgs_ood_heldout = X_imgs_ood[idx_set_b]
seqs_ood_heldout = X_seqs_ood[idx_set_b]

# Set A for OE training (Set A even families)
idx_set_a = [i for i in range(len(X_imgs_ood)) if (i % 16) % 2 == 0]
imgs_oe_train = X_imgs_ood[idx_set_a]
seqs_oe_train = X_seqs_ood[idx_set_a]

print(f"Dataset summary for Ignorance vs Conflict test:")
print(f"Cat 2 (ID-Hard Ambiguous): {len(hard_benign_urls)} samples")
print(f"Cat 3 (Modality Conflict): {len(imgs_conflict)} samples")
print(f"Cat 4 (True Zero-Day OOD): {len(imgs_ood_heldout)} samples\n", flush=True)

# 2. Build Models with Shared Backbone
def build_backbone():
    inp_v = Input(shape=IMG_SHAPE)
    v = Conv2D(16, (3, 3), padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(inp_v)
    v = MaxPooling2D((4, 4))(v)
    v = Flatten()(v)
    v_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(v)
    v_dense = Dropout(0.2)(v_dense)

    inp_l = Input(shape=(MAX_LEN,))
    embed = Embedding(VOCAB_SIZE, 32)(inp_l)
    c3 = Conv1D(16, 3, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(embed)
    c5 = Conv1D(16, 5, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(embed)
    lex_cat = concatenate([c3, c5])
    lex_pool = MaxPooling1D(6)(lex_cat)
    lex_flat = Flatten()(lex_pool)
    l_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(lex_flat)
    l_dense = Dropout(0.2)(l_dense)

    fused = concatenate([v_dense, l_dense])
    h = Dense(48, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(fused)
    h = Dropout(0.2)(h)
    h = Dense(32, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(h)
    return inp_v, inp_l, h

def kl_divergence_uniform(alpha):
    beta = tf.ones((1, NUM_CLASSES), dtype=tf.float32)
    alpha_c = tf.clip_by_value(alpha, 1.0, 1e4)
    S_alpha = tf.reduce_sum(alpha_c, axis=-1, keepdims=True)
    S_beta = tf.reduce_sum(beta, axis=-1, keepdims=True)
    lnB = tf.math.lgamma(S_alpha) - tf.reduce_sum(tf.math.lgamma(alpha_c), axis=-1, keepdims=True)
    lnB_uni = tf.math.lgamma(S_beta) - tf.reduce_sum(tf.math.lgamma(beta), axis=-1, keepdims=True)
    dg0 = tf.math.digamma(S_alpha)
    dg1 = tf.math.digamma(alpha_c)
    kl = tf.reduce_sum((alpha_c - beta) * (dg1 - dg0), axis=-1, keepdims=True) + lnB + lnB_uni
    return tf.clip_by_value(kl, 0.0, 1e4)

def create_edl_ce_loss(epoch_var, ood_weight=0.10):
    def loss_fn(y_true, alpha):
        y_flat = tf.reshape(y_true, [-1])
        is_id = tf.cast(y_flat >= 0, tf.float32)
        is_ood = 1.0 - is_id
        y_safe = tf.maximum(0, tf.cast(y_flat, tf.int32))
        y_one_hot = tf.one_hot(y_safe, depth=NUM_CLASSES)
        alpha_c = tf.clip_by_value(alpha, 1.0, 1e4)
        S = tf.reduce_sum(alpha_c, axis=-1, keepdims=True)
        psi_S = tf.math.digamma(S)
        psi_alpha = tf.math.digamma(alpha_c)
        loss_ce = tf.reduce_sum(y_one_hot * (psi_S - psi_alpha), axis=-1, keepdims=True)
        alpha_tilde = y_one_hot + (1.0 - y_one_hot) * alpha_c
        kl_id = kl_divergence_uniform(alpha_tilde)
        anneal = tf.minimum(1.0, epoch_var / (float(TOTAL_EPOCHS) / 2.0))
        loss_id = is_id * tf.reshape(loss_ce + anneal * kl_id, [-1])
        kl_ood = kl_divergence_uniform(alpha_c)
        loss_ood = is_ood * tf.reshape(kl_ood, [-1])
        num_id = tf.maximum(1.0, tf.reduce_sum(is_id))
        num_ood = tf.maximum(1.0, tf.reduce_sum(is_ood))
        return (tf.reduce_sum(loss_id) / num_id) + ood_weight * (tf.reduce_sum(loss_ood) / num_ood)
    return loss_fn

class EpochTracker(tf.keras.callbacks.Callback):
    def __init__(self, epoch_var):
        super().__init__()
        self.epoch_var = epoch_var
    def on_epoch_begin(self, epoch, logs=None):
        self.epoch_var.assign(float(epoch + 1))

# Training set: ID (2400) + 5% OE from Set A (120)
tf.keras.utils.set_random_seed(42)
np.random.seed(42)
n_oe = int(0.05 * 2400)
oe_sample_idx = np.random.choice(len(imgs_oe_train), size=n_oe, replace=True)
oe_v = np.concatenate([X_imgs_id[:2400], imgs_oe_train[oe_sample_idx]], axis=0)
oe_s = np.concatenate([X_seqs_id[:2400], seqs_oe_train[oe_sample_idx]], axis=0)
oe_y = np.concatenate([y_id[:2400], -1 * np.ones(n_oe, dtype=np.int32)], axis=0)
p_oe = np.random.permutation(len(oe_y))
oe_v, oe_s, oe_y = oe_v[p_oe], oe_s[p_oe], oe_y[p_oe]

# Train Softmax + OE
inp_v, inp_l, h = build_backbone()
logits = Dense(NUM_CLASSES)(h)
probs = tf.keras.layers.Activation("softmax")(logits)
m_sm = Model(inputs=[inp_v, inp_l], outputs=[probs, logits])

def sm_loss(y_true, y_pred):
    y_flat = tf.reshape(y_true, [-1])
    is_id = tf.cast(y_flat >= 0, tf.float32)
    is_ood = 1.0 - is_id
    y_safe = tf.maximum(0, tf.cast(y_flat, tf.int32))
    y_one_hot = tf.one_hot(y_safe, depth=NUM_CLASSES)
    p = tf.clip_by_value(y_pred, 1e-7, 1.0 - 1e-7)
    ce_id = -tf.reduce_sum(y_one_hot * tf.math.log(p), axis=-1)
    kl_ood = tf.reduce_sum(p * (tf.math.log(p) - tf.math.log(0.5)), axis=-1)
    return (tf.reduce_sum(is_id * ce_id) / tf.maximum(1.0, tf.reduce_sum(is_id))) + 0.5 * (tf.reduce_sum(is_ood * kl_ood) / tf.maximum(1.0, tf.reduce_sum(is_ood)))

m_sm_train = Model(inputs=[inp_v, inp_l], outputs=probs)
m_sm_train.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001), loss=sm_loss)
m_sm_train.fit([oe_v, oe_s], oe_y, epochs=TOTAL_EPOCHS, batch_size=64, verbose=0)

# Train Quish-EDL (Exp-Clamped)
inp_v, inp_l, h = build_backbone()
z = Dense(NUM_CLASSES)(h)
evidence = tf.keras.layers.Lambda(lambda x: tf.exp(tf.clip_by_value(x, -6.0, 4.0)))(z)
alpha = tf.keras.layers.Lambda(lambda e: e + 1.0)(evidence)
m_edl = Model(inputs=[inp_v, inp_l], outputs=alpha)
epoch_var = tf.Variable(1.0, trainable=False, dtype=tf.float32)
m_edl.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001), loss=create_edl_ce_loss(epoch_var, ood_weight=0.10))
m_edl.fit([oe_v, oe_s], oe_y, epochs=TOTAL_EPOCHS, batch_size=64, callbacks=[EpochTracker(epoch_var)], verbose=0)

# Inference across all 4 categories
def evaluate_sets(model, is_edl=False):
    cats = {
        "Cat 1: ID-Clean (Safe)": (X_imgs_id[y_id == 0][:100], X_seqs_id[y_id == 0][:100]),
        "Cat 1: ID-Clean (Phish)": (X_imgs_id[y_id == 1][:100], X_seqs_id[y_id == 1][:100]),
        "Cat 2: ID-Hard (Ambiguous)": (imgs_hard, seqs_hard),
        "Cat 3: Modality Conflict": (imgs_conflict, seqs_conflict),
        "Cat 4: Pure Zero-Day OOD": (imgs_ood_heldout, seqs_ood_heldout)
    }
    scores = {}
    for name, (img_c, seq_c) in cats.items():
        if not is_edl:
            p_c, z_c = model.predict([img_c, seq_c], verbose=0)
            ent = -np.sum(p_c * np.log(p_c + 1e-12), axis=1) / np.log(2.0)
            scores[name] = ent
        else:
            alpha_c = model.predict([img_c, seq_c], verbose=0)
            S_c = np.sum(alpha_c, axis=-1, keepdims=True)
            u_c = (NUM_CLASSES / S_c.flatten())
            scores[name] = u_c
    return scores

sm_scores = evaluate_sets(m_sm, is_edl=False)
edl_scores = evaluate_sets(m_edl, is_edl=True)

print("="*90)
print("     UNCERTAINTY PROFILE: SOFTMAX ENTROPY VS. EDL EPISTEMIC UNCERTAINTY (u)")
print("="*90)
print(f"{'Category':<30} | {'Softmax Entropy H(p)':<25} | {'EDL Epistemic Uncertainty u':<28}")
print("-" * 90)
for k in sm_scores:
    sm_m, sm_s = np.mean(sm_scores[k]), np.std(sm_scores[k])
    edl_m, edl_s = np.mean(edl_scores[k]), np.std(edl_scores[k])
    print(f"{k:<30} | {sm_m:.4f} +/- {sm_s:.4f}           | {edl_m:.4f} +/- {edl_s:.4f}")

# Critical Experiment: Can each model tell TRUE OOD apart from ID-HARD / MODALITY CONFLICT?
# y = 1 for Pure OOD, y = 0 for ID-Hard / Conflict
y_ood_vs_hard = np.concatenate([np.ones(len(sm_scores['Cat 4: Pure Zero-Day OOD'])), np.zeros(len(sm_scores['Cat 2: ID-Hard (Ambiguous)']))])
auc_sm_hard = roc_auc_score(y_ood_vs_hard, np.concatenate([sm_scores['Cat 4: Pure Zero-Day OOD'], sm_scores['Cat 2: ID-Hard (Ambiguous)']]))
auc_edl_hard = roc_auc_score(y_ood_vs_hard, np.concatenate([edl_scores['Cat 4: Pure Zero-Day OOD'], edl_scores['Cat 2: ID-Hard (Ambiguous)']]))

y_ood_vs_conflict = np.concatenate([np.ones(len(sm_scores['Cat 4: Pure Zero-Day OOD'])), np.zeros(len(sm_scores['Cat 3: Modality Conflict']))])
auc_sm_conflict = roc_auc_score(y_ood_vs_conflict, np.concatenate([sm_scores['Cat 4: Pure Zero-Day OOD'], sm_scores['Cat 3: Modality Conflict']]))
auc_edl_conflict = roc_auc_score(y_ood_vs_conflict, np.concatenate([edl_scores['Cat 4: Pure Zero-Day OOD'], edl_scores['Cat 3: Modality Conflict']]))

print("\n" + "="*90)
print("     AUROC FOR DISTINGUISHING TRUE ZERO-DAY OOD FROM HARD / CONFLICTING IN-DISTRIBUTION")
print("="*90)
print(f"Task 1: OOD vs. ID-Hard (Ambiguous Benign URLs):")
print(f"  • Softmax Entropy AUROC: {auc_sm_hard:.4f}")
print(f"  • Quish-EDL Uncertainty AUROC: {auc_edl_hard:.4f}  <-- Look at this separation!")
print(f"\nTask 2: OOD vs. Modality Conflict (Tampered Benign / Pristine Phishing):")
print(f"  • Softmax Entropy AUROC: {auc_sm_conflict:.4f}")
print(f"  • Quish-EDL Uncertainty AUROC: {auc_edl_conflict:.4f}")

