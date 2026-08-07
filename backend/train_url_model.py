import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
import joblib
import os
from features import URLFeatureExtractor

# Define the expected path for the dataset
DATA_PATH = os.path.join("data", "malicious_phish.csv")
MODEL_PATH = "url_model.pkl"

def train():
    if not os.path.exists(DATA_PATH):
        print(f"Error: Dataset not found at {DATA_PATH}")
        return

    print("Loading dataset...")
    df = pd.read_csv(DATA_PATH)
    
    if 'url' not in df.columns or 'type' not in df.columns:
        print("Error: Dataset must contain 'url' and 'type' columns.")
        return

    df = df.dropna(subset=['url', 'type'])
    
    # Map benign to 0, others to 1
    df['label'] = df['type'].apply(lambda x: 0 if x.lower() == 'benign' else 1)
    
    X = df['url']
    y = df['label']

    print(f"Training on {len(X)} samples...")

    pipeline = Pipeline([
        ('features', URLFeatureExtractor()),
        ('clf', RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1))
    ])

    pipeline.fit(X, y)
    
    from sklearn.metrics import classification_report
    preds = pipeline.predict(X)
    print(classification_report(y, preds))

    acc = pipeline.score(X, y)
    print(f"Training Accuracy: {acc * 100:.2f}%")

    joblib.dump(pipeline, MODEL_PATH)
    print(f"Model saved successfully to {MODEL_PATH}!")

if __name__ == "__main__":
    train()
