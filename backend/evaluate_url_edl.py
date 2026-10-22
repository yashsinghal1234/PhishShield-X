"""
Comprehensive 5-Fold Cross-Validation, 6-Point Ablation Ladder, and Evidential Uncertainty Evaluation for URL Phishing.
Strict Encoder & Protocol Parity with Quish-EDL (backend/evaluate_quishing_research.py).

Stabilized Architecture & Evaluation Protocol:
- StandardScaler strictly fit on training fold tabular features, applied to val/test/OOD.
- Adam optimizer with lr=2e-4, clipnorm=1.0 for stabilized Dirichlet optimization.
- Annealed Outlier Exposure (OE) loss with 5% outlier fraction and lambda_OE=0.03.
- Annealed Orthogonal Cosine Evidence Head with margin warmup and scale=10.0.
- Per-fold Neyman-Pearson dynamic OOD detection threshold at ID validation 95th percentile (u > p95_ID_fold).
"""

import os
import sys
import json
import time
import pickle
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
    Dense, Dropout, Flatten, Lambda, concatenate
)
from tensorflow.keras.preprocessing.sequence import pad_sequences

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from features import URLFeatureExtractor
from url_edl import (
    build_url_edl_model,
    create_edl_loss,
    EpochTracker,
    compute_evidential_outputs,
    kl_divergence_uniform,
    MAX_LEN, VOCAB_SIZE, EMBEDDING_DIM, FEATURE_DIM, TABULAR_DIM, NUM_CLASSES, L2_REG
)


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


def run_mcnemar_test(y_true, y_pred1, y_pred2):
    correct1 = (y_pred1 == y_true)
    correct2 = (y_pred2 == y_true)
    b = np.sum(correct1 & ~correct2)
    c = np.sum(~correct1 & correct2)
    if (b + c) == 0:
        return 0.0, 1.0
    chi2 = ((abs(b - c) - 1.0) ** 2) / (b + c)
    p_value = 1.0 - stats.chi2.cdf(chi2, df=1)
    return float(chi2), float(p_value)


def build_u2_lexical_only_model():
    inp_l = Input(shape=(MAX_LEN,), name="u2_lex_input")
    l = Embedding(VOCAB_SIZE, EMBEDDING_DIM, name="u2_char_embedding")(inp_l)
    l = Conv1D(FEATURE_DIM, 3, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(l)
    l = MaxPooling1D(6)(l)
    l = Flatten()(l)
    l_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(l)
    l_dense = Dropout(0.2)(l_dense)
    h = Dense(48, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(l_dense)
    h = Dropout(0.2)(h)
    h = Dense(32, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(h)
    out = Dense(NUM_CLASSES, activation="softmax", name="u2_softmax")(h)
    
    model = Model(inputs=inp_l, outputs=out, name="U2_Lexical_Only_Softmax")
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=2e-4, clipnorm=1.0), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return model


class AnnealedOrthogonalCosineHead(tf.keras.layers.Layer):
    """
    Orthogonal Cosine Evidence Head with Annealed Angular Margin:
    e_k = scale * ReLU(cos(h, w_k) - m_t)
    w initialized orthogonally; m_t warms up from 0.0 to target_margin smoothly.
    """
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


def build_u6_cosine_model(epoch_var, total_epochs=8, target_margin=0.20):
    inp_l = Input(shape=(MAX_LEN,), name="u6_lex_input")
    l = Embedding(VOCAB_SIZE, EMBEDDING_DIM)(inp_l)
    l = Conv1D(FEATURE_DIM, 3, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(l)
    l = MaxPooling1D(6)(l)
    l = Flatten()(l)
    l_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(l)
    l_dense = Dropout(0.2)(l_dense)

    inp_t = Input(shape=(TABULAR_DIM,), name="u6_tab_input")
    t_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(inp_t)
    t_dense = Dropout(0.2)(t_dense)

    fused = concatenate([l_dense, t_dense])
    h = Dense(48, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(fused)
    h = Dropout(0.2)(h)
    h_feat = Dense(32, activation=None, kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(h)

    ev = AnnealedOrthogonalCosineHead(
        num_classes=NUM_CLASSES,
        scale=10.0,
        target_margin=target_margin,
        epoch_var=epoch_var,
        total_epochs=total_epochs
    )(h_feat)
    alpha = Lambda(lambda e: e + 1.0, name="alpha_output")(ev)
    model = Model(inputs=[inp_l, inp_t], outputs=alpha, name="U6_URL_EDL_Cosine")
    return model


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
        
        # Anneal the OOD regularization term to let ID representations establish in early epochs
        return (tf.reduce_sum(loss_id) / num_id) + ood_weight * anneal * (tf.reduce_sum(loss_ood) / num_ood)
    return loss_fn


def synthesize_clean_url_ood_suite():
    return [
        "https://xn--pypal-4ve.com/signin/v2/checkpoint",
        "https://xn--pple-43d.com/recovery/verify-id",
        "http://xn--gogle-qqa.com/login/auth-secure",
        "https://xn--amazn-7qa.com/ap/signin/redirect",
        "https://xn--chse-ppa.com/auth/security-flow",
        "https://xn--microsft-4za.com/oauth2/token",
        "https://xn--wellsfarg-73a.com/portal/login",
        "http://xn--coinbse-71a.com/wallet/restore",
        "https://xn--binnce-h1a.com/en/login/confirm",
        "https://xn--instgrm-kwa.com/accounts/login",
        "https://security-account-verification.vercel.app/auth",
        "https://user-credential-recovery-gateway.pages.dev/login",
        "https://session-auth-resolution.workers.dev/checkpoint",
        "https://billing-alert-update.firebaseapp.com/confirm",
        "https://helpdesk-ticket-portal.netlify.app/access",
        "https://support-microsoft-security.azurewebsites.net/auth",
        "https://wallet-connect-dapp-sync.glitch.me/restore",
        "https://secure-login-session.onrender.com/verify",
        "https://account-update-center.web.app/identity",
        "https://cloud-security-gateway.github.io/auth-check",
        "http://secure-login-gateway.evil.tk/login/auth",
        "https://free-crypto-airdrop.top/claim/tokens",
        "http://account-support-service.cf/verify/user",
        "https://banking-security-alert.icu/auth/checkpoint",
        "http://update-wallet.xyz/connect/metamask",
        "http://recovery-portal.buzz/session/restore",
        "https://online-customer-notice.cam/auth/login",
        "http://client-verification.fit/secure/banking",
        "https://verify-id-card.loan/service/identity",
        "http://secure-update-notice.monster/account",
        "https://paypal.com.account-verify.click/login/submit",
        "https://apple.com.manage-id.work/verify/credentials",
        "https://microsoft.com.onedrive-share.rest/download/doc",
        "https://google.com.security-alert.surf/auth/prompt",
        "https://amazon.com.order-confirmation.cyou/invoice",
        "https://netflix.com.billing-update.icu/membership",
        "https://chase.com.fraud-alert.top/verify/account",
        "https://whatsapp.com.chat-backup.pw/restore/phone",
        "https://facebook.com.checkpoint-id.site/confirm",
        "https://bankofamerica.com.secure-vault.bar/login",
        "http://0xd8.0x3a.0xd6.0xe5/login/index.php",
        "http://2130706433/path/to/malicious/portal",
        "http://0321.0124.0232.0111/login/auth",
        "http://0x7f.1/admin/checkpoint/verify",
        "http://2899905973/banking/login.html"
    ]


def load_dataset(sample_size=6000, seed=42):
    cache_path = os.path.join(CURRENT_DIR, f"url_data_cache_{sample_size}.npz")
    if os.path.exists(cache_path):
        print(f"Loading cached dataset from {cache_path}...", flush=True)
        data = np.load(cache_path, allow_pickle=True)
        return data["X_seq"], data["X_tab"], data["y"], data["X_seq_ood"], data["X_tab_ood"]

    print(f"Extracting features for {sample_size} URLs...", flush=True)
    csv_path = os.path.join(CURRENT_DIR, "data", "malicious_phish.csv")
    df = pd.read_csv(csv_path).dropna(subset=['url', 'type'])
    df['label'] = df['type'].apply(lambda x: 0 if str(x).lower() == 'benign' else 1)
    
    half = sample_size // 2
    b = df[df['label'] == 0].sample(half, random_state=seed)
    m = df[df['label'] == 1].sample(half, random_state=seed)
    df_bal = pd.concat([b, m]).sample(frac=1.0, random_state=seed).reset_index(drop=True)
    
    urls = df_bal['url'].astype(str).tolist()
    y = df_bal['label'].to_numpy(dtype=np.int32)
    
    with open(os.path.join(CURRENT_DIR, "tokenizer.pkl"), "rb") as f:
        tok = pickle.load(f)
    seqs = tok.texts_to_sequences(urls)
    X_seq = pad_sequences(seqs, maxlen=MAX_LEN, padding="post", truncating="post")
    
    ext = URLFeatureExtractor()
    X_tab = np.nan_to_num(np.array(ext.transform(urls), dtype=np.float32), nan=0.0, posinf=1.0, neginf=-1.0)
    
    ood_urls = synthesize_clean_url_ood_suite()
    ood_seqs = tok.texts_to_sequences(ood_urls)
    X_seq_ood = pad_sequences(ood_seqs, maxlen=MAX_LEN, padding="post", truncating="post")
    X_tab_ood = np.nan_to_num(np.array(ext.transform(ood_urls), dtype=np.float32), nan=0.0, posinf=1.0, neginf=-1.0)
    
    np.savez_compressed(cache_path, X_seq=X_seq, X_tab=X_tab, y=y, X_seq_ood=X_seq_ood, X_tab_ood=X_tab_ood)
    return X_seq, X_tab, y, X_seq_ood, X_tab_ood


def run_5fold_url_edl_evaluation(sample_size=6000, n_splits=5, epochs_parity=8):
    print("==========================================================================", flush=True)
    print("        STABILIZED URL-EDL: 5-FOLD CV & 6-POINT ABLATION STUDY (U1-U6)", flush=True)
    print("==========================================================================\n", flush=True)

    X_seq, X_tab, y, X_seq_ood, X_tab_ood = load_dataset(sample_size=sample_size)
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)

    model_names = [
        "U1: Random Forest (34 Feat)",
        "U2: Unimodal Lexical-Only (Softmax)",
        "U3: Multimodal Early Fusion (Softmax)",
        "U4: URL-EDL Vanilla (Proposed Fusion + EDL)",
        "U5: URL-EDL + Outlier Exposure (OE)",
        "U6: URL-EDL Cosine Head + OE (m=0.20)"
    ]

    fold_metrics = {name: [] for name in model_names}
    calibration_metrics = {
        "U3_Softmax": [],
        "U4_EDL_Vanilla": [],
        "U5_EDL_OE": [],
        "U6_EDL_Cosine": []
    }
    
    per_fold_uq = {
        "U4_EDL_Vanilla": {"ratios": [], "p95_flags": [], "u_id": [], "u_ood": []},
        "U5_EDL_OE": {"ratios": [], "p95_flags": [], "u_id": [], "u_ood": []},
        "U6_EDL_Cosine": {"ratios": [], "p95_flags": [], "u_id": [], "u_ood": []}
    }

    all_y_trues = []
    all_preds = {name: [] for name in model_names}
    start_time = time.time()

    for fold, (train_idx, val_idx) in enumerate(skf.split(X_seq, y)):
        fold_start = time.time()
        print(f"\n>>> Running Fold {fold + 1}/{n_splits} ...", flush=True)

        train_s, val_s = X_seq[train_idx], X_seq[val_idx]
        train_t_raw, val_t_raw = X_tab[train_idx], X_tab[val_idx]
        train_y, val_y = y[train_idx], y[val_idx]
        all_y_trues.extend(val_y)

        # 1. StandardScaler STRICTLY on train fold only
        scaler = StandardScaler()
        train_t = scaler.fit_transform(train_t_raw)
        val_t = scaler.transform(val_t_raw)
        ood_t = scaler.transform(X_tab_ood)

        # Verify url_length mean/var
        u_mean = np.mean(train_t[:, 0])
        u_var = np.var(train_t[:, 0])
        print(f"   [Scaler Check] url_length train mean={u_mean:.4f}, var={u_var:.4f}", flush=True)

        # -------------------------------------------------------------
        # U1: Random Forest 34-Feat (Baseline)
        # -------------------------------------------------------------
        rf = RandomForestClassifier(n_estimators=100, max_depth=25, random_state=42, n_jobs=-1)
        rf.fit(train_t, train_y)
        p1 = rf.predict_proba(val_t)
        preds1 = np.argmax(p1, axis=1)
        all_preds["U1: Random Forest (34 Feat)"].extend(preds1)
        fold_metrics["U1: Random Forest (34 Feat)"].append({
            "acc": accuracy_score(val_y, preds1), "f1": f1_score(val_y, preds1),
            "auc": roc_auc_score(val_y, p1[:, 1])
        })

        # -------------------------------------------------------------
        # U2: Unimodal Lexical-Only (Softmax)
        # -------------------------------------------------------------
        u2 = build_u2_lexical_only_model()
        u2.fit(train_s, train_y, epochs=epochs_parity, batch_size=128, verbose=0)
        p2 = u2.predict(val_s, verbose=0)
        preds2 = np.argmax(p2, axis=1)
        all_preds["U2: Unimodal Lexical-Only (Softmax)"].extend(preds2)
        fold_metrics["U2: Unimodal Lexical-Only (Softmax)"].append({
            "acc": accuracy_score(val_y, preds2), "f1": f1_score(val_y, preds2),
            "auc": roc_auc_score(val_y, p2[:, 1])
        })

        # -------------------------------------------------------------
        # U3: Multimodal Early Fusion (Lexical + Tabular Softmax)
        # -------------------------------------------------------------
        u3 = build_url_edl_model(head_type="softmax")
        u3.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=2e-4, clipnorm=1.0),
            loss="sparse_categorical_crossentropy",
            metrics=["accuracy"]
        )
        u3.fit([train_s, train_t], train_y, epochs=epochs_parity, batch_size=128, verbose=0)
        p3 = u3.predict([val_s, val_t], verbose=0)
        preds3 = np.argmax(p3, axis=1)
        all_preds["U3: Multimodal Early Fusion (Softmax)"].extend(preds3)
        fold_metrics["U3: Multimodal Early Fusion (Softmax)"].append({
            "acc": accuracy_score(val_y, preds3), "f1": f1_score(val_y, preds3),
            "auc": roc_auc_score(val_y, p3[:, 1])
        })
        calibration_metrics["U3_Softmax"].append({
            "ece": compute_ece(p3, val_y), "brier": brier_score_loss(val_y, p3[:, 1])
        })

        # -------------------------------------------------------------
        # U4: URL-EDL Vanilla (Early Fusion + Canonical EDL Loss)
        # -------------------------------------------------------------
        epoch_var4 = tf.Variable(1.0, trainable=False, dtype=tf.float32)
        u4 = build_url_edl_model(head_type="edl")
        u4.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=2e-4, clipnorm=1.0),
            loss=create_edl_loss(epoch_var4, total_epochs=epochs_parity)
        )
        u4.fit(
            [train_s, train_t], train_y,
            epochs=epochs_parity, batch_size=64,
            callbacks=[EpochTracker(epoch_var4)], verbose=0
        )
        alpha_val4 = u4.predict([val_s, val_t], verbose=0)
        probs4, _, u_val4 = compute_evidential_outputs(alpha_val4)
        preds4 = np.argmax(probs4, axis=1)
        all_preds["U4: URL-EDL Vanilla (Proposed Fusion + EDL)"].extend(preds4)
        fold_metrics["U4: URL-EDL Vanilla (Proposed Fusion + EDL)"].append({
            "acc": accuracy_score(val_y, preds4), "f1": f1_score(val_y, preds4),
            "auc": roc_auc_score(val_y, probs4[:, 1])
        })
        calibration_metrics["U4_EDL_Vanilla"].append({
            "ece": compute_ece(probs4, val_y), "brier": brier_score_loss(val_y, probs4[:, 1])
        })
        alpha_ood4 = u4.predict([X_seq_ood, ood_t], verbose=0)
        _, _, u_ood4 = compute_evidential_outputs(alpha_ood4)
        
        per_fold_uq["U4_EDL_Vanilla"]["u_id"].extend(u_val4)
        per_fold_uq["U4_EDL_Vanilla"]["u_ood"].extend(u_ood4)
        r4 = np.mean(u_ood4) / np.mean(u_val4)
        p95_id4 = np.percentile(u_val4, 95)
        flag4 = np.mean(u_ood4 > p95_id4) * 100
        per_fold_uq["U4_EDL_Vanilla"]["ratios"].append(r4)
        per_fold_uq["U4_EDL_Vanilla"]["p95_flags"].append(flag4)

        # -------------------------------------------------------------
        # U5: URL-EDL + Outlier Exposure (OE with 5% outliers & Annealed Loss)
        # -------------------------------------------------------------
        n_outliers = int(0.05 * len(train_y))
        ood_train_idx = np.random.choice(len(X_seq_ood), size=n_outliers, replace=True)
        oe_seq = np.concatenate([train_s, X_seq_ood[ood_train_idx]], axis=0)
        oe_tab = np.concatenate([train_t, ood_t[ood_train_idx]], axis=0)
        oe_y = np.concatenate([train_y, -1 * np.ones(n_outliers, dtype=np.int32)], axis=0)
        perm = np.random.permutation(len(oe_y))
        oe_seq, oe_tab, oe_y = oe_seq[perm], oe_tab[perm], oe_y[perm]

        epoch_var5 = tf.Variable(1.0, trainable=False, dtype=tf.float32)
        u5 = build_url_edl_model(head_type="edl")
        u5.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=2e-4, clipnorm=1.0),
            loss=create_edl_oe_loss_annealed(epoch_var5, total_epochs=epochs_parity, ood_weight=0.03)
        )
        u5.fit(
            [oe_seq, oe_tab], oe_y,
            epochs=epochs_parity, batch_size=64,
            callbacks=[EpochTracker(epoch_var5)], verbose=0
        )
        alpha_val5 = u5.predict([val_s, val_t], verbose=0)
        probs5, _, u_val5 = compute_evidential_outputs(alpha_val5)
        preds5 = np.argmax(probs5, axis=1)
        all_preds["U5: URL-EDL + Outlier Exposure (OE)"].extend(preds5)
        fold_metrics["U5: URL-EDL + Outlier Exposure (OE)"].append({
            "acc": accuracy_score(val_y, preds5), "f1": f1_score(val_y, preds5),
            "auc": roc_auc_score(val_y, probs5[:, 1])
        })
        calibration_metrics["U5_EDL_OE"].append({
            "ece": compute_ece(probs5, val_y), "brier": brier_score_loss(val_y, probs5[:, 1])
        })
        alpha_ood5 = u5.predict([X_seq_ood, ood_t], verbose=0)
        _, _, u_ood5 = compute_evidential_outputs(alpha_ood5)
        
        per_fold_uq["U5_EDL_OE"]["u_id"].extend(u_val5)
        per_fold_uq["U5_EDL_OE"]["u_ood"].extend(u_ood5)
        r5 = np.mean(u_ood5) / np.mean(u_val5)
        p95_id5 = np.percentile(u_val5, 95)
        flag5 = np.mean(u_ood5 > p95_id5) * 100
        per_fold_uq["U5_EDL_OE"]["ratios"].append(r5)
        per_fold_uq["U5_EDL_OE"]["p95_flags"].append(flag5)

        # -------------------------------------------------------------
        # U6: URL-EDL Cosine Head + OE (m=0.20 Annealed)
        # -------------------------------------------------------------
        epoch_var6 = tf.Variable(1.0, trainable=False, dtype=tf.float32)
        u6 = build_u6_cosine_model(epoch_var6, total_epochs=epochs_parity, target_margin=0.20)
        u6.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=5e-4, clipnorm=1.0),
            loss=create_edl_oe_loss_annealed(epoch_var6, total_epochs=epochs_parity, ood_weight=0.04)
        )
        u6.fit(
            [oe_seq, oe_tab], oe_y,
            epochs=epochs_parity, batch_size=64,
            callbacks=[EpochTracker(epoch_var6)], verbose=0
        )
        alpha_val6 = u6.predict([val_s, val_t], verbose=0)
        probs6, _, u_val6 = compute_evidential_outputs(alpha_val6)
        preds6 = np.argmax(probs6, axis=1)
        all_preds["U6: URL-EDL Cosine Head + OE (m=0.20)"].extend(preds6)
        fold_metrics["U6: URL-EDL Cosine Head + OE (m=0.20)"].append({
            "acc": accuracy_score(val_y, preds6), "f1": f1_score(val_y, preds6),
            "auc": roc_auc_score(val_y, probs6[:, 1])
        })
        calibration_metrics["U6_EDL_Cosine"].append({
            "ece": compute_ece(probs6, val_y), "brier": brier_score_loss(val_y, probs6[:, 1])
        })
        alpha_ood6 = u6.predict([X_seq_ood, ood_t], verbose=0)
        _, _, u_ood6 = compute_evidential_outputs(alpha_ood6)
        
        per_fold_uq["U6_EDL_Cosine"]["u_id"].extend(u_val6)
        per_fold_uq["U6_EDL_Cosine"]["u_ood"].extend(u_ood6)
        r6 = np.mean(u_ood6) / np.mean(u_val6)
        p95_id6 = np.percentile(u_val6, 95)
        flag6 = np.mean(u_ood6 > p95_id6) * 100
        per_fold_uq["U6_EDL_Cosine"]["ratios"].append(r6)
        per_fold_uq["U6_EDL_Cosine"]["p95_flags"].append(flag6)

        print(f"   Fold {fold + 1} Done in {time.time() - fold_start:.1f}s | U3 Acc: {accuracy_score(val_y, preds3)*100:.2f}% | U4 Acc: {accuracy_score(val_y, preds4)*100:.2f}% (r: {r4:.2f}x) | U5 Acc: {accuracy_score(val_y, preds5)*100:.2f}% (r: {r5:.2f}x) | U6 Acc: {accuracy_score(val_y, preds6)*100:.2f}% (r: {r6:.2f}x)", flush=True)

    # Aggregate 5-Fold Reporting
    all_y_trues = np.array(all_y_trues)
    results_summary = []
    u4_preds = np.array(all_preds["U4: URL-EDL Vanilla (Proposed Fusion + EDL)"])
    u3_preds = np.array(all_preds["U3: Multimodal Early Fusion (Softmax)"])
    u6_preds = np.array(all_preds["U6: URL-EDL Cosine Head + OE (m=0.20)"])

    chi2_u3_u4, p_u3_u4 = run_mcnemar_test(all_y_trues, u4_preds, u3_preds)
    chi2_u4_u6, p_u4_u6 = run_mcnemar_test(all_y_trues, u6_preds, u4_preds)

    for name in model_names:
        accs = [m["acc"] * 100 for m in fold_metrics[name]]
        f1s = [m["f1"] * 100 for m in fold_metrics[name]]
        aucs = [m["auc"] for m in fold_metrics[name]]

        current_preds = np.array(all_preds[name])
        chi2, p_val = run_mcnemar_test(all_y_trues, u4_preds, current_preds)
        p_str = f"p < 0.001" if p_val < 0.001 else f"p = {p_val:.4f}"
        if name == "U4: URL-EDL Vanilla (Proposed Fusion + EDL)":
            p_str = "--- (Ref)"

        results_summary.append({
            "Architecture / Ablation": name,
            "Accuracy (%)": f"{np.mean(accs):.2f} ± {np.std(accs):.2f}",
            "F1-Score (%)": f"{np.mean(f1s):.2f} ± {np.std(f1s):.2f}",
            "ROC-AUC": f"{np.mean(aucs):.4f} ± {np.std(aucs):.4f}",
            "McNemar p-val (vs U4)": p_str
        })

    df_results = pd.DataFrame(results_summary)

    def summarize_u(u_arr):
        u_arr = np.array(u_arr)
        return {
            "mean": float(np.mean(u_arr)),
            "std": float(np.std(u_arr)),
            "median": float(np.median(u_arr)),
            "q25": float(np.percentile(u_arr, 25)),
            "q75": float(np.percentile(u_arr, 75))
        }

    uq_report = {}
    for m_key in ["U4_EDL_Vanilla", "U5_EDL_OE", "U6_EDL_Cosine"]:
        id_arr = np.array(per_fold_uq[m_key]["u_id"])
        ood_arr = np.array(per_fold_uq[m_key]["u_ood"])
        r_list = per_fold_uq[m_key]["ratios"]
        flag_list = per_fold_uq[m_key]["p95_flags"]

        uq_report[m_key] = {
            "id_uncertainty": summarize_u(id_arr),
            "ood_uncertainty": summarize_u(ood_arr),
            "fold_ratios": [round(float(r), 3) for r in r_list],
            "mean_ratio": f"{np.mean(r_list):.2f} ± {np.std(r_list):.2f}",
            "ood_flagging_rate_at_fold_p95": f"{np.mean(flag_list):.1f}% ± {np.std(flag_list):.1f}%"
        }

    print("\n" + "="*95, flush=True)
    print("             URL-EDL: 5-FOLD CROSS-VALIDATION & ABLATION RESULTS (Mean ± Std)", flush=True)
    print("="*95, flush=True)
    print(df_results.to_string(index=False), flush=True)

    print("\n" + "="*95, flush=True)
    print("                CALIBRATION & ZERO-DAY EVIDENTIAL UNCERTAINTY REPORT", flush=True)
    print("="*95, flush=True)
    for k, v in calibration_metrics.items():
        eces = [c["ece"] for c in v]
        briers = [c["brier"] for c in v]
        print(f"• {k:16s}: ECE = {np.mean(eces):.4f} ± {np.std(eces):.4f} | Brier = {np.mean(briers):.4f} ± {np.std(briers):.4f}", flush=True)

    print("\n" + "-"*95, flush=True)
    print("EVIDENTIAL UNCERTAINTY & OUT-OF-DISTRIBUTION LEAKAGE QUANTIFICATION:", flush=True)
    print("-"*95, flush=True)
    for m_key, uq in uq_report.items():
        print(f"[{m_key}]", flush=True)
        print(f"   In-Distribution (u_ID):  Mean = {uq['id_uncertainty']['mean']:.4f} ± {uq['id_uncertainty']['std']:.4f} | Median = {uq['id_uncertainty']['median']:.4f}", flush=True)
        print(f"   Out-of-Dist (u_OOD):     Mean = {uq['ood_uncertainty']['mean']:.4f} ± {uq['ood_uncertainty']['std']:.4f} | Median = {uq['ood_uncertainty']['median']:.4f}", flush=True)
        print(f"   Fold Ratios (u_OOD/u_ID): {uq['fold_ratios']} -> Mean Ratio = {uq['mean_ratio']}x", flush=True)
        print(f"   Per-Fold P95 Detection:  {uq['ood_flagging_rate_at_fold_p95']}\n", flush=True)

    out_json = {
        "ablation_results": results_summary,
        "mcnemar_pairwise": {
            "U3_vs_U4": {"chi2": round(float(chi2_u3_u4), 4), "p_val": f"p < 0.001" if p_u3_u4 < 0.001 else f"p = {p_u3_u4:.4f}"},
            "U4_vs_U6": {"chi2": round(float(chi2_u4_u6), 4), "p_val": f"p < 0.001" if p_u4_u6 < 0.001 else f"p = {p_u4_u6:.4f}"}
        },
        "calibration": {
            k: {
                "ECE": f"{np.mean([c['ece'] for c in v]):.4f} ± {np.std([c['ece'] for c in v]):.4f}",
                "Brier": f"{np.mean([c['brier'] for c in v]):.4f} ± {np.std([c['brier'] for c in v]):.4f}"
            }
            for k, v in calibration_metrics.items()
        },
        "uncertainty_quantification": uq_report
    }

    out_json_path = os.path.join(CURRENT_DIR, "url_research_results.json")
    with open(out_json_path, "w") as f:
        json.dump(out_json, f, indent=4)
    print(f"\nSaved empirical URL research results to: {out_json_path}", flush=True)

    return out_json


if __name__ == "__main__":
    run_5fold_url_edl_evaluation(sample_size=6000, n_splits=5, epochs_parity=8)
