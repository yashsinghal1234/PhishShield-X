"""
Targeted Single-Fold Tuning Script for U5 (OE) and U6 (Cosine Head).
Validates:
1. U5 with annealed OE loss (ood_weight=0.03, anneal*loss_ood) -> Val Acc > 88%
2. U6 with scale=8.0, annealed margin m_t, no 50x gradient blowup -> Val Acc > 88%, ratio > 1.5x
"""

import os
import sys
import pickle
import numpy as np
import tensorflow as tf
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from url_edl import (
    build_url_edl_model,
    create_edl_loss,
    EpochTracker,
    compute_evidential_outputs,
    MAX_LEN, NUM_CLASSES
)


class STracker(tf.keras.callbacks.Callback):
    def __init__(self, val_inputs, val_y, name="Model"):
        super().__init__()
        self.val_inputs = val_inputs
        self.val_y = val_y
        self.name = name

    def on_epoch_end(self, epoch, logs=None):
        preds = self.model.predict(self.val_inputs, verbose=0)
        S = np.sum(preds, axis=-1)
        mean_S = np.mean(S)
        acc = accuracy_score(self.val_y, np.argmax(preds, axis=1))
        print(f"   [{self.name} Ep {epoch+1}] Val Acc: {acc*100:.2f}% | Mean S_ID: {mean_S:.2f}", flush=True)


def test_u5_and_u6():
    data = np.load(os.path.join(CURRENT_DIR, "url_data_cache_6000.npz"), allow_pickle=True)
    X_seq, X_tab, y = data["X_seq"], data["X_tab"], data["y"]
    X_seq_ood, X_tab_ood = data["X_seq_ood"], data["X_tab_ood"]

    skf = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
    train_idx, val_idx = next(skf.split(X_seq, y))

    train_s, val_s = X_seq[train_idx], X_seq[val_idx]
    train_t_raw, val_t_raw = X_tab[train_idx], X_tab[val_idx]
    train_y, val_y = y[train_idx], y[val_idx]

    scaler = StandardScaler()
    train_t = scaler.fit_transform(train_t_raw)
    val_t = scaler.transform(val_t_raw)
    ood_t = scaler.transform(X_tab_ood)

    print("=== TESTING TUNED U5 (Annealed OE, ood_weight=0.03, 5% outliers) ===", flush=True)
    n_outliers = int(0.05 * len(train_y))
    ood_train_idx = np.random.choice(len(X_seq_ood), size=n_outliers, replace=True)
    oe_seq = np.concatenate([train_s, X_seq_ood[ood_train_idx]], axis=0)
    oe_tab = np.concatenate([train_t, ood_t[ood_train_idx]], axis=0)
    oe_y = np.concatenate([train_y, -1 * np.ones(n_outliers, dtype=np.int32)], axis=0)
    perm = np.random.permutation(len(oe_y))
    oe_seq, oe_tab, oe_y = oe_seq[perm], oe_tab[perm], oe_y[perm]

    def create_edl_oe_loss_annealed(epoch_var, total_epochs=8, ood_weight=0.03):
        from url_edl import kl_divergence_uniform
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
            
            # Key fix: anneal the OOD penalty so ID evidence can form in early epochs
            return (tf.reduce_sum(loss_id) / num_id) + ood_weight * anneal * (tf.reduce_sum(loss_ood) / num_ood)
        return loss_fn

    epoch_var5 = tf.Variable(1.0, trainable=False, dtype=tf.float32)
    u5 = build_url_edl_model(head_type="edl")
    u5.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=2e-4, clipnorm=1.0),
        loss=create_edl_oe_loss_annealed(epoch_var5, total_epochs=8, ood_weight=0.03)
    )
    u5.fit(
        [oe_seq, oe_tab], oe_y,
        epochs=8, batch_size=64,
        callbacks=[EpochTracker(epoch_var5), STracker([val_s, val_t], val_y, name="U5")],
        verbose=0
    )
    alpha_val5 = u5.predict([val_s, val_t], verbose=0)
    alpha_ood5 = u5.predict([X_seq_ood, ood_t], verbose=0)
    _, _, u_id5 = compute_evidential_outputs(alpha_val5)
    _, _, u_ood5 = compute_evidential_outputs(alpha_ood5)
    acc5 = accuracy_score(val_y, np.argmax(alpha_val5, axis=1))
    print(f"==> U5 Acc: {acc5*100:.2f}% | u_ID: {np.mean(u_id5):.4f} | u_OOD: {np.mean(u_ood5):.4f} | Ratio: {np.mean(u_ood5)/np.mean(u_id5):.3f}x\n", flush=True)

    print("=== TESTING TUNED U6 (Cosine Head: scale=8.0, direct angular margin m=0.15 annealed) ===", flush=True)
    # Cosine evidence without temperature gradient blowup: evidence = scale * relu(cos - m_t)
    class DirectCosineEvidenceHead(tf.keras.layers.Layer):
        def __init__(self, num_classes=2, scale=8.0, margin=0.15, epoch_var=None, total_epochs=8, **kwargs):
            super().__init__(**kwargs)
            self.num_classes = num_classes
            self.scale = scale
            self.margin = margin
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
            if self.epoch_var is not None:
                anneal = tf.minimum(1.0, self.epoch_var / (float(self.total_epochs) / 2.0))
                m_t = self.margin * anneal
            else:
                m_t = self.margin
            return self.scale * tf.nn.relu(cos_sim - m_t)

    from tensorflow.keras.layers import Input, Embedding, Conv1D, MaxPooling1D, Dense, Dropout, Flatten, Lambda, concatenate
    inp_l = Input(shape=(MAX_LEN,))
    l = Embedding(110, 32)(inp_l)
    l = Conv1D(32, 3, padding="same", activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(l)
    l = MaxPooling1D(6)(l)
    l = Flatten()(l)
    l_dense = Dense(32, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(l)
    l_dense = Dropout(0.2)(l_dense)

    inp_t = Input(shape=(34,))
    t_dense = Dense(32, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(inp_t)
    t_dense = Dropout(0.2)(t_dense)

    fused = concatenate([l_dense, t_dense])
    h = Dense(48, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(fused)
    h = Dropout(0.2)(h)
    h = Dense(32, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(5e-4))(h)

    epoch_var6 = tf.Variable(1.0, trainable=False, dtype=tf.float32)
    ev6 = DirectCosineEvidenceHead(scale=8.0, margin=0.15, epoch_var=epoch_var6, total_epochs=8)(h)
    alpha6 = Lambda(lambda e: e + 1.0)(ev6)
    u6 = tf.keras.models.Model(inputs=[inp_l, inp_t], outputs=alpha6)
    u6.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=2e-4, clipnorm=1.0),
        loss=create_edl_loss(epoch_var6, total_epochs=8)
    )
    u6.fit(
        [train_s, train_t], train_y,
        epochs=8, batch_size=64,
        callbacks=[EpochTracker(epoch_var6), STracker([val_s, val_t], val_y, name="U6")],
        verbose=0
    )
    alpha_val6 = u6.predict([val_s, val_t], verbose=0)
    alpha_ood6 = u6.predict([X_seq_ood, ood_t], verbose=0)
    _, _, u_id6 = compute_evidential_outputs(alpha_val6)
    _, _, u_ood6 = compute_evidential_outputs(alpha_ood6)
    acc6 = accuracy_score(val_y, np.argmax(alpha_val6, axis=1))
    print(f"==> U6 Acc: {acc6*100:.2f}% | u_ID: {np.mean(u_id6):.4f} | u_OOD: {np.mean(u_ood6):.4f} | Ratio: {np.mean(u_ood6)/np.mean(u_id6):.3f}x\n", flush=True)


if __name__ == "__main__":
    test_u5_and_u6()
