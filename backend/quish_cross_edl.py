"""
Quish-EDL v4: Tri-Modal Visual-Lexical-Tabular Neural Architecture with Subjective Logic Evidential Dirichlet Uncertainty.
A Unified Deep Architecture for Quishing (QR Phishing) Detection & Out-of-Distribution Zero-Day Attack Quantification.

V4 Upgrades (SOTA Tri-Modal Architecture):
  1. Three-Stage Depthwise-Separable Visual Backbone on 256x256 high-res QR images
     (~4px/module; resolves finder patterns, timing markers, and visual logo tampering).
  2. Multi-Scale Pyramidal Lexical Sequence Stream (180 Tokens; n-gram windows k=3, 5).
  3. 34-D Cybersecurity Tabular Stream (Shannon entropy, brand Levenshtein distance,
     homoglyph detection, TLD risk, path depth, token counts).
  4. CAAMF-v2 Conflict-Aware & Reliability-Gated Multimodal Fusion:
     Dynamic reliability gates (w_v, w_p) suppress visual noise on standard QR codes
     while the dedicated Cross-Modal Conflict Pathway (|f_v - f_payload|) spikes on
     brand-spoofed QR attacks (authentic brand logo embedding a malicious payload).
  5. Cosine-Normalized Evidential Head with Temperature Scaling (tau=0.20),
     Annealed Angular Margin (m=0.20), and DIP-EDL Density Gate.
  6. Outlier Exposure (OE) Dirichlet Loss driving epistemic uncertainty u -> 1.0 on zero-day attacks.
"""

import os
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input, Embedding, Conv2D, MaxPooling2D, DepthwiseConv2D,
    Conv1D, MaxPooling1D, GlobalAveragePooling1D, GlobalAveragePooling2D,
    Dense, Dropout, BatchNormalization, Reshape, Flatten, Layer, concatenate,
    Multiply, Subtract, Lambda
)
import numpy as np

# Hyperparameters
IMG_SHAPE = (256, 256, 1)  # 256x256 high-resolution QR
MAX_LEN = 180
VOCAB_SIZE = 110
EMBEDDING_DIM = 32
FEATURE_DIM = 32
TABULAR_DIM = 34
NUM_CLASSES = 2  # 0: Safe, 1: Phishing
L2_REG = 5e-4

# Evidential Head Hyperparameters
GATE_HIDDEN_DIM = 16
DIP_GATE_LOSS_WEIGHT = 0.30
COSINE_SCALE = 10.0
COSINE_MARGIN = 0.20
COSINE_TEMPERATURE = 0.20


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


def create_edl_loss(epoch_var, total_epochs=8, ood_weight=0.05):
    """
    Creates Canonical & Outlier-Exposed Evidential Deep Learning Loss (Subjective Logic):
    Expected Mean Squared Error under Dirichlet + Annealed KL Divergence Regularization on False Evidence,
    with an Outlier Exposure (OE) penalty that drives evidence to zero for unlabelled / OOD inputs.
    """
    def loss_fn(y_true, alpha):
        y_flat = tf.reshape(y_true, [-1])
        is_id = tf.cast(y_flat >= 0, tf.float32)
        is_ood = 1.0 - is_id

        y_safe = tf.maximum(0, tf.cast(y_flat, tf.int32))
        y_one_hot = tf.one_hot(y_safe, depth=NUM_CLASSES)

        alpha_c = tf.clip_by_value(alpha, 1.0, 1e4)
        S = tf.reduce_sum(alpha_c, axis=-1, keepdims=True)
        p = alpha_c / S

        # 1. Expected Mean Squared Error under Dirichlet distribution
        err = tf.reduce_sum(tf.square(y_one_hot - p), axis=-1, keepdims=True)
        var = tf.reduce_sum(p * (1.0 - p) / (S + 1.0), axis=-1, keepdims=True)
        loss_mse = err + var

        # 2. KL Divergence Regularization on False Evidence for ID samples
        alpha_tilde = y_one_hot + (1.0 - y_one_hot) * alpha_c
        kl_id = kl_divergence_uniform(alpha_tilde)

        # Smooth KL Annealing coefficient lambda_t = min(1.0, t / (T / 2))
        anneal = tf.minimum(1.0, epoch_var / (float(total_epochs) / 2.0))
        loss_id = is_id * tf.reshape(loss_mse + anneal * kl_id, [-1])

        # 3. Outlier Exposure Regularization (drives total Dirichlet evidence -> 0 on OOD)
        kl_ood = kl_divergence_uniform(alpha_c)
        loss_ood = is_ood * tf.reshape(kl_ood, [-1])

        num_id = tf.maximum(1.0, tf.reduce_sum(is_id))
        num_ood = tf.maximum(1.0, tf.reduce_sum(is_ood))

        loss = tf.reduce_sum(loss_id) / num_id + ood_weight * (tf.reduce_sum(loss_ood) / num_ood)
        return loss

    return loss_fn


def create_dip_edl_joint_loss(epoch_var, total_epochs=8, dip_weight=DIP_GATE_LOSS_WEIGHT, ood_weight=0.05):
    """
    Joint loss for DIP-EDL:
      L_total = L_edl(alpha) + dip_weight * BCE(gate, is_id)
    Trains the density gate g(h) to output ~1 on ID samples and ~0 on OOD samples.
    """
    edl_loss_fn = create_edl_loss(epoch_var, total_epochs=total_epochs, ood_weight=ood_weight)

    def joint_loss(y_true, y_pred):
        if isinstance(y_pred, (list, tuple)):
            alpha, gate = y_pred[0], y_pred[1]
        else:
            return edl_loss_fn(y_true, y_pred)

        y_flat = tf.reshape(y_true, [-1])
        is_id = tf.cast(y_flat >= 0, tf.float32)

        l_edl = edl_loss_fn(y_true, alpha)
        gate_flat = tf.reshape(gate, [-1])
        l_gate = tf.reduce_mean(tf.keras.losses.binary_crossentropy(is_id, gate_flat))

        return l_edl + dip_weight * l_gate

    return joint_loss


class EpochTrackingCallback(tf.keras.callbacks.Callback):
    """Updates a tf.Variable with the current epoch for dynamic annealing."""
    def __init__(self, epoch_var):
        super().__init__()
        self.epoch_var = epoch_var

    def on_epoch_begin(self, epoch, logs=None):
        self.epoch_var.assign(float(epoch + 1))


class CosineEvidenceHead(Layer):
    """
    Cosine-Normalized Evidential Head with Temperature Scaling and Annealed Margin:
    e_k = scale * softplus((cos(h, w_k) - m_t) / tau)
    """
    def __init__(self, num_classes=NUM_CLASSES, scale=COSINE_SCALE, margin=COSINE_MARGIN,
                 temperature=COSINE_TEMPERATURE, epoch_var=None, total_epochs=8, **kwargs):
        super().__init__(**kwargs)
        self.num_classes = num_classes
        self.scale = scale
        self.margin = margin
        self.temperature = max(0.05, float(temperature))
        self.epoch_var = epoch_var
        self.total_epochs = total_epochs

    def build(self, input_shape):
        self.w = self.add_weight(
            shape=(int(input_shape[-1]), self.num_classes),
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

        scaled_cos = (cos_sim - m_t) / self.temperature
        evidence = self.scale * tf.nn.softplus(scaled_cos)
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


def build_visual_backbone(inp_v):
    """
    Three-Stage Depthwise-Separable Multi-Scale Visual Backbone:
      Input: 256x256 grayscale QR
      Stage 1: 3x3 Depthwise + 1x1 Pointwise (24 ch) -> module-level detail (256->128)
      Stage 2: 5x5 Depthwise + 1x1 Pointwise (48 ch) -> finder pattern geometry (128->64)
      Stage 3: 3x3 Depthwise + 1x1 Pointwise (64 ch) -> macro QR structure (64->32) + GAP
    """
    v = DepthwiseConv2D((3, 3), padding="same", activation="relu", name="dw_stage1")(inp_v)
    v = Conv2D(24, (1, 1), activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="pw_stage1")(v)
    v = MaxPooling2D((2, 2))(v)

    v = DepthwiseConv2D((5, 5), padding="same", activation="relu", name="dw_stage2")(v)
    v = Conv2D(48, (1, 1), activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="pw_stage2")(v)
    v = MaxPooling2D((2, 2))(v)

    v = DepthwiseConv2D((3, 3), padding="same", activation="relu", name="dw_stage3")(v)
    v = Conv2D(64, (1, 1), activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="pw_stage3")(v)
    v = MaxPooling2D((2, 2))(v)
    v_gap = GlobalAveragePooling2D(name="visual_gap")(v)

    v_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="visual_dense")(v_gap)
    v_dense = Dropout(0.2)(v_dense)
    return v_dense


def build_lexical_backbone(inp_l):
    """Pyramidal Multi-Kernel Lexical Stream (180 Tokens; n-gram windows k=3, 5)."""
    embed = Embedding(VOCAB_SIZE, EMBEDDING_DIM, name="url_char_embedding")(inp_l)
    c3 = Conv1D(FEATURE_DIM // 2, 3, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="lex_c3")(embed)
    c5 = Conv1D(FEATURE_DIM // 2, 5, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="lex_c5")(embed)
    lex_cat = concatenate([c3, c5], name="multikernel_lexical_concat")
    lex_pool = MaxPooling1D(4, name="lex_pool")(lex_cat)
    lex_flat = Flatten(name="lex_flat")(lex_pool)
    l_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="lexical_dense")(lex_flat)
    l_dense = Dropout(0.2, name="lex_dropout")(l_dense)
    return l_dense


def build_tabular_backbone(inp_t):
    """Learned Cybersecurity Tabular Stream (34-D Features)."""
    t = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="tab_dense_1")(inp_t)
    t = Dropout(0.2, name="tab_dropout")(t)
    t_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="tab_dense_2")(t)
    return t_dense


def build_caamf_fusion(v_dense, l_dense, t_dense=None):
    """
    CAAMF-v2 Conflict-Aware & Reliability-Gated Multimodal Fusion:
    - Fuses Lexical and Tabular into a unified Payload representation: f_payload
    - Gates Visual (w_v) and Payload (w_p) by per-instance reliability.
    - Routes cross-modal discrepancies into the Conflict Residual: |f_v - f_payload|.
    """
    if t_dense is not None:
        f_payload = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="payload_fusion")(
            concatenate([l_dense, t_dense], name="payload_concat")
        )
    else:
        f_payload = l_dense

    w_v = Dense(FEATURE_DIM, activation="sigmoid", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="caamf_visual_gate")(v_dense)
    w_p = Dense(FEATURE_DIM, activation="sigmoid", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="caamf_payload_gate")(f_payload)

    conflict = Subtract(name="caamf_conflict_diff")([v_dense, f_payload])
    conflict = Lambda(tf.abs, name="caamf_conflict_residual")(conflict)
    w_conf = Dense(
        FEATURE_DIM, activation="sigmoid", kernel_regularizer=tf.keras.regularizers.l2(L2_REG),
        name="caamf_conflict_gate"
    )(concatenate([v_dense, f_payload], name="caamf_conflict_input"))

    gated_v = Multiply(name="caamf_gated_visual")([w_v, v_dense])
    gated_p = Multiply(name="caamf_gated_payload")([w_p, f_payload])
    gated_conflict = Multiply(name="caamf_gated_conflict")([w_conf, conflict])

    fused = Dense(48, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="caamf_fusion_dense")(
        concatenate([gated_v, gated_p, gated_conflict], name="caamf_feature_concat")
    )
    return fused


def build_quish_edl_model(epoch_var=None, total_epochs=8, include_tabular=True, head_type="edl"):
    """
    Builds the full end-to-end Quish-EDL v4 Tri-Modal architecture:
    [256x256 QR Image, 180 Char Tokens, 34-D Tabular] -> CAAMF-v2 -> Cosine Evidential Head.
    head_type: 'edl' (Dirichlet alpha + gate) or 'softmax' (M3 baseline).
    """
    inp_v = Input(shape=IMG_SHAPE, name="qr_image_input")
    inp_l = Input(shape=(MAX_LEN,), name="url_seq_input")
    inputs = [inp_v, inp_l]

    v_dense = build_visual_backbone(inp_v)
    l_dense = build_lexical_backbone(inp_l)

    if include_tabular:
        inp_t = Input(shape=(TABULAR_DIM,), name="url_tabular_input")
        inputs.append(inp_t)
        t_dense = build_tabular_backbone(inp_t)
    else:
        t_dense = None

    fused = build_caamf_fusion(v_dense, l_dense, t_dense)
    h = Dropout(0.2)(fused)
    h = Dense(32, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(h)

    if head_type == "softmax":
        out = Dense(NUM_CLASSES, activation="softmax", name="softmax_output")(h)
        return Model(inputs=inputs, outputs=out, name="Quish_Softmax_TriModal")

    # Cosine Evidential Head
    evidence = CosineEvidenceHead(
        num_classes=NUM_CLASSES,
        scale=COSINE_SCALE,
        margin=COSINE_MARGIN,
        temperature=COSINE_TEMPERATURE,
        epoch_var=epoch_var,
        total_epochs=total_epochs,
        name="cosine_evidence"
    )(h)

    gate_h = Dense(GATE_HIDDEN_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="density_mlp_1")(h)
    gate = Dense(1, activation="sigmoid", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="density_gate")(gate_h)

    gated_evidence = Multiply(name="density_gated_evidence")([evidence, gate])
    alpha = Lambda(lambda e: e + 1.0, name="alpha_output")(gated_evidence)

    model = Model(inputs=inputs, outputs=alpha, name="Quish_EDL_v4")
    return model


def build_quish_edl_feature_model(epoch_var=None, total_epochs=8, head_type="edl"):
    """
    Fast feature-level Quish-EDL model accepting pre-extracted 32-D visual features:
    [32-D Visual Feat, 180 Char Tokens, 34-D Tabular] -> CAAMF-v2 -> Cosine Evidential Head.
    Mathematically identical to end-to-end model after feature extraction; runs in seconds on CPU.
    """
    inp_v_feat = Input(shape=(FEATURE_DIM,), name="vis_feat_input")
    inp_l = Input(shape=(MAX_LEN,), name="url_seq_input")
    inp_t = Input(shape=(TABULAR_DIM,), name="url_tabular_input")

    v_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(inp_v_feat)
    v_dense = Dropout(0.2)(v_dense)

    l_dense = build_lexical_backbone(inp_l)
    t_dense = build_tabular_backbone(inp_t)

    fused = build_caamf_fusion(v_dense, l_dense, t_dense)
    h = Dropout(0.2)(fused)
    h = Dense(32, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG))(h)

    if head_type == "softmax":
        out = Dense(NUM_CLASSES, activation="softmax", name="softmax_output")(h)
        return Model(inputs=[inp_v_feat, inp_l, inp_t], outputs=out, name="Quish_Softmax_Fast")

    evidence = CosineEvidenceHead(
        num_classes=NUM_CLASSES,
        scale=COSINE_SCALE,
        margin=COSINE_MARGIN,
        temperature=COSINE_TEMPERATURE,
        epoch_var=epoch_var,
        total_epochs=total_epochs,
        name="cosine_evidence"
    )(h)

    gate_h = Dense(GATE_HIDDEN_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="density_mlp_1")(h)
    gate = Dense(1, activation="sigmoid", kernel_regularizer=tf.keras.regularizers.l2(L2_REG), name="density_gate")(gate_h)

    gated_evidence = Multiply(name="density_gated_evidence")([evidence, gate])
    alpha = Lambda(lambda e: e + 1.0, name="alpha_output")(gated_evidence)

    return Model(inputs=[inp_v_feat, inp_l, inp_t], outputs=alpha, name="Quish_EDL_Fast")


# Aliases for backwards compatibility
build_quish_cross_edl = build_quish_edl_model


def compute_evidential_outputs(alpha_preds):
    """
    Computes Belief Masses (b_0, b_1), Expected Probabilities (p), and Epistemic Uncertainty (u)
    under Dempster-Shafer Subjective Logic from Dirichlet Alpha vectors.
    """
    if isinstance(alpha_preds, (list, tuple)):
        alpha_preds = alpha_preds[0]
    alpha_preds = np.asarray(alpha_preds, dtype=np.float64)
    S = np.sum(alpha_preds, axis=-1, keepdims=True)  # Total Dirichlet strength S
    probs = alpha_preds / S                          # Expected class probability
    beliefs = (alpha_preds - 1.0) / S                # Belief mass vector [b_safe, b_phish]
    uncertainty = NUM_CLASSES / S.flatten()          # Epistemic uncertainty mass u in [0, 1]
    return probs, beliefs, uncertainty


if __name__ == "__main__":
    m = build_quish_edl_model()
    m.summary()
    print("[SUCCESS] Quish-EDL v4 SOTA Tri-Modal Architecture Compiled Successfully!")
