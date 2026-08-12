import os
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Embedding, Conv1D, GlobalMaxPooling1D, Dense, Dropout
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
import pickle

# Hyperparameters
MAX_LEN = 200 # Maximum URL length to consider
VOCAB_SIZE = 100 # Approx number of unique characters in URLs
EMBEDDING_DIM = 32
FILTERS = 128
KERNEL_SIZE = 5

def create_model():
    """Builds a character-level CNN for URL classification."""
    model = Sequential([
        Embedding(input_dim=VOCAB_SIZE, output_dim=EMBEDDING_DIM, input_length=MAX_LEN),
        Conv1D(filters=FILTERS, kernel_size=KERNEL_SIZE, activation='relu'),
        GlobalMaxPooling1D(),
        Dense(64, activation='relu'),
        Dropout(0.5),
        Dense(1, activation='sigmoid') # Binary classification: Phishing (1) or Safe (0)
    ])
    
    model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
    return model

def load_real_data(sample_size=100000):
    """Loads and preprocesses data from the malicious_phish.csv dataset."""
    print("Loading data from backend/data/malicious_phish.csv...")
    try:
        df = pd.read_csv('data/malicious_phish.csv')
    except FileNotFoundError:
        try:
            df = pd.read_csv('backend/data/malicious_phish.csv')
        except FileNotFoundError:
            print("Dataset not found! Falling back to dummy data.")
            return generate_dummy_data()

    # Drop any nulls
    df = df.dropna(subset=['url', 'type'])

    # We might have too much data for a quick local training, so we can sample it
    if len(df) > sample_size:
        # Try to keep a balanced dataset if possible
        benign = df[df['type'] == 'benign']
        malicious = df[df['type'] != 'benign']
        
        half_sample = sample_size // 2
        
        if len(benign) > half_sample:
            benign = benign.sample(half_sample, random_state=42)
        if len(malicious) > half_sample:
            malicious = malicious.sample(half_sample, random_state=42)
            
        df = pd.concat([benign, malicious])
        
    urls = df['url'].tolist()
    # Map 'benign' to 0, anything else to 1
    labels = np.array([0 if t == 'benign' else 1 for t in df['type']])
    print(f"Loaded {len(urls)} URLs for training.")
    return urls, labels

def generate_dummy_data():
    """Generates dummy data to initialize and save the model if real dataset is missing."""
    urls = [
        "http://example.com", "https://google.com", "http://secure-login.paypa1.com-update.info",
        "https://github.com", "http://free-iphone-winner.xyz/claim", "https://amazon.com",
        "http://netflix-update-billing.com", "https://wikipedia.org", "http://bankofamerica-alert.net"
    ]
    # 0 = Safe, 1 = Phishing
    labels = np.array([0, 0, 1, 0, 1, 0, 1, 0, 1])
    
    return urls, labels

def train_and_save():
    print("Initializing Model Training...")
    urls, labels = load_real_data(sample_size=50000) # Using 50k for a fast and robust initial training
    
    # Character-level tokenization
    tokenizer = Tokenizer(char_level=True, lower=True, num_words=VOCAB_SIZE)
    tokenizer.fit_on_texts(urls)
    
    # Save tokenizer for inference later
    with open('tokenizer.pkl', 'wb') as handle:
        pickle.dump(tokenizer, handle, protocol=pickle.HIGHEST_PROTOCOL)
        
    # Convert URLs to sequences of integers and pad them
    sequences = tokenizer.texts_to_sequences(urls)
    X = pad_sequences(sequences, maxlen=MAX_LEN)
    y = labels
    
    # Create and train model
    model = create_model()
    model.summary()
    
    print("Training on dataset...")
    # Increase epochs slightly for real data, and add validation split
    model.fit(X, y, epochs=5, batch_size=128, validation_split=0.1, verbose=1)
    
    # Save model
    model.save('deep_phish_model.h5')
    print("Model saved to deep_phish_model.h5 and tokenizer.pkl")

if __name__ == "__main__":
    train_and_save()
