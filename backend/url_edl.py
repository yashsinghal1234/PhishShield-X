"""
URL-EDL: Multimodal Lexical-Tabular Neural Architecture with Subjective Logic Evidential Dirichlet Uncertainty.
Generalizes Evidential Deep Learning & Out-of-Distribution Zero-Day Quantification to URL Phishing Detection.
Strict Architectural Parity with Quish-EDL (M6).

Key Enhancements for Numerical Stability:
- CosineEvidenceHead with Temperature Scaling (tau=0.2) and Annealed Angular Margin m_t = m * min(1, t / (T/2))
- Stabilized Dirichlet Expected MSE Loss with gradient-safe KL Divergence
- Decoupled Outlier Exposure (OE) loss with proper ID-masking and conservative lambda_OE (0.05 - 0.10)
"""

import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input, Embedding, Conv1D, MaxPooling1D,
    Dense, Dropout, Flatten, Layer, Lambda, concatenate
)

# Hyperparameters (Strict Parity with Quish-EDL)
MAX_LEN = 180
VOCAB_SIZE = 110
EMBEDDING_DIM = 32
FEATURE_DIM = 32
TABULAR_DIM = 34
NUM_CLASSES = 2  # 0: Safe, 1: Phishing
L2_REG = 5e-4


def kl_divergence_uniform(alpha):
    """Computes analytical KL divergence between Dirichlet(alpha_tilde) and uniform Dirichlet(1, 1)."""
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
    """
    Creates canonical Evidential Deep Learning Loss (Sensoy et al., NeurIPS 2018):
    Expected Mean Squared Error under Dirichlet + Annealed KL Divergence Regularization on False Evidence.
    """
    def loss_fn(y_true, alpha):
        y_flat = tf.reshape(y_true, [-1])
        y_one_hot = tf.one_hot(tf.cast(y_flat, tf.int32), depth=NUM_CLASSES)
        
        alpha_c = tf.clip_by_value(alpha, 1.0, 1e4)
        S = tf.reduce_sum(alpha_c, axis=-1, keepdims=True)
        p = alpha_c / S
        
        # 1. Expected MSE under Dirichlet distribution
        err = tf.reduce_sum(tf.square(y_one_hot - p), axis=-1, keepdims=True)
        var = tf.reduce_sum(p * (1.0 - p) / (S + 1.0), axis=-1, keepdims=True)
        loss_mse = err + var
        
        # 2. KL Divergence Regularization on False Evidence
        alpha_tilde = y_one_hot + (1.0 - y_one_hot) * alpha_c
        kl = kl_divergence_uniform(alpha_tilde)
        
        # Smooth KL Annealing coefficient lambda_t = min(1.0, t / (T / 2))
        anneal = tf.minimum(1.0, epoch_var / (float(total_epochs) / 2.0))
        return tf.reduce_mean(loss_mse + anneal * kl)
    return loss_fn


def create_edl_oe_loss(epoch_var, total_epochs=8, ood_weight=0.08):
    """
    Creates Outlier Exposure (OE) Evidential Loss (Hendrycks et al., ICLR 2019 / Sensoy 2018):
    - ID samples (y >= 0): Strictly compute Expected Dirichlet MSE + KL regularization.
    - OOD samples (y == -1): Strict KL regularization against uniform Dirichlet(1, 1),
      penalizing ANY spurious evidence and driving u = K / S -> 1.0.
    """
    def loss_fn(y_true, alpha):
        y_flat = tf.reshape(y_true, [-1])
        is_id = tf.cast(y_flat >= 0, tf.float32)
        is_ood = 1.0 - is_id
        
        # ID Loss Component
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
        
        # OOD Prior Regularization: Penalize all evidence (target alpha -> [1, 1])
        kl_ood = kl_divergence_uniform(alpha_c)
        loss_ood = is_ood * tf.reshape(kl_ood, [-1])
        
        num_id = tf.maximum(1.0, tf.reduce_sum(is_id))
        num_ood = tf.maximum(1.0, tf.reduce_sum(is_ood))
        
        loss_id_mean = tf.reduce_sum(loss_id) / num_id
        loss_ood_mean = tf.reduce_sum(loss_ood) / num_ood
        
        return loss_id_mean + ood_weight * loss_ood_mean
    return loss_fn


class EpochTracker(tf.keras.callbacks.Callback):
    """Dynamically advances epoch_var for KL annealing during training."""
    def __init__(self, epoch_var, epoch_cb=None):
        super().__init__()
        self.epoch_var = epoch_var
        self.epoch_cb = epoch_cb

    def on_epoch_begin(self, epoch, logs=None):
        self.epoch_var.assign(float(epoch + 1))
        if self.epoch_cb is not None:
            self.epoch_cb(epoch + 1)


class CosineEvidenceHead(Layer):
    """
    Cosine-Normalized Evidential Head with Temperature Scaling and Annealed Margin:
    e_k = scale * ReLU((cos(h, w_k) - m_t) / tau)
    Where:
    - h, w are L2-normalized vectors
    - m_t = margin * min(1.0, epoch_var / (T / 2)) ramps margin smoothly to allow early feature clustering
    - tau is temperature in [0.1, 0.3] preventing over-flat logits and reducing ECE
    """
    def __init__(self, num_classes=NUM_CLASSES, scale=10.0, margin=0.2, temperature=0.2, epoch_var=None, total_epochs=8, **kwargs):
        super().__init__(**kwargs)
        self.num_classes = num_classes
        self.scale = scale
        self.margin = margin
        self.temperature = max(0.05, float(temperature))
        self.epoch_var = epoch_var
        self.total_epochs = total_epochs

    def build(self, input_shape):
        self.w = self.add_weight(
            shape=(input_shape[-1], self.num_classes),
            initializer="glorot_uniform",
            trainable=True,
            name="class_directions"
        )
        super().build(input_shape)

    def call(self, h):
        h_norm = tf.nn.l2_normalize(h, axis=-1)
        w_norm = tf.nn.l2_normalize(self.w, axis=0)
        cos_sim = tf.matmul(h_norm, w_norm)
        
        # Annealed margin schedule coupled with KL annealing: m_t = m * min(1.0, t / (T / 2))
        if self.epoch_var is not None:
            anneal = tf.minimum(1.0, self.epoch_var / (float(self.total_epochs) / 2.0))
            m_t = self.margin * anneal
        else:
            m_t = self.margin

        # Evidence scaled by temperature
        scaled_cos = (cos_sim - m_t) / self.temperature
        evidence = self.scale * tf.nn.relu(scaled_cos)
        return evidence

    def get_config(self):
        config = super().get_config()
        config.update({
            "num_classes": self.num_classes,
            "scale": self.scale,
            "margin": self.margin,
            "temperature": self.temperature,
            "total_epochs": self.total_epochs
        })
        return config


def build_url_edl_model(head_type="edl", scale=10.0, margin=0.2, temperature=0.2, epoch_var=None, total_epochs=8):
    """
    Builds the URL-EDL multimodal lexical-tabular architecture:
    - Lexical Branch (180-char tokens): Copied verbatim from Quish-EDL (quish_cross_edl.py:92-99) with L2 5e-4
    - Tabular Branch (34-D scaled features): Dense(32) with L2 5e-4 + Dropout(0.2)
    - Early Fusion: Concatenation -> Dense(48, L2) -> Dropout(0.2) -> Dense(32, L2)
    - Head Variants:
        - 'softmax': U3 Baseline (Softmax output)
        - 'edl': U4 Vanilla / U5 Outlier Exposure (ReLU Evidence Head -> Alpha)
        - 'cosine': U6 Cosine Margin Evidential Head with Temperature (tau) and Annealed Margin
    """
    # 1. Lexical URL Sequence Stream (180 Tokens) - Exact Quish-EDL Parity
    inp_l = Input(shape=(MAX_LEN,), name="url_seq_input")
    l = Embedding(VOCAB_SIZE, EMBEDDING_DIM, name="url_char_embedding")(inp_l)
    l = Conv1D(FEATURE_DIM, 3, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="lex_conv1d")(l)
    l = MaxPooling1D(6, name="lex_maxpool")(l)
    l = Flatten(name="lex_flatten")(l)
    l_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="lexical_dense")(l)
    l_dense = Dropout(0.2, name="lex_dropout")(l_dense)

    # 2. Learned Tabular Branch (34-D StandardScaled Features)
    inp_t = Input(shape=(TABULAR_DIM,), name="url_tabular_input")
    t_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="tabular_dense")(inp_t)
    t_dense = Dropout(0.2, name="tab_dropout")(t_dense)

    # 3. Multimodal Concatenation & Fusion
    fused = concatenate([l_dense, t_dense], name="early_fusion_concat")
    h = Dense(48, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="fusion_dense_48")(fused)
    h = Dropout(0.2, name="fusion_dropout")(h)
    h = Dense(32, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="fusion_dense_32")(h)

    # 4. Classification / Evidential Head
    if head_type == "softmax":
        out = Dense(NUM_CLASSES, activation="softmax", name="softmax_output")(h)
        model = Model(inputs=[inp_l, inp_t], outputs=out, name="URL_Early_Fusion_Softmax")
    elif head_type == "cosine":
        evidence = CosineEvidenceHead(
            num_classes=NUM_CLASSES,
            scale=scale,
            margin=margin,
            temperature=temperature,
            epoch_var=epoch_var,
            total_epochs=total_epochs,
            name="cosine_evidence"
        )(h)
        alpha = Lambda(lambda e: e + 1.0, name="alpha_output")(evidence)
        model = Model(inputs=[inp_l, inp_t], outputs=alpha, name="URL_EDL_Cosine")
    elif head_type == "edl":
        evidence = Dense(
            NUM_CLASSES,
            activation="relu",
            use_bias=True,
            bias_initializer=tf.keras.initializers.Zeros(),
            kernel_regularizer=tf.keras.regularizers.l2(L2_REG),
            name="evidence"
        )(h)
        alpha = Lambda(lambda e: e + 1.0, name="alpha_output")(evidence)
        model = Model(inputs=[inp_l, inp_t], outputs=alpha, name="URL_EDL_Vanilla")
    else:
        raise ValueError(f"Unknown head_type: {head_type}. Choose 'softmax', 'edl', or 'cosine'.")

    return model


def compute_evidential_outputs(alpha_preds: np.ndarray):
    """
    Computes Belief Masses (b_0, b_1), Expected Probabilities (p), and Epistemic Uncertainty (u)
    under Dempster-Shafer Subjective Logic from Dirichlet concentration parameters alpha.
    """
    S = np.sum(alpha_preds, axis=-1, keepdims=True)
    probs = alpha_preds / S
    beliefs = (alpha_preds - 1.0) / S
    uncertainty = NUM_CLASSES / S.flatten()
    return probs, beliefs, uncertainty
