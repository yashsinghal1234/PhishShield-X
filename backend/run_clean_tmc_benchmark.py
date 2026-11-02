"""
Evaluation of Trusted Multi-View Classification (TMC / Dempster-Shafer Fusion)
on the Clean Artifact-Controlled Quishing Dataset.
Evaluates:
- ID Accuracy & AUROC
- Dempster-Shafer Conflict Mass C on Modality Conflict vs Clean Samples
- Visual Opinion vs Lexical Opinion Behavior
"""

import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_DETERMINISTIC_OPS"] = "1"

import numpy as np
import tensorflow as tf
tf.random.set_seed(42)
np.random.seed(42)

from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input, Embedding, Conv2D, MaxPooling2D,
    Conv1D, MaxPooling1D, Dense, Dropout, Flatten, Layer, concatenate, Lambda
)
from sklearn.metrics import roc_auc_score, accuracy_score
import json

IMG_SHAPE = (64, 64, 1)
MAX_LEN = 180
VOCAB_SIZE = 180
NUM_CLASSES = 2
FEATURE_DIM = 32

class DempsterShaferFusion(Layer):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def call(self, inputs):
        e_v, e_l = inputs
        alpha_v = e_v + 1.0
        alpha_l = e_l + 1.0
        
        S_v = tf.reduce_sum(alpha_v, axis=-1, keepdims=True)
        S_l = tf.reduce_sum(alpha_l, axis=-1, keepdims=True)
        
        b_v = e_v / S_v
        u_v = float(NUM_CLASSES) / S_v
        
        b_l = e_l / S_l
        u_l = float(NUM_CLASSES) / S_l
        
        # Conflict mass C = b_v0 * b_l1 + b_v1 * b_l0
        C = b_v[:, 0:1] * b_l[:, 1:2] + b_v[:, 1:2] * b_l[:, 0:1]
        denom = 1.0 - C + 1e-6
        
        # Fused beliefs and uncertainty
        b_fused = (b_v * b_l + b_v * u_l + b_l * u_v) / denom
        u_fused = (u_v * u_l) / denom
        
        S_fused = float(NUM_CLASSES) / tf.clip_by_value(u_fused, 1e-4, 1.0)
        alpha_fused = b_fused * S_fused + 1.0
        
        return [alpha_fused, alpha_v, alpha_l, C, u_fused]

def build_tmc_model():
    # 1. Visual Branch
    inp_v = Input(shape=IMG_SHAPE, name="vis_input")
    v = Conv2D(16, (3, 3), padding="same", activation="relu")(inp_v)
    v = MaxPooling2D((4, 4))(v)
    v = Flatten()(v)
    v_dense = Dense(FEATURE_DIM, activation="relu")(v)
    v_dense = Dropout(0.2)(v_dense)
    z_v = Dense(NUM_CLASSES)(v_dense)
    e_v = Lambda(lambda x: tf.exp(tf.clip_by_value(x, -6.0, 4.0)), name="vis_evidence")(z_v)

    # 2. Lexical Branch
    inp_l = Input(shape=(MAX_LEN,), name="lex_input")
    embed = Embedding(VOCAB_SIZE, 32)(inp_l)
    c3 = Conv1D(16, 3, padding="same", activation="relu")(embed)
    c5 = Conv1D(16, 5, padding="same", activation="relu")(embed)
    lex_cat = concatenate([c3, c5])
    lex_pool = MaxPooling1D(6)(lex_cat)
    lex_flat = Flatten()(lex_pool)
    l_dense = Dense(FEATURE_DIM, activation="relu")(lex_flat)
    l_dense = Dropout(0.2)(l_dense)
    z_l = Dense(NUM_CLASSES)(l_dense)
    e_l = Lambda(lambda x: tf.exp(tf.clip_by_value(x, -6.0, 4.0)), name="lex_evidence")(z_l)

    # 3. Dempster-Shafer Combination
    alpha_fused, alpha_v, alpha_l, C, u_fused = DempsterShaferFusion()([e_v, e_l])

    model = Model(inputs=[inp_v, inp_l], outputs=[alpha_fused, alpha_v, alpha_l, C, u_fused])
    return model

def tmc_loss(y_true, alpha_fused, alpha_v, alpha_l):
    y_flat = tf.reshape(y_true, [-1])
    is_id = tf.cast(y_flat >= 0, tf.float32)
    y_safe = tf.maximum(0, tf.cast(y_flat, tf.int32))
    y_one_hot = tf.one_hot(y_safe, depth=NUM_CLASSES)
    
    def bayes_risk(alpha):
        S = tf.reduce_sum(alpha, axis=-1, keepdims=True)
        return tf.reduce_sum(y_one_hot * (tf.math.digamma(S) - tf.math.digamma(alpha)), axis=-1)

    loss_fused = bayes_risk(alpha_fused)
    loss_v = bayes_risk(alpha_v)
    loss_l = bayes_risk(alpha_l)
    
    total = is_id * (loss_fused + loss_v + loss_l)
    return tf.reduce_sum(total) / tf.maximum(1.0, tf.reduce_sum(is_id))

def run_tmc():
    print("=" * 70)
    print("TRAINING TRUSTED MULTI-VIEW CLASSIFICATION (TMC) ON CLEAN DATA")
    print("=" * 70)

    id_data = np.load("backend/data/clean_quishing_id.npz")
    X_v = id_data['images']
    X_l = id_data['sequences']
    y_id = id_data['labels']
    
    ood_data = np.load("backend/data/clean_quishing_ood.npz")
    X_v_ood = ood_data['images']
    X_l_ood = ood_data['sequences']
    fam_ood = ood_data['families']
    
    val_idx = np.random.choice(len(y_id), size=int(0.2 * len(y_id)), replace=False)
    train_idx = np.setdiff1d(np.arange(len(y_id)), val_idx)
    
    X_v_tr, X_l_tr, y_tr = X_v[train_idx], X_l[train_idx], y_id[train_idx]
    X_v_val, X_l_val, y_val = X_v[val_idx], X_l[val_idx], y_id[val_idx]
    
    model = build_tmc_model()
    optimizer = tf.keras.optimizers.Adam(1e-3)
    
    # Custom training loop
    dataset = tf.data.Dataset.from_tensor_slices(((X_v_tr, X_l_tr), y_tr)).shuffle(2048).batch(32)
    
    for epoch in range(8):
        loss_ep = 0.0
        steps = 0
        for (xv_b, xl_b), yb in dataset:
            with tf.GradientTape() as tape:
                a_fused, a_v, a_l, C_val, u_f = model([xv_b, xl_b], training=True)
                loss = tmc_loss(yb, a_fused, a_v, a_l)
            grads = tape.gradient(loss, model.trainable_variables)
            optimizer.apply_gradients(zip(grads, model.trainable_variables))
            loss_ep += float(loss)
            steps += 1
        print(f"Epoch {epoch+1}/8 - TMC Loss: {loss_ep/steps:.4f}")
        
    # Evaluate on ID Val
    a_fused_val, a_v_val, a_l_val, C_id_val, u_fused_val = model.predict([X_v_val, X_l_val], verbose=0)
    p_fused = (a_fused_val / np.sum(a_fused_val, axis=-1, keepdims=True))[:, 1]
    acc_tmc = accuracy_score(y_val, p_fused >= 0.5)
    auc_tmc = roc_auc_score(y_val, p_fused)
    
    print(f"\n--- In-Distribution Performance ---")
    print(f"TMC Fused Accuracy: {acc_tmc*100:.2f}% (AUROC: {auc_tmc:.4f})")
    print(f"ID Mean Conflict Mass C: {np.mean(C_id_val):.4f} +/- {np.std(C_id_val):.4f}")
    
    # Evaluate across held-out OOD families
    print(f"\n--- Held-Out OOD & Modality Conflict Evaluation ---")
    for fam in np.unique(fam_ood):
        mask = (fam_ood == fam)
        a_f_fam, a_v_fam, a_l_fam, C_fam, u_fam = model.predict([X_v_ood[mask], X_l_ood[mask]], verbose=0)
        p_fam = (a_f_fam / np.sum(a_f_fam, axis=-1, keepdims=True))[:, 1]
        print(f"Family: {fam:25s} | Mean C = {np.mean(C_fam):.4f} | Mean u_fused = {np.mean(u_fam):.4f} | Mean P(Phish) = {np.mean(p_fam)*100:.1f}%")

    # Conflict AUROC: Can Conflict Mass C separate Modality Conflict attacks from Clean ID?
    mask_mc = (fam_ood == 'modality_conflict')
    _, _, _, C_mc, _ = model.predict([X_v_ood[mask_mc], X_l_ood[mask_mc]], verbose=0)
    
    y_conflict_eval = np.concatenate([np.zeros(len(C_id_val)), np.ones(len(C_mc))])
    scores_conflict_eval = np.concatenate([C_id_val.flatten(), C_mc.flatten()])
    auc_conflict = roc_auc_score(y_conflict_eval, scores_conflict_eval)
    print(f"\nModality Conflict Detection AUROC (Conflict Mass C): {auc_conflict:.4f}")
    print("=" * 70)

if __name__ == "__main__":
    run_tmc()

