"""
Prototype of Trusted Multi-View Quishing (TM-Quish) based on Han et al. (ICLR 2021).
Decomposes QR Phishing detection into explicit visual and lexical evidential opinions,
and fuses them via Dempster's Rule of Combination.

Outputs per prediction:
1. Fused Probability: p_safe, p_phish
2. Fused Epistemic Uncertainty: u (novelty / out-of-distribution)
3. Modality Conflict Mass: C (visual-lexical dissonance / visual tampering with benign URL)
4. View-specific beliefs: (b_vis, u_vis) and (b_lex, u_lex)
"""

import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input, Embedding, Conv2D, MaxPooling2D,
    Conv1D, MaxPooling1D, Dense, Dropout, Flatten, Layer, concatenate
)
from sklearn.metrics import roc_auc_score, accuracy_score
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

# Synthesize Modality Conflict Test Set
def create_test_qr(payload, tamper=False):
    qr = qrcode.QRCode(box_size=3, border=2, error_correction=ERROR_CORRECT_H if tamper else ERROR_CORRECT_M)
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    if tamper:
        draw = ImageDraw.Draw(img)
        w, h = img.size
        cw, ch = int(w * 0.35), int(h * 0.35)
        draw.rectangle([((w-cw)//2, (h-ch)//2), ((w+cw)//2, (h+ch)//2)], fill=(30, 80, 200), outline=(255, 255, 255), width=2)
    img = img.resize((64, 64), Image.Resampling.BILINEAR)
    img_gray = np.array(img.convert("L"), dtype=np.float32) / 255.0
    return np.expand_dims(img_gray, axis=-1)

# Clean ID URLs
clean_safe_urls = ["https://www.google.com", "https://www.wikipedia.org", "https://www.github.com", "https://www.mit.edu"] * 25
imgs_clean_safe = np.array([create_test_qr(u, tamper=False) for u in clean_safe_urls], dtype=np.float32)
seqs_clean_safe = pad_sequences(tokenizer.texts_to_sequences(clean_safe_urls), maxlen=MAX_LEN)

# Conflict 1: Safe URLs inside Heavily Tampered QR Codes
imgs_conflict_safe = np.array([create_test_qr(u, tamper=True) for u in clean_safe_urls], dtype=np.float32)
seqs_conflict_safe = seqs_clean_safe

# Conflict 2: Phishing URLs inside Pristine Clean QR Codes
phish_urls = [
    "http://paypal-security-account-verification-alert.com/signin",
    "http://apple-id-suspended-recovery-center.xyz/auth",
    "http://chase-bank-online-card-update-alert.net/login",
    "http://netflix-billing-update-subscription-required.org/view"
] * 25
imgs_conflict_phish = np.array([create_test_qr(u, tamper=False) for u in phish_urls], dtype=np.float32)
seqs_conflict_phish = pad_sequences(tokenizer.texts_to_sequences(phish_urls), maxlen=MAX_LEN)

# Pure OOD (Held-out Set B)
idx_set_b = [i for i in range(len(X_imgs_ood)) if (i % 16) % 2 == 1]
imgs_ood_heldout = X_imgs_ood[idx_set_b]
seqs_ood_heldout = X_seqs_ood[idx_set_b]

# Set A for OE training (Set A even families)
idx_set_a = [i for i in range(len(X_imgs_ood)) if (i % 16) % 2 == 0]
imgs_oe_train = X_imgs_ood[idx_set_a]
seqs_oe_train = X_seqs_ood[idx_set_a]

# Dempster-Shafer Combination Layer (Han et al., ICLR 2021)
class DempsterShaferFusion(Layer):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def call(self, inputs):
        e_v, e_l = inputs
        # alpha = e + 1
        alpha_v = e_v + 1.0
        alpha_l = e_l + 1.0
        
        S_v = tf.reduce_sum(alpha_v, axis=-1, keepdims=True)
        S_l = tf.reduce_sum(alpha_l, axis=-1, keepdims=True)
        
        b_v = e_v / S_v
        u_v = float(NUM_CLASSES) / S_v
        
        b_l = e_l / S_l
        u_l = float(NUM_CLASSES) / S_l
        
        # Conflict mass C between View 1 and View 2
        # C = b_v[0]*b_l[1] + b_v[1]*b_l[0]
        C = b_v[:, 0:1] * b_l[:, 1:2] + b_v[:, 1:2] * b_l[:, 0:1]
        denom = 1.0 - C + 1e-6
        
        # Combined belief masses
        b_fused = (b_v * b_l + b_v * u_l + b_l * u_v) / denom
        u_fused = (u_v * u_l) / denom
        
        # Reconstruct fused alpha
        S_fused = float(NUM_CLASSES) / tf.clip_by_value(u_fused, 1e-4, 1.0)
        alpha_fused = b_fused * S_fused + 1.0
        
        return [alpha_fused, alpha_v, alpha_l, C, u_fused]

# Build Trusted Multi-View Architecture
def build_tm_quish_model():
    # 1. Visual Stream
    inp_v = Input(shape=IMG_SHAPE, name="vis_input")
    v = Conv2D(16, (3, 3), padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(inp_v)
    v = MaxPooling2D((4, 4))(v)
    v = Flatten()(v)
    v_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(v)
    v_dense = Dropout(0.2)(v_dense)
    z_v = Dense(NUM_CLASSES)(v_dense)
    e_v = tf.keras.layers.Lambda(lambda x: tf.exp(tf.clip_by_value(x, -6.0, 4.0)), name="vis_evidence")(z_v)

    # 2. Lexical Stream
    inp_l = Input(shape=(MAX_LEN,), name="lex_input")
    embed = Embedding(VOCAB_SIZE, 32)(inp_l)
    c3 = Conv1D(16, 3, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(embed)
    c5 = Conv1D(16, 5, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(embed)
    lex_cat = concatenate([c3, c5])
    lex_pool = MaxPooling1D(6)(lex_cat)
    lex_flat = Flatten()(lex_pool)
    l_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(lex_flat)
    l_dense = Dropout(0.2)(l_dense)
    z_l = Dense(NUM_CLASSES)(l_dense)
    e_l = tf.keras.layers.Lambda(lambda x: tf.exp(tf.clip_by_value(x, -6.0, 4.0)), name="lex_evidence")(z_l)

    # 3. Dempster-Shafer Combination
    alpha_fused, alpha_v, alpha_l, C, u_fused = DempsterShaferFusion()([e_v, e_l])

    model = Model(inputs=[inp_v, inp_l], outputs=[alpha_fused, alpha_v, alpha_l, C, u_fused])
    return model

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

def tm_loss_fn(epoch_var, ood_weight=0.10):
    def loss(y_true, outputs):
        alpha_fused, alpha_v, alpha_l, C, u_fused = outputs
        y_flat = tf.reshape(y_true, [-1])
        is_id = tf.cast(y_flat >= 0, tf.float32)
        is_ood = 1.0 - is_id
        y_safe = tf.maximum(0, tf.cast(y_flat, tf.int32))
        y_one_hot = tf.one_hot(y_safe, depth=NUM_CLASSES)
        
        def single_view_loss(alpha):
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

        # Multi-task objective: visual view + lexical view + combined opinion
        l_fused = single_view_loss(alpha_fused)
        l_v = single_view_loss(alpha_v)
        l_l = single_view_loss(alpha_l)
        return l_fused + l_v + l_l
    return loss

# Prepare training data (80/20 train/val)
tf.keras.utils.set_random_seed(42)
np.random.seed(42)
n_oe = int(0.05 * 2400)
oe_sample_idx = np.random.choice(len(imgs_oe_train), size=n_oe, replace=True)
oe_v = np.concatenate([X_imgs_id[:2400], imgs_oe_train[oe_sample_idx]], axis=0)
oe_s = np.concatenate([X_seqs_id[:2400], seqs_oe_train[oe_sample_idx]], axis=0)
oe_y = np.concatenate([y_id[:2400], -1 * np.ones(n_oe, dtype=np.int32)], axis=0)
p_oe = np.random.permutation(len(oe_y))
oe_v, oe_s, oe_y = oe_v[p_oe], oe_s[p_oe], oe_y[p_oe]

model = build_tm_quish_model()
epoch_var = tf.Variable(1.0, trainable=False, dtype=tf.float32)

class EpochTracker(tf.keras.callbacks.Callback):
    def on_epoch_begin(self, epoch, logs=None):
        epoch_var.assign(float(epoch + 1))

# Custom training step
optimizer = tf.keras.optimizers.Adam(learning_rate=0.001)
loss_fn = tm_loss_fn(epoch_var, ood_weight=0.10)

@tf.function
def train_step(x_v, x_l, y_b):
    with tf.GradientTape() as tape:
        outputs = model([x_v, x_l], training=True)
        l = loss_fn(y_b, outputs)
    grads = tape.gradient(l, model.trainable_variables)
    optimizer.apply_gradients(zip(grads, model.trainable_variables))
    return l

print("Training Trusted Multi-View Quish Model (TM-Quish)...", flush=True)
dataset = tf.data.Dataset.from_tensor_slices((oe_v, oe_s, oe_y)).shuffle(len(oe_y)).batch(64)
for epoch in range(TOTAL_EPOCHS):
    epoch_var.assign(float(epoch + 1))
    epoch_losses = []
    for bv, bl, by in dataset:
        l = train_step(bv, bl, by)
        epoch_losses.append(float(l))
    print(f"Epoch {epoch+1}/{TOTAL_EPOCHS} Loss: {np.mean(epoch_losses):.4f}", flush=True)

# Test on Evaluation Categories
def evaluate_tm_category(name, imgs, seqs):
    outputs = model.predict([imgs, seqs], verbose=0)
    alpha_fused, alpha_v, alpha_l, C, u_fused = outputs
    S = np.sum(alpha_fused, axis=-1, keepdims=True)
    p = alpha_fused / S
    u = u_fused.flatten()
    c_mass = C.flatten()
    print(f"\n[{name}] (N={len(imgs)})")
    print(f"  • Predicted P(Phish): {np.mean(p[:, 1])*100:.1f}%")
    print(f"  • Epistemic Ignorance u: {np.mean(u):.4f} +/- {np.std(u):.4f}")
    print(f"  • Modality Conflict Mass C: {np.mean(c_mass):.4f} +/- {np.std(c_mass):.4f}")
    return u, c_mass, p

u_safe, c_safe, p_safe = evaluate_tm_category("Clean Safe (Google/Wikipedia/MIT)", imgs_clean_safe, seqs_clean_safe)
u_conf_safe, c_conf_safe, p_conf_safe = evaluate_tm_category("Conflict: Safe URL in Tampered QR", imgs_conflict_safe, seqs_conflict_safe)
u_conf_phish, c_conf_phish, p_conf_phish = evaluate_tm_category("Conflict: Phishing URL in Clean QR", imgs_conflict_phish, seqs_conflict_phish)
u_ood, c_ood, p_ood = evaluate_tm_category("Pure Zero-Day OOD (Held-out Set B)", imgs_ood_heldout, seqs_ood_heldout)

# Evaluate Separation of Conflict vs Normal vs OOD
print("\n" + "="*80)
print("     CAPABILITY UNIQUE TO DEMPSTER-SHAFER MULTI-VIEW EDL:")
print("="*80)
# Can C detect Modality Conflict vs Clean Safe?
y_conflict = np.concatenate([np.ones(len(c_conf_safe)), np.zeros(len(c_safe))])
c_scores = np.concatenate([c_conf_safe, c_safe])
auc_conflict = roc_auc_score(y_conflict, c_scores)
print(f"Conflict Mass (C) AUROC for detecting Tampered-QR with Safe URL: {auc_conflict:.4f}!")

# Can u detect Pure Zero-Day OOD vs Clean Safe?
y_ood = np.concatenate([np.ones(len(u_ood)), np.zeros(len(u_safe))])
u_scores = np.concatenate([u_ood, u_safe])
auc_ood = roc_auc_score(y_ood, u_scores)
print(f"Epistemic Uncertainty (u) AUROC for detecting Zero-Day Attacks:  {auc_ood:.4f}!")

