"""
PhishShield-X: Comprehensive Machine Learning & Deep Learning Benchmarking Suite
Automated Empirical Evaluation & Ablation Study for Academic Research Paper Submission.

Generates comparative performance metrics across 5 Model Baselines:
1. Random Forest (34 Domain Features)
2. Gradient Boosting Classifier (34 Domain Features)
3. Baseline 1D-CNN (Single Kernel k=5)
4. Baseline BiLSTM (Sequential Recurrent Model)
5. Proposed PhishNet-Hybrid (Multi-Scale Parallel CNN + BiLSTM + Multi-Head Self-Attention)

Metrics Computed: Accuracy, Precision, Recall (TPR), Specificity (TNR), False Positive Rate (FPR),
                 F1-Score, ROC-AUC, and Mean Inference Latency (ms/sample).
"""

import os
import time
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
import tensorflow as tf
from tensorflow.keras.models import Sequential, Model
from tensorflow.keras.layers import (
    Input, Embedding, Conv1D, GlobalMaxPooling1D,
    Bidirectional, LSTM, MultiHeadAttention, GlobalAveragePooling1D,
    Dense, Dropout, BatchNormalization, concatenate
)
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
from features import URLFeatureExtractor

MAX_LEN = 200
VOCAB_SIZE = 120
EMBEDDING_DIM = 64

def load_data(sample_size=40000):
    paths = ["data/malicious_phish.csv", "backend/data/malicious_phish.csv"]
    df = None
    for p in paths:
        if os.path.exists(p):
            print(f"Loading data from {p}...")
            df = pd.read_csv(p)
            break
            
    if df is None:
        raise FileNotFoundError("Dataset malicious_phish.csv not found!")

    df = df.dropna(subset=['url', 'type'])
    benign = df[df['type'].str.lower() == 'benign']
    malicious = df[df['type'].str.lower() != 'benign']
    
    half = sample_size // 2
    b_sample = benign.sample(min(len(benign), half), random_state=42)
    m_sample = malicious.sample(min(len(malicious), half), random_state=42)
    
    df_balanced = pd.concat([b_sample, m_sample]).sample(frac=1.0, random_state=42).reset_index(drop=True)
    urls = df_balanced['url'].astype(str).tolist()
    labels = np.array([0 if str(t).lower() == 'benign' else 1 for t in df_balanced['type']], dtype=np.int32)
    
    return urls, labels


def evaluate_predictions(y_true, y_pred, y_probs, latency_ms):
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()
    
    acc = accuracy_score(y_true, y_pred) * 100
    prec = precision_score(y_true, y_pred) * 100
    rec = recall_score(y_true, y_pred) * 100
    f1 = f1_score(y_true, y_pred) * 100
    spec = (tn / (tn + fp)) * 100
    fpr = (fp / (fp + tn)) * 100
    auc = roc_auc_score(y_true, y_probs)
    
    return {
        "Accuracy (%)": round(acc, 2),
        "Precision (%)": round(prec, 2),
        "Recall / TPR (%)": round(rec, 2),
        "F1-Score (%)": round(f1, 2),
        "Specificity (%)": round(spec, 2),
        "FPR (%)": round(fpr, 2),
        "ROC-AUC": round(auc, 4),
        "Latency (ms/sample)": round(latency_ms, 3)
    }


def build_baseline_cnn():
    """Baseline Single-Kernel 1D-CNN."""
    model = Sequential([
        Embedding(VOCAB_SIZE, EMBEDDING_DIM, input_length=MAX_LEN),
        Conv1D(filters=128, kernel_size=5, activation="relu"),
        GlobalMaxPooling1D(),
        Dense(64, activation="relu"),
        Dropout(0.5),
        Dense(1, activation="sigmoid")
    ], name="Baseline_CNN")
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    return model


def build_baseline_bilstm():
    """Baseline Single-Branch BiLSTM."""
    model = Sequential([
        Embedding(VOCAB_SIZE, EMBEDDING_DIM, input_length=MAX_LEN),
        Bidirectional(LSTM(64, dropout=0.2)),
        Dense(64, activation="relu"),
        Dropout(0.5),
        Dense(1, activation="sigmoid")
    ], name="Baseline_BiLSTM")
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    return model


def build_multiscale_cnn_only():
    """Ablation: Multi-Scale CNN without BiLSTM/Attention."""
    inputs = Input(shape=(MAX_LEN,))
    x = Embedding(VOCAB_SIZE, EMBEDDING_DIM, input_length=MAX_LEN)(inputs)
    
    k3 = GlobalMaxPooling1D()(Conv1D(64, 3, padding="same", activation="relu")(x))
    k5 = GlobalMaxPooling1D()(Conv1D(64, 5, padding="same", activation="relu")(x))
    k9 = GlobalMaxPooling1D()(Conv1D(64, 9, padding="same", activation="relu")(x))
    
    concat = concatenate([k3, k5, k9])
    dense = Dense(64, activation="relu")(concat)
    dense = Dropout(0.4)(dense)
    out = Dense(1, activation="sigmoid")(dense)
    
    model = Model(inputs=inputs, outputs=out, name="MultiScale_CNN_Only")
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    return model


def build_bilstm_attention_only():
    """Ablation: BiLSTM with Self-Attention without CNN."""
    inputs = Input(shape=(MAX_LEN,))
    x = Embedding(VOCAB_SIZE, EMBEDDING_DIM, input_length=MAX_LEN)(inputs)
    bilstm = Bidirectional(LSTM(64, return_sequences=True, dropout=0.2))(x)
    attn = MultiHeadAttention(num_heads=4, key_dim=32)(query=bilstm, value=bilstm, key=bilstm)
    pool = GlobalAveragePooling1D()(attn)
    dense = Dense(64, activation="relu")(pool)
    dense = Dropout(0.4)(dense)
    out = Dense(1, activation="sigmoid")(dense)
    
    model = Model(inputs=inputs, outputs=out, name="BiLSTM_Attention_Only")
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    return model


def build_phishnet_hybrid():
    """Full Proposed SOTA Architecture."""
    inputs = Input(shape=(MAX_LEN,))
    x = Embedding(VOCAB_SIZE, EMBEDDING_DIM, input_length=MAX_LEN)(inputs)
    x = Dropout(0.2)(x)
    
    # Branch 1
    k3 = GlobalMaxPooling1D()(Conv1D(64, 3, padding="same", activation="relu")(x))
    k5 = GlobalMaxPooling1D()(Conv1D(64, 5, padding="same", activation="relu")(x))
    k9 = GlobalMaxPooling1D()(Conv1D(64, 9, padding="same", activation="relu")(x))
    cnn_feat = BatchNormalization()(concatenate([k3, k5, k9]))
    
    # Branch 2
    bilstm = Bidirectional(LSTM(64, return_sequences=True, dropout=0.2))(x)
    attn = MultiHeadAttention(num_heads=4, key_dim=32)(query=bilstm, value=bilstm, key=bilstm)
    bilstm_feat = BatchNormalization()(GlobalAveragePooling1D()(attn))
    
    # Fusion
    fusion = concatenate([cnn_feat, bilstm_feat])
    dense1 = Dropout(0.4)(BatchNormalization()(Dense(128, activation="relu")(fusion)))
    dense2 = Dropout(0.2)(Dense(32, activation="relu")(dense1))
    out = Dense(1, activation="sigmoid")(dense2)
    
    model = Model(inputs=inputs, outputs=out, name="PhishNet_Hybrid")
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    return model


def run_benchmarks(sample_size=30000):
    print(f"\n=======================================================")
    print(f"   PHISHSHIELD-X RESEARCH BENCHMARKING SUITE")
    print(f"=======================================================\n")
    
    urls, labels = load_data(sample_size=sample_size)
    X_train_raw, X_test_raw, y_train, y_test = train_test_split(urls, labels, test_size=0.20, random_state=42, stratify=labels)
    
    print(f"Dataset summary -> Train samples: {len(X_train_raw)}, Holdout Test samples: {len(X_test_raw)}")
    
    # 1. Feature Extraction for Classical ML
    print("\n[1/6] Extracting 34 Domain Cybersecurity Features...")
    extractor = URLFeatureExtractor()
    t0 = time.time()
    X_train_feat = np.array(extractor.transform(X_train_raw))
    X_test_feat = np.array(extractor.transform(X_test_raw))
    feat_time = (time.time() - t0) / (len(X_train_raw) + len(X_test_raw)) * 1000
    print(f"Feature extraction complete ({feat_time:.3f} ms/sample).")
    
    # 2. Tokenization for Deep Learning
    print("\n[2/6] Tokenizing Character Sequences for Deep Learning...")
    tokenizer = Tokenizer(char_level=True, lower=True, num_words=VOCAB_SIZE, oov_token="<UNK>")
    tokenizer.fit_on_texts(X_train_raw)
    X_train_seq = pad_sequences(tokenizer.texts_to_sequences(X_train_raw), maxlen=MAX_LEN)
    X_test_seq = pad_sequences(tokenizer.texts_to_sequences(X_test_raw), maxlen=MAX_LEN)
    
    results = {}
    
    # --- Model 1: Random Forest ---
    print("\n[3/6] Training Model 1: Random Forest (34 Features)...")
    rf = RandomForestClassifier(n_estimators=100, max_depth=20, random_state=42, n_jobs=-1)
    rf.fit(X_train_feat, y_train)
    
    t0 = time.time()
    rf_probs = rf.predict_proba(X_test_feat)[:, 1]
    rf_latency = ((time.time() - t0) / len(X_test_feat)) * 1000 + feat_time
    rf_preds = (rf_probs >= 0.5).astype(int)
    results["Random Forest (34 Features)"] = evaluate_predictions(y_test, rf_preds, rf_probs, rf_latency)
    
    # --- Model 2: Gradient Boosting ---
    print("\n[4/6] Training Model 2: Gradient Boosting (34 Features)...")
    gb = GradientBoostingClassifier(n_estimators=100, max_depth=6, random_state=42)
    gb.fit(X_train_feat, y_train)
    
    t0 = time.time()
    gb_probs = gb.predict_proba(X_test_feat)[:, 1]
    gb_latency = ((time.time() - t0) / len(X_test_feat)) * 1000 + feat_time
    gb_preds = (gb_probs >= 0.5).astype(int)
    results["Gradient Boosting (34 Features)"] = evaluate_predictions(y_test, gb_preds, gb_probs, gb_latency)
    
    # --- Model 3: Baseline 1D-CNN ---
    print("\n[5/6] Training Model 3: Baseline 1D-CNN (Single Kernel k=5)...")
    cnn_model = build_baseline_cnn()
    cnn_model.fit(X_train_seq, y_train, epochs=4, batch_size=128, validation_split=0.1, verbose=0)
    
    t0 = time.time()
    cnn_probs = cnn_model.predict(X_test_seq, batch_size=256, verbose=0).flatten()
    cnn_latency = ((time.time() - t0) / len(X_test_seq)) * 1000
    cnn_preds = (cnn_probs >= 0.5).astype(int)
    results["Baseline 1D-CNN (Single Kernel)"] = evaluate_predictions(y_test, cnn_preds, cnn_probs, cnn_latency)
    
    # --- Model 4: Baseline BiLSTM ---
    print("\n[6/6] Training Model 4: Baseline BiLSTM...")
    bilstm_model = build_baseline_bilstm()
    bilstm_model.fit(X_train_seq, y_train, epochs=4, batch_size=128, validation_split=0.1, verbose=0)
    
    t0 = time.time()
    bilstm_probs = bilstm_model.predict(X_test_seq, batch_size=256, verbose=0).flatten()
    bilstm_latency = ((time.time() - t0) / len(X_test_seq)) * 1000
    bilstm_preds = (bilstm_probs >= 0.5).astype(int)
    results["Baseline BiLSTM"] = evaluate_predictions(y_test, bilstm_preds, bilstm_probs, bilstm_latency)
    
    # --- Model 5: Proposed PhishNet-Hybrid ---
    print("\n[7/7] Training Model 5: PROPOSED PhishNet-Hybrid (Multi-Scale CNN + BiLSTM + Attention)...")
    hybrid_model = build_phishnet_hybrid()
    hybrid_model.fit(X_train_seq, y_train, epochs=5, batch_size=128, validation_split=0.1, verbose=0)
    
    t0 = time.time()
    hybrid_probs = hybrid_model.predict(X_test_seq, batch_size=256, verbose=0).flatten()
    hybrid_latency = ((time.time() - t0) / len(X_test_seq)) * 1000
    hybrid_preds = (hybrid_probs >= 0.5).astype(int)
    results["PhishNet-Hybrid (Proposed SOTA)"] = evaluate_predictions(y_test, hybrid_preds, hybrid_probs, hybrid_latency)
    
    # --- Ablation Study ---
    print("\n=== Running Ablation Study ===")
    ablation_results = {}
    
    # Ablation A: MultiScale CNN only
    m_cnn = build_multiscale_cnn_only()
    m_cnn.fit(X_train_seq, y_train, epochs=4, batch_size=128, verbose=0)
    p_m_cnn = m_cnn.predict(X_test_seq, batch_size=256, verbose=0).flatten()
    ablation_results["Multi-Scale CNN (k=3,5,9) only"] = evaluate_predictions(y_test, (p_m_cnn >= 0.5).astype(int), p_m_cnn, 0)
    
    # Ablation B: BiLSTM + Attention only
    b_att = build_bilstm_attention_only()
    b_att.fit(X_train_seq, y_train, epochs=4, batch_size=128, verbose=0)
    p_b_att = b_att.predict(X_test_seq, batch_size=256, verbose=0).flatten()
    ablation_results["BiLSTM + Self-Attention only"] = evaluate_predictions(y_test, (p_b_att >= 0.5).astype(int), p_b_att, 0)
    
    # Full Proposed
    ablation_results["Full PhishNet-Hybrid (Proposed)"] = results["PhishNet-Hybrid (Proposed SOTA)"]
    
    # Format and Display Results
    df_results = pd.DataFrame(results).T
    df_ablation = pd.DataFrame(ablation_results).T
    
    print("\n" + "="*85)
    print("                      COMPARATIVE MODEL BENCHMARK RESULTS")
    print("="*85)
    print(df_results.to_markdown())
    
    print("\n" + "="*85)
    print("                           ABLATION STUDY RESULTS")
    print("="*85)
    print(df_ablation.to_markdown())
    
    # Output LaTeX Format
    print("\n" + "="*85)
    print("              IEEE / SPRINGER LATEX TABLE CODE (FOR RESEARCH PAPER)")
    print("="*85)
    latex_code = df_results.to_latex(index=True, escape=False)
    print(latex_code)
    
    # Save to JSON
    with open("benchmark_results.json", "w") as f:
        json.dump({
            "comparative_benchmarks": results,
            "ablation_study": ablation_results
        }, f, indent=4)
    print("\nSaved benchmark results to benchmark_results.json")
    
    return results, ablation_results


if __name__ == "__main__":
    run_benchmarks(sample_size=30000)
