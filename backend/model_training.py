import os
import pickle
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input, Embedding, Conv1D, GlobalMaxPooling1D,
    Bidirectional, GRU, MultiHeadAttention, GlobalAveragePooling1D,
    Dense, Dropout, BatchNormalization, concatenate
)
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix

# Optimized Hyperparameters for fast convergence and high generalization
MAX_LEN = 180          # Maximum character sequence length
VOCAB_SIZE = 110       # Character vocabulary size
EMBEDDING_DIM = 48     # Character embedding dimension
BATCH_SIZE = 256
EPOCHS = 6

def build_phishnet_hybrid(vocab_size=VOCAB_SIZE, embedding_dim=EMBEDDING_DIM, max_len=MAX_LEN):
    """
    Builds PhishNet-Hybrid: Multi-Scale 1D-CNN + Bidirectional GRU + Multi-Head Self-Attention.
    
    Branch 1: Parallel Conv1D kernels (3, 5, 9) capturing micro-typos, keywords, and domain stems.
    Branch 2: Bidirectional GRU capturing forward/backward sequence dependencies, refined by Self-Attention.
    """
    inputs = Input(shape=(max_len,), name="char_input")
    
    # Shared Character Embedding
    x = Embedding(input_dim=vocab_size, output_dim=embedding_dim, input_length=max_len, name="char_embedding")(inputs)
    x = Dropout(0.2, name="embedding_dropout")(x)
    
    # --- Branch 1: Multi-Scale Parallel 1D-CNN ---
    conv_k3 = Conv1D(filters=48, kernel_size=3, padding="same", activation="relu", name="conv_k3")(x)
    pool_k3 = GlobalMaxPooling1D(name="pool_k3")(conv_k3)
    
    conv_k5 = Conv1D(filters=48, kernel_size=5, padding="same", activation="relu", name="conv_k5")(x)
    pool_k5 = GlobalMaxPooling1D(name="pool_k5")(conv_k5)
    
    conv_k9 = Conv1D(filters=48, kernel_size=9, padding="same", activation="relu", name="conv_k9")(x)
    pool_k9 = GlobalMaxPooling1D(name="pool_k9")(conv_k9)
    
    cnn_features = concatenate([pool_k3, pool_k5, pool_k9], name="concat_cnn")
    cnn_features = BatchNormalization(name="bn_cnn")(cnn_features)
    
    # --- Branch 2: BiGRU with Multi-Head Self-Attention ---
    bigru = Bidirectional(GRU(32, return_sequences=True, dropout=0.2), name="bigru")(x)
    
    # Self-Attention Layer
    attention_out = MultiHeadAttention(num_heads=2, key_dim=24, name="self_attention")(
        query=bigru, value=bigru, key=bigru
    )
    bigru_features = GlobalAveragePooling1D(name="pool_attention")(attention_out)
    bigru_features = BatchNormalization(name="bn_bigru")(bigru_features)
    
    # --- Multi-Modal Fusion Head ---
    fusion = concatenate([cnn_features, bigru_features], name="fusion_concat")
    
    dense1 = Dense(96, activation="relu", name="dense_fusion")(fusion)
    dense1 = BatchNormalization(name="bn_dense1")(dense1)
    dense1 = Dropout(0.3, name="dropout_dense1")(dense1)
    
    dense2 = Dense(32, activation="relu", name="dense_refine")(dense1)
    dense2 = Dropout(0.2, name="dropout_dense2")(dense2)
    
    outputs = Dense(1, activation="sigmoid", name="threat_score")(dense2)
    
    model = Model(inputs=inputs, outputs=outputs, name="PhishNet_Hybrid")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.0015),
        loss="binary_crossentropy",
        metrics=["accuracy", tf.keras.metrics.Precision(name="precision"), tf.keras.metrics.Recall(name="recall")]
    )
    return model


def load_dataset(sample_size=40000):
    """Loads balanced benign and malicious URLs from dataset."""
    file_paths = ['data/malicious_phish.csv', 'backend/data/malicious_phish.csv']
    df = None
    for p in file_paths:
        if os.path.exists(p):
            print(f"Loading dataset from {p}...")
            df = pd.read_csv(p)
            break
            
    if df is None:
        raise FileNotFoundError("Dataset malicious_phish.csv not found!")

    df = df.dropna(subset=['url', 'type'])
    benign = df[df['type'].str.lower() == 'benign']
    malicious = df[df['type'].str.lower() != 'benign']
    
    half_sample = sample_size // 2
    if len(benign) > half_sample:
        benign = benign.sample(half_sample, random_state=42)
    if len(malicious) > half_sample:
        malicious = malicious.sample(min(len(malicious), half_sample), random_state=42)
        
    df_balanced = pd.concat([benign, malicious]).sample(frac=1.0, random_state=42).reset_index(drop=True)
    urls = df_balanced['url'].astype(str).tolist()
    labels = np.array([0 if str(t).lower() == 'benign' else 1 for t in df_balanced['type']], dtype=np.int32)
    
    print(f"Loaded {len(urls)} samples (Safe: {np.sum(labels == 0)}, Malicious: {np.sum(labels == 1)}).")
    return urls, labels


def train_and_evaluate():
    print("=== Training SOTA PhishNet-Hybrid Model ===")
    urls, labels = load_dataset(sample_size=40000)
    
    # 80% Train, 10% Validation, 10% Test
    X_train_raw, X_temp, y_train, y_temp = train_test_split(urls, labels, test_size=0.20, random_state=42, stratify=labels)
    X_val_raw, X_test_raw, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.50, random_state=42, stratify=y_temp)
    
    print(f"Dataset Split -> Train: {len(X_train_raw)}, Val: {len(X_val_raw)}, Test: {len(X_test_raw)}")
    
    # Character Tokenizer
    tokenizer = Tokenizer(char_level=True, lower=True, num_words=VOCAB_SIZE, oov_token="<UNK>")
    tokenizer.fit_on_texts(X_train_raw)
    
    with open('tokenizer.pkl', 'wb') as handle:
        pickle.dump(tokenizer, handle, protocol=pickle.HIGHEST_PROTOCOL)
    print("Saved tokenizer to tokenizer.pkl")
    
    # Convert and pad sequences
    X_train = pad_sequences(tokenizer.texts_to_sequences(X_train_raw), maxlen=MAX_LEN)
    X_val = pad_sequences(tokenizer.texts_to_sequences(X_val_raw), maxlen=MAX_LEN)
    X_test = pad_sequences(tokenizer.texts_to_sequences(X_test_raw), maxlen=MAX_LEN)
    
    # Build Model
    model = build_phishnet_hybrid()
    model.summary()
    
    callbacks = [
        EarlyStopping(monitor="val_loss", patience=3, restore_best_weights=True, verbose=1),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, min_lr=1e-5, verbose=1),
        ModelCheckpoint("deep_phish_model.h5", monitor="val_loss", save_best_only=True, verbose=1)
    ]
    
    print("\n--- Starting Training ---")
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        callbacks=callbacks,
        verbose=1
    )
    
    # Test Evaluation
    print("\n=== Empirical Test Set Evaluation (Unseen Data) ===")
    test_probs = model.predict(X_test, batch_size=256, verbose=0).flatten()
    test_preds = (test_probs >= 0.5).astype(int)
    
    print(classification_report(y_test, test_preds, target_names=["Safe (0)", "Phishing (1)"], digits=4))
    roc_auc = roc_auc_score(y_test, test_probs)
    print(f"ROC-AUC Score: {roc_auc:.4f}")
    
    cm = confusion_matrix(y_test, test_preds)
    tn, fp, fn, tp = cm.ravel()
    fpr = fp / (fp + tn)
    print(f"Confusion Matrix -> TN: {tn}, FP: {fp}, FN: {fn}, TP: {tp}")
    print(f"False Positive Rate (FPR): {fpr * 100:.2f}%")
    
    return model, tokenizer

if __name__ == "__main__":
    train_and_evaluate()
