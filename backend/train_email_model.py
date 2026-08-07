import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
import joblib
import os

# Define the expected path for the dataset
DATA_PATH = os.path.join("data", "emails.csv")
MODEL_PATH = "email_model.pkl"

def train():
    if not os.path.exists(DATA_PATH):
        print(f"Error: Dataset not found at {DATA_PATH}")
        print("Please provide a CSV file with columns 'text' and 'label' (0 for Safe, 1 for Phishing).")
        return

    print("Loading dataset...")
    df = pd.read_csv(DATA_PATH)
    
    if 'text' not in df.columns or 'label' not in df.columns:
        print("Error: Dataset must contain 'text' and 'label' columns.")
        return

    # Drop any nulls
    df = df.dropna(subset=['text', 'label'])

    X = df['text']
    y = df['label']

    print(f"Training on {len(X)} samples...")

    # Create a TF-IDF + Logistic Regression pipeline
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(max_features=5000, stop_words='english')),
        ('clf', LogisticRegression(random_state=42, max_iter=1000))
    ])

    pipeline.fit(X, y)
    
    # Evaluate briefly on training set
    acc = pipeline.score(X, y)
    print(f"Training Accuracy: {acc * 100:.2f}%")

    # Save the model
    joblib.dump(pipeline, MODEL_PATH)
    print(f"Model saved successfully to {MODEL_PATH}!")

if __name__ == "__main__":
    train()
