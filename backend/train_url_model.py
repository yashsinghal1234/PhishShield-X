import os
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
import joblib
from features import URLFeatureExtractor

DATA_PATH = os.path.join("data", "malicious_phish.csv")
MODEL_PATH = "url_model.pkl"

def train():
    if not os.path.exists(DATA_PATH):
        # Fallback to backend/data/
        alt_path = os.path.join("backend", "data", "malicious_phish.csv")
        if os.path.exists(alt_path):
            data_file = alt_path
        else:
            print(f"Error: Dataset not found at {DATA_PATH}")
            return
    else:
        data_file = DATA_PATH

    print(f"Loading dataset from {data_file}...")
    df = pd.read_csv(data_file)
    df = df.dropna(subset=['url', 'type'])
    
    # Map benign to 0, others to 1
    df['label'] = df['type'].apply(lambda x: 0 if str(x).lower() == 'benign' else 1)
    
    # Balance dataset
    benign = df[df['label'] == 0]
    malicious = df[df['label'] == 1]
    sample_size = min(len(benign), len(malicious), 50000)
    
    df_balanced = pd.concat([
        benign.sample(sample_size, random_state=42),
        malicious.sample(sample_size, random_state=42)
    ]).sample(frac=1.0, random_state=42).reset_index(drop=True)
    
    X = df_balanced['url']
    y = df_balanced['label']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    print(f"Training on {len(X_train)} samples, testing on {len(X_test)} samples...")

    pipeline = Pipeline([
        ('features', URLFeatureExtractor()),
        ('clf', RandomForestClassifier(n_estimators=100, max_depth=25, random_state=42, n_jobs=-1))
    ])

    pipeline.fit(X_train, y_train)
    
    print("\n--- Model Evaluation on Unseen Test Split ---")
    y_pred = pipeline.predict(X_test)
    y_prob = pipeline.predict_proba(X_test)[:, 1]
    
    print(classification_report(y_test, y_pred, target_names=["Safe", "Phishing"], digits=4))
    auc = roc_auc_score(y_test, y_prob)
    print(f"Test ROC-AUC Score: {auc:.4f}")

    joblib.dump(pipeline, MODEL_PATH)
    print(f"Model successfully saved to {MODEL_PATH}!")

if __name__ == "__main__":
    train()
