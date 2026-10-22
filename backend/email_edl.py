"""
Email-EDL: Multimodal Lexical-Tabular Neural Architecture with Evidential Uncertainty.
Strict Parity with Quish-EDL (M1-M6) and URL-EDL (U1-U6).
Evaluates the 6-point ablation ladder E1-E6 across 5-fold cross-validation on Enron + Nazario (10,000 balanced emails).
"""

import os
import re
import sys
import json
import time
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score, brier_score_loss
import scipy.stats as stats
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input, Embedding, Conv1D, MaxPooling1D,
    Dense, Dropout, Flatten, Layer, Lambda, concatenate
)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

MAX_BODY_LEN = 256
VOCAB_SIZE = 128
EMBEDDING_DIM = 32
FEATURE_DIM = 32
TABULAR_DIM = 16
NUM_CLASSES = 2
L2_REG = 5e-4

URGENT_KEYWORDS = [
    "urgent", "immediately", "suspended", "verify", "password", "alert",
    "expire", "action required", "unauthorized", "deactivation", "security notice",
    "attention", "critical", "compromised", "update your account"
]

FINANCIAL_KEYWORDS = [
    "wire", "transfer", "invoice", "payment", "payroll", "bank", "tax",
    "receipt", "funds", "billing", "credit card", "direct deposit"
]

HTML_TAG_REGEX = re.compile(r"<(a|href|table|img|form|script|iframe|body|div)", re.IGNORECASE)
URL_REGEX = re.compile(r"(https?://\S+|www\.\S+)", re.IGNORECASE)
IP_URL_REGEX = re.compile(r"https?://\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}", re.IGNORECASE)


def extract_email_tabular_features(subjects, bodies, senders):
    """
    Extracts 16 structural and content-based tabular features from email metadata and body.
    """
    N = len(bodies)
    feats = np.zeros((N, TABULAR_DIM), dtype=np.float32)

    for i in range(N):
        sub = str(subjects[i]) if subjects[i] is not None else ""
        body = str(bodies[i]) if bodies[i] is not None else ""
        snd = str(senders[i]).lower() if senders[i] is not None else ""

        body_len = len(body)
        words = body.split()
        num_words = len(words)
        sub_len = len(sub)

        urls = URL_REGEX.findall(body)
        num_urls = len(urls)
        has_ip = 1.0 if IP_URL_REGEX.search(body) else 0.0

        body_lower = body.lower()
        urgent_count = sum(1 for kw in URGENT_KEYWORDS if kw in body_lower)
        fin_count = sum(1 for kw in FINANCIAL_KEYWORDS if kw in body_lower)

        html_tags = len(HTML_TAG_REGEX.findall(body))
        has_script = 1.0 if "<script" in body_lower else 0.0

        # Ratios
        alpha_count = sum(1 for c in body if c.isalpha())
        upper_count = sum(1 for c in body if c.isupper())
        upper_ratio = (upper_count / max(1, alpha_count))

        digit_count = sum(1 for c in body if c.isdigit())
        digit_ratio = (digit_count / max(1, body_len))

        excl_count = body.count("!")
        dollar_count = body.count("$") + body.count("€") + body.count("£")

        # Attachment cues
        attach_cues = sum(1 for cue in ["attached", "attachment", ".pdf", ".zip", ".exe", ".scr"] if cue in body_lower)

        # Free-mail sender check
        is_freemail = 1.0 if any(dom in snd for dom in ["@gmail.com", "@yahoo.com", "@hotmail.com", "@aol.com", "@outlook.com"]) else 0.0

        feats[i, :] = [
            min(body_len, 5000) / 1000.0,
            min(num_words, 1000) / 100.0,
            min(sub_len, 200) / 50.0,
            min(num_urls, 20),
            has_ip,
            min(urgent_count, 10),
            min(fin_count, 10),
            min(html_tags, 50),
            has_script,
            upper_ratio,
            digit_ratio,
            min(excl_count, 10),
            min(dollar_count, 10),
            min(attach_cues, 5),
            is_freemail,
            float(len(body.splitlines())) / 20.0
        ]

    return feats


def tokenize_email_body(bodies, max_len=MAX_BODY_LEN):
    """
    Character-level ASCII sequence encoding for email bodies.
    """
    N = len(bodies)
    seqs = np.zeros((N, max_len), dtype=np.int32)
    for i, b in enumerate(bodies):
        text = str(b)[:max_len]
        for j, char in enumerate(text):
            code = ord(char)
            if 0 < code < VOCAB_SIZE:
                seqs[i, j] = code
            else:
                seqs[i, j] = 1  # unknown token
    return seqs


def compute_ece(probs, labels, n_bins=10):
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    confidences = np.max(probs, axis=1)
    predictions = np.argmax(probs, axis=1)
    accuracies = (predictions == labels)

    for i in range(n_bins):
        in_bin = (confidences > bin_boundaries[i]) & (confidences <= bin_boundaries[i + 1])
        prop_in_bin = np.mean(in_bin)
        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(accuracies[in_bin])
            avg_confidence_in_bin = np.mean(confidences[in_bin])
            ece += np.abs(avg_confidence_in_bin - accuracy_in_bin) * prop_in_bin
    return float(ece)


def kl_divergence_uniform(alpha):
    beta = tf.ones((1, NUM_CLASSES), dtype=tf.float32)
    alpha_c = tf.clip_by_value(alpha, 1.0, 1e4)
    S_alpha = tf.reduce_sum(alpha_c, axis=-1, keepdims=True)
    S_beta = tf.reduce_sum(beta, axis=-1, keepdims=True)
    
    lnB = tf.math.lgamma(S_alpha) - tf.reduce_sum(tf.math.lgamma(alpha_c), axis=-1, keepdims=True)
    lnB_uni = tf.reduce_sum(tf.math.lgamma(beta), axis=-1, keepdims=True) - tf.math.lgamma(S_beta)
    
    dg0 = tf.math.digamma(S_alpha)
    dg1 = tf.math.digamma(alpha_c)
    
    kl = tf.reduce_sum((alpha_c - beta) * (dg1 - dg0), axis=-1, keepdims=True) + lnB + lnB_uni
    return tf.clip_by_value(kl, 0.0, 1e4)


def create_edl_loss(epoch_var, total_epochs=8):
    def loss_fn(y_true, alpha):
        y_flat = tf.reshape(y_true, [-1])
        y_one_hot = tf.one_hot(tf.cast(y_flat, tf.int32), depth=NUM_CLASSES)
        alpha_c = tf.clip_by_value(alpha, 1.0, 1e4)
        S = tf.reduce_sum(alpha_c, axis=-1, keepdims=True)
        p = alpha_c / S
        
        err = tf.reduce_sum(tf.square(y_one_hot - p), axis=-1, keepdims=True)
        var = tf.reduce_sum(p * (1.0 - p) / (S + 1.0), axis=-1, keepdims=True)
        alpha_tilde = y_one_hot + (1.0 - y_one_hot) * alpha_c
        kl = kl_divergence_uniform(alpha_tilde)
        anneal = tf.minimum(1.0, epoch_var / (float(total_epochs) / 2.0))
        return tf.reduce_mean(err + var + anneal * kl)
    return loss_fn


def create_edl_oe_loss_annealed(epoch_var, total_epochs=8, ood_weight=0.03):
    def loss_fn(y_true, alpha):
        y_flat = tf.reshape(y_true, [-1])
        is_id = tf.cast(y_flat >= 0, tf.float32)
        is_ood = 1.0 - is_id
        
        y_safe = tf.maximum(0, tf.cast(y_flat, tf.int32))
        y_one_hot = tf.one_hot(y_safe, depth=NUM_CLASSES)
        alpha_c = tf.clip_by_value(alpha, 1.0, 1e4)
        S = tf.reduce_sum(alpha_c, axis=-1, keepdims=True)
        p = alpha_c / S
        
        err = tf.reduce_sum(tf.square(y_one_hot - p), axis=-1, keepdims=True)
        var = tf.reduce_sum(p * (1.0 - p) / (S + 1.0), axis=-1, keepdims=True)
        alpha_tilde = y_one_hot + (1.0 - y_one_hot) * alpha_c
        kl_id = kl_divergence_uniform(alpha_tilde)
        
        anneal = tf.minimum(1.0, epoch_var / (float(total_epochs) / 2.0))
        loss_id = is_id * tf.reshape(err + var + anneal * kl_id, [-1])
        
        kl_ood = kl_divergence_uniform(alpha_c)
        loss_ood = is_ood * tf.reshape(kl_ood, [-1])
        
        num_id = tf.maximum(1.0, tf.reduce_sum(is_id))
        num_ood = tf.maximum(1.0, tf.reduce_sum(is_ood))
        
        return (tf.reduce_sum(loss_id) / num_id) + ood_weight * anneal * (tf.reduce_sum(loss_ood) / num_ood)
    return loss_fn


class AnnealedOrthogonalCosineHead(tf.keras.layers.Layer):
    def __init__(self, num_classes=2, scale=10.0, target_margin=0.20, epoch_var=None, total_epochs=8, **kwargs):
        super().__init__(**kwargs)
        self.num_classes = num_classes
        self.scale = scale
        self.target_margin = target_margin
        self.epoch_var = epoch_var
        self.total_epochs = total_epochs

    def build(self, input_shape):
        self.w = self.add_weight(
            shape=(input_shape[-1], self.num_classes),
            initializer=tf.keras.initializers.Orthogonal(),
            trainable=True,
            name="class_directions"
        )
        super().build(input_shape)

    def call(self, h):
        h_norm = tf.nn.l2_normalize(h, axis=-1)
        w_norm = tf.nn.l2_normalize(self.w, axis=0)
        cos_sim = tf.matmul(h_norm, w_norm)
        if self.epoch_var is not None:
            warmup = tf.maximum(0.0, (self.epoch_var - 2.0) / (float(self.total_epochs) - 2.0))
            m_t = self.target_margin * warmup
        else:
            m_t = 0.0
        return self.scale * tf.nn.relu(cos_sim - m_t)


class EpochTracker(tf.keras.callbacks.Callback):
    def __init__(self, epoch_var):
        super().__init__()
        self.epoch_var = epoch_var

    def on_epoch_begin(self, epoch, logs=None):
        self.epoch_var.assign(float(epoch))


def build_email_models(epoch_var=None, total_epochs=8):
    """
    Constructs model architectures for E2, E3, E4, E5, E6.
    """
    # 1. Base Text Branch
    def build_text_branch(name_prefix):
        inp = Input(shape=(MAX_BODY_LEN,), name=f"{name_prefix}_body_in")
        x = Embedding(VOCAB_SIZE, EMBEDDING_DIM)(inp)
        x = Conv1D(FEATURE_DIM, 3, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(x)
        x = MaxPooling1D(4)(x)
        x = Conv1D(FEATURE_DIM, 3, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(x)
        x = MaxPooling1D(4)(x)
        x = Flatten()(x)
        x = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(x)
        x = Dropout(0.2)(x)
        return inp, x

    # E2: Sequence Only Softmax
    inp_e2, t_e2 = build_text_branch("e2")
    h_e2 = Dense(48, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(t_e2)
    h_e2 = Dropout(0.2)(h_e2)
    h_e2 = Dense(32, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(h_e2)
    out_e2 = Dense(NUM_CLASSES, activation="softmax", name="e2_softmax")(h_e2)
    model_e2 = Model(inputs=inp_e2, outputs=out_e2, name="E2_Text_Only_Softmax")
    model_e2.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=2e-4, clipnorm=1.0),
                     loss="sparse_categorical_crossentropy", metrics=["accuracy"])

    # Helper for Fusion
    def build_fusion_backbone(name_prefix):
        inp_txt, t_feat = build_text_branch(name_prefix)
        inp_tab = Input(shape=(TABULAR_DIM,), name=f"{name_prefix}_tab_in")
        tab_feat = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(inp_tab)
        tab_feat = Dropout(0.2)(tab_feat)
        fused = concatenate([t_feat, tab_feat])
        h = Dense(48, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(fused)
        h = Dropout(0.2)(h)
        h_latent = Dense(32, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(h)
        return inp_txt, inp_tab, h_latent

    # E3: Early Fusion Softmax
    inp_t3, inp_tab3, h3 = build_fusion_backbone("e3")
    out_e3 = Dense(NUM_CLASSES, activation="softmax", name="e3_softmax")(h3)
    model_e3 = Model(inputs=[inp_t3, inp_tab3], outputs=out_e3, name="E3_Early_Fusion_Softmax")
    model_e3.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=2e-4, clipnorm=1.0),
                     loss="sparse_categorical_crossentropy", metrics=["accuracy"])

    # E4: Early Fusion Vanilla EDL (ReLU head)
    inp_t4, inp_tab4, h4 = build_fusion_backbone("e4")
    ev4 = Dense(NUM_CLASSES, activation="relu", name="e4_relu_ev")(h4)
    alpha4 = Lambda(lambda e: e + 1.0, name="e4_alpha")(ev4)
    model_e4 = Model(inputs=[inp_t4, inp_tab4], outputs=alpha4, name="E4_Email_EDL_Vanilla")

    # E5: Early Fusion EDL with Outlier Exposure (ReLU head)
    inp_t5, inp_tab5, h5 = build_fusion_backbone("e5")
    ev5 = Dense(NUM_CLASSES, activation="relu", name="e5_relu_ev")(h5)
    alpha5 = Lambda(lambda e: e + 1.0, name="e5_alpha")(ev5)
    model_e5 = Model(inputs=[inp_t5, inp_tab5], outputs=alpha5, name="E5_Email_EDL_OE")

    # E6: PhishShield-EDL (Cosine Head + OE)
    inp_t6, inp_tab6, _ = build_fusion_backbone("e6")
    # For E6, unconstrained latent representation before cosine
    inp_txt6, t_feat6 = build_text_branch("e6_cos")
    inp_tab6 = Input(shape=(TABULAR_DIM,), name="e6_cos_tab_in")
    tab_feat6 = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(inp_tab6)
    tab_feat6 = Dropout(0.2)(tab_feat6)
    fused6 = concatenate([t_feat6, tab_feat6])
    h6 = Dense(48, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(fused6)
    h6 = Dropout(0.2)(h6)
    h6_latent = Dense(32, activation=None, kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(h6)

    ev6 = AnnealedOrthogonalCosineHead(
        num_classes=NUM_CLASSES,
        scale=10.0,
        target_margin=0.20,
        epoch_var=epoch_var,
        total_epochs=total_epochs
    )(h6_latent)
    alpha6 = Lambda(lambda e: e + 1.0, name="e6_alpha")(ev6)
    model_e6 = Model(inputs=[inp_txt6, inp_tab6], outputs=alpha6, name="E6_Email_EDL_Cosine")

    return model_e2, model_e3, model_e4, model_e5, model_e6


def generate_synthetic_email_ood(num_samples=500):
    """
    Constructs 500 realistic Out-of-Distribution zero-day email attacks:
    1. BEC (Conversational Business Email Compromise with zero URLs, zero urgent buzzwords)
    2. Cloud PaaS benign invitation lures (DocuSign/SharePoint authentic notifications)
    3. QR-embedded quishing emails with minimal body text
    """
    bec_templates = [
        ("Quick question", "Hey, are you at your desk right now? Need a quick favor before I hop into a client meeting. Let me know."),
        ("Status update", "Can you send over the latest deck when you get a chance? No rush, just reviewing before tomorrow."),
        ("Follow up", "Thanks for your help earlier today. I left the notes in the conference room. Have a good evening."),
        ("Review request", "Please check your calendar for Thursday 2 PM. We might need to reschedule the sync."),
        ("Lunch meeting", "Are we still meeting at noon near the north lobby? Let me know if that time works.")
    ]

    paas_templates = [
        ("Document shared via Microsoft SharePoint", "You have been granted view access to Q3_Financial_Review.pdf. Access is governed by corporate single sign-on."),
        ("DocuSign Signature Request", "Please review and complete the signing process for NDA_Agreement_Revision_2. Envelope ID: 88F4-291B."),
        ("Google Drive Notification", "An updated team folder has been shared with your workspace address. View shared documents in Google Workspace."),
        ("Adobe Document Cloud", "A shared agreement is ready for your countersignature. Please authenticate through Adobe ID.")
    ]

    qr_templates = [
        ("Authentication Refresh", "Scan the secure authentication QR code below to complete dual-factor registration for your mobile device."),
        ("Benefits Enrollment", "Scan the payroll card QR code on your mobile camera to verify benefit enrollment elections."),
        ("Parking Permit QR", "Your temporary campus parking pass is available in the attached QR image. Present at entry gate."),
        ("IT Security Badge", "Please scan the registration QR code to link your corporate identity token.")
    ]

    ood_subjects = []
    ood_bodies = []
    ood_senders = []

    for i in range(num_samples):
        r = i % 3
        if r == 0:
            tmpl = bec_templates[i % len(bec_templates)]
            snd = f"colleague_{i}@external-partner.org"
        elif r == 1:
            tmpl = paas_templates[i % len(paas_templates)]
            snd = f"notifications_{i}@cloud-sharepoint.com"
        else:
            tmpl = qr_templates[i % len(qr_templates)]
            snd = f"hr-portal_{i}@identity-gateway.net"
        
        ood_subjects.append(tmpl[0])
        ood_bodies.append(tmpl[1])
        ood_senders.append(snd)

    return ood_subjects, ood_bodies, ood_senders
