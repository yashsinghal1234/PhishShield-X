"""
Unconfounded 2x2 Factorial Modality-Conflict Experiment:
Evaluates {Benign URL, Phishing URL} x {Clean QR, Logo QR}
to isolate the exact causal effect of visual logo injection on both safe and malicious payloads.
"""

import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_DETERMINISTIC_OPS"] = "1"

import numpy as np
import pandas as pd
import tensorflow as tf
tf.random.set_seed(42)
np.random.seed(42)

import qrcode
from qrcode.constants import ERROR_CORRECT_M, ERROR_CORRECT_H
from PIL import Image, ImageDraw
import pickle
from tensorflow.keras.preprocessing.sequence import pad_sequences
from tensorflow.keras.models import load_model

IMAGE_SIZE = (64, 64)
MAX_LEN = 180

def create_qr(payload: str, tamper_logo: bool) -> np.ndarray:
    qr = qrcode.QRCode(
        box_size=3,
        border=2,
        error_correction=ERROR_CORRECT_H if tamper_logo else ERROR_CORRECT_M
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    
    if tamper_logo:
        draw = ImageDraw.Draw(img)
        w, h = img.size
        cw, ch = int(w * 0.28), int(h * 0.28)
        top_left = ((w - cw) // 2, (h - ch) // 2)
        bottom_right = ((w + cw) // 2, (h + ch) // 2)
        draw.rectangle([top_left, bottom_right], fill=(30, 80, 200), outline=(255, 255, 255), width=2)
        
    img = img.resize(IMAGE_SIZE, Image.Resampling.BILINEAR)
    img_gray = np.array(img.convert("L"), dtype=np.float32) / 255.0
    return np.expand_dims(img_gray, axis=-1)

def run_factorial_experiment(n_samples=50):
    print("=" * 75)
    print("RUNNING 2x2 FACTORIAL MODALITY-CONFLICT EXPERIMENT")
    print("Conditions: {Benign URL, Phishing URL} x {Clean QR, Logo-Tampered QR}")
    print("=" * 75)
    
    # 1. Load Benign and Phish URLs
    df = pd.read_csv("backend/data/malicious_phish.csv")
    b_urls = df[df['type'] == 'benign']['url'].dropna().sample(n_samples, random_state=42).tolist()
    p_urls = df[df['type'] == 'phishing']['url'].dropna().sample(n_samples, random_state=42).tolist()
    
    # Canonically normalize strings
    import re
    def norm(u):
        u = re.sub(r'^[a-zA-Z]+://', '', str(u).strip())
        return re.sub(r'^www\.', '', u, flags=re.IGNORECASE).rstrip('/')
    b_urls = [norm(u) for u in b_urls]
    p_urls = [norm(u) for u in p_urls]
    
    # Tokenizer
    with open("backend/tokenizer.pkl", "rb") as f:
        tok = pickle.load(f)
        
    seqs_b = pad_sequences(tok.texts_to_sequences(b_urls), maxlen=MAX_LEN)
    seqs_p = pad_sequences(tok.texts_to_sequences(p_urls), maxlen=MAX_LEN)
    
    # Render QR codes for all 4 cells
    print(f"Rendering authentic QR codes for {n_samples} Benign and {n_samples} Phish URLs...")
    imgs_b_clean = np.array([create_qr(u, tamper_logo=False) for u in b_urls], dtype=np.float32)
    imgs_b_logo  = np.array([create_qr(u, tamper_logo=True)  for u in b_urls], dtype=np.float32)
    imgs_p_clean = np.array([create_qr(u, tamper_logo=False) for u in p_urls], dtype=np.float32)
    imgs_p_logo  = np.array([create_qr(u, tamper_logo=True)  for u in p_urls], dtype=np.float32)
    
    # Load trained models from clean benchmark
    import sys
    sys.path.insert(0, os.path.abspath('.'))
    sys.path.insert(0, os.path.abspath('backend'))
    from run_clean_benchmark import (
        build_vision_only_model, build_lexical_only_model,
        build_softmax_baseline, build_quish_edl_model
    )
    
    # Load clean ID training data to quickly fit models with fixed seed
    id_data = np.load("backend/data/clean_quishing_id.npz")
    X_v_tr = id_data['images']
    X_l_tr = id_data['sequences']
    y_tr   = id_data['labels']
    
    print("Training models on clean artifact-controlled dataset...")
    m1 = build_vision_only_model()
    m1.fit(X_v_tr, y_tr, epochs=6, batch_size=32, verbose=0)
    
    m2 = build_lexical_only_model()
    m2.fit(X_l_tr, y_tr, epochs=6, batch_size=32, verbose=0)
    
    m3 = build_softmax_baseline()
    m3.fit([X_v_tr, X_l_tr], y_tr, epochs=6, batch_size=32, verbose=0)
    
    m6 = build_quish_edl_model(oe_weight=0.10)
    m6.fit([X_v_tr, X_l_tr], y_tr, epochs=6, batch_size=32, verbose=0)
    
    # Function to evaluate a cell
    def eval_cell(name, imgs, seqs):
        p1 = m1.predict(imgs, verbose=0).flatten()
        p2 = m2.predict(seqs, verbose=0).flatten()
        p3 = m3.predict([imgs, seqs], verbose=0)[:, 1]
        
        alpha6 = m6.predict([imgs, seqs], verbose=0)
        S6 = np.sum(alpha6, axis=-1, keepdims=True)
        p6 = (alpha6 / S6)[:, 1]
        u6 = (2.0 / np.sum(alpha6, axis=-1)).flatten()
        
        return {
            "cell": name,
            "m1_p_phish": float(np.mean(p1)),
            "m2_p_phish": float(np.mean(p2)),
            "m3_p_phish": float(np.mean(p3)),
            "m6_p_phish": float(np.mean(p6)),
            "m6_uncertainty_u": float(np.mean(u6))
        }

    c_b_clean = eval_cell("Cell 1: [Benign URL + Clean QR]", imgs_b_clean, seqs_b)
    c_b_logo  = eval_cell("Cell 2: [Benign URL + Logo QR] ", imgs_b_logo,  seqs_b)
    c_p_clean = eval_cell("Cell 3: [Phish URL  + Clean QR]", imgs_p_clean, seqs_p)
    c_p_logo  = eval_cell("Cell 4: [Phish URL  + Logo QR] ", imgs_p_logo,  seqs_p)
    
    print("\n--- 2x2 FACTORIAL EXPERIMENT RESULTS (N = 50 per cell) ---")
    header = f"{'Experimental Cell':34s} | {'M1 (Vis)':8s} | {'M2 (Lex)':8s} | {'M3 (Early)':10s} | {'M6 P(Phish)':11s} | {'M6 Unc (u)':10s}"
    print(header)
    print("-" * len(header))
    for c in [c_b_clean, c_b_logo, c_p_clean, c_p_logo]:
        print(f"{c['cell']:34s} | {c['m1_p_phish']*100:6.2f}%  | {c['m2_p_phish']*100:6.2f}%  | {c['m3_p_phish']*100:8.2f}%  | {c['m6_p_phish']*100:9.2f}%  | {c['m6_uncertainty_u']:8.4f}")
        
    print("\n--- FACTORIAL CAUSAL SHIFTS (Delta when adding Logo) ---")
    print(f"Benign URL Logo Shift  (Cell 2 - Cell 1):")
    print(f"  M1 Vision Delta:   {(c_b_logo['m1_p_phish'] - c_b_clean['m1_p_phish'])*100:+.2f} pp")
    print(f"  M3 Early Delta:    {(c_b_logo['m3_p_phish'] - c_b_clean['m3_p_phish'])*100:+.2f} pp")
    print(f"  M6 Quish Delta:    {(c_b_logo['m6_p_phish'] - c_b_clean['m6_p_phish'])*100:+.2f} pp (Uncertainty Delta: {c_b_logo['m6_uncertainty_u'] - c_b_clean['m6_uncertainty_u']:+.4f})")
    
    print(f"\nPhishing URL Logo Shift (Cell 4 - Cell 3):")
    print(f"  M1 Vision Delta:   {(c_p_logo['m1_p_phish'] - c_p_clean['m1_p_phish'])*100:+.2f} pp")
    print(f"  M3 Early Delta:    {(c_p_logo['m3_p_phish'] - c_p_clean['m3_p_phish'])*100:+.2f} pp")
    print(f"  M6 Quish Delta:    {(c_p_logo['m6_p_phish'] - c_p_clean['m6_p_phish'])*100:+.2f} pp (Uncertainty Delta: {c_p_logo['m6_uncertainty_u'] - c_p_clean['m6_uncertainty_u']:+.4f})")
    print("=" * 75)

if __name__ == "__main__":
    run_factorial_experiment()
