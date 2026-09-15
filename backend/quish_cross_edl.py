"""
Quish-EDL: Multimodal Visual-Lexical Neural Architecture with Subjective Logic Evidential Dirichlet Uncertainty Estimation.
A Unified Deep Architecture for Quishing (QR Phishing) Detection & Out-of-Distribution Zero-Day Attack Quantification.
"""

import os
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input, Embedding, Conv2D, MaxPooling2D, DepthwiseConv2D,
    Conv1D, MaxPooling1D, GlobalAveragePooling1D, Dense, Dropout,
    BatchNormalization, Reshape, Flatten, Layer, concatenate
)
import numpy as np

# Hyperparameters
IMG_SHAPE = (64, 64, 1)
MAX_LEN = 180
VOCAB_SIZE = 110
EMBEDDING_DIM = 32
FEATURE_DIM = 32
NUM_CLASSES = 2  # 0: Safe, 1: Phishing


def kl_divergence_uniform(alpha):
    """Computes KL divergence between Dirichlet(alpha_tilde) and uniform Dirichlet(1, 1)."""
    beta = tf.ones((1, NUM_CLASSES), dtype=tf.float32)
    S_alpha = tf.reduce_sum(alpha, axis=-1, keepdims=True)
    S_beta = tf.reduce_sum(beta, axis=-1, keepdims=True)
    
    lnB = tf.math.lgamma(S_alpha) - tf.reduce_sum(tf.math.lgamma(alpha), axis=-1, keepdims=True)
    lnB_uni = tf.reduce_sum(tf.math.lgamma(beta), axis=-1, keepdims=True) - tf.math.lgamma(S_beta)
    
    dg0 = tf.math.digamma(S_alpha)
    dg1 = tf.math.digamma(alpha)
    
    kl = tf.reduce_sum((alpha - beta) * (dg1 - dg0), axis=-1, keepdims=True) + lnB + lnB_uni
    return kl


def create_edl_loss(epoch_var, total_epochs=10):
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
        
        # 1. Expected Mean Squared Error under Dirichlet distribution
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


class EpochTracker(tf.keras.callbacks.Callback):
    """Keras Callback to dynamically advance the epoch variable for KL annealing."""
    def __init__(self, epoch_var):
        super().__init__()
        self.epoch_var = epoch_var

    def on_epoch_begin(self, epoch, logs=None):
        self.epoch_var.assign(float(epoch + 1))


def build_quish_edl_model():
    """
    Builds the unified Quish-EDL multimodal architecture:
    Spatial QR Visual Extractor + Pyramidal Lexical Sequence Extractor + Multimodal Fusion + Evidential Dirichlet Head.
    """
    # 1. Spatial QR Visual Stream (64x64 Grayscale)
    inp_v = Input(shape=IMG_SHAPE, name="qr_image_input")
    v = Conv2D(16, (3, 3), padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(inp_v)
    v = MaxPooling2D((4, 4))(v)
    v = Flatten()(v)
    v_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4), name="visual_dense")(v)
    v_dense = Dropout(0.2)(v_dense)

    # 2. Lexical URL Sequence Stream (180 Tokens)
    inp_l = Input(shape=(MAX_LEN,), name="url_seq_input")
    l = Embedding(VOCAB_SIZE, EMBEDDING_DIM)(inp_l)
    l = Conv1D(FEATURE_DIM, 3, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(l)
    l = MaxPooling1D(6)(l)
    l = Flatten()(l)
    l_dense = Dense(FEATURE_DIM, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4), name="lexical_dense")(l)
    l_dense = Dropout(0.2)(l_dense)

    # 3. Multimodal Dense Representation
    fused = concatenate([v_dense, l_dense], name="multimodal_concatenation")
    h = Dense(48, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(fused)
    h = Dropout(0.2)(h)
    h = Dense(32, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(h)

    # 4. Evidential Dirichlet Head
    # Evidence e >= 0 via ReLU: alpha_k = e_k + 1.0 with zero-bias initialization
    evidence = Dense(
        NUM_CLASSES,
        activation="relu",
        use_bias=True,
        bias_initializer=tf.keras.initializers.Zeros(),
        kernel_regularizer=tf.keras.regularizers.l2(5e-4),
        name="evidence"
    )(h)
    alpha = tf.keras.layers.Lambda(lambda e: e + 1.0, name="alpha_output")(evidence)

    model = Model(inputs=[inp_v, inp_l], outputs=alpha, name="Quish_EDL")
    return model


# Alias for backwards compatibility
build_quish_cross_edl = build_quish_edl_model


def compute_evidential_outputs(alpha_preds: np.ndarray):
    """
    Computes Belief Masses (b_0, b_1), Expected Probabilities (p), and Epistemic Uncertainty (u)
    under Dempster-Shafer Subjective Logic from Dirichlet Alpha vectors.
    """
    S = np.sum(alpha_preds, axis=-1, keepdims=True)  # Total evidence strength S
    probs = alpha_preds / S                          # Expected class probability
    beliefs = (alpha_preds - 1.0) / S                # Belief mass vector [b_safe, b_phish]
    uncertainty = NUM_CLASSES / S.flatten()          # Epistemic uncertainty mass u in [0, 1]
    return probs, beliefs, uncertainty


if __name__ == "__main__":
    m = build_quish_edl_model()
    m.summary()
    print("Quish-EDL compiled successfully!")
