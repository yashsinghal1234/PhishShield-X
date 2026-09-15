"""
Programmatic Quishing (QR Phishing) Benchmark Synthesis & Augmentation Generator.
Generates reproducible In-Distribution (ID) and Out-of-Distribution (OOD / Zero-Day) datasets
with ground-truth visual matrices (64x64) and lexical token sequences (L=180).
"""

import os
import qrcode
from qrcode.constants import ERROR_CORRECT_L, ERROR_CORRECT_M, ERROR_CORRECT_Q, ERROR_CORRECT_H
import numpy as np
import pandas as pd
from PIL import Image, ImageDraw, ImageFilter
import cv2
import pickle

IMAGE_SIZE = (64, 64)
MAX_LEN = 180
VOCAB_SIZE = 110


def create_qr_image(payload: str, ecl=ERROR_CORRECT_M, tamper_logo=False, invert_color=False, add_glare=False) -> np.ndarray:
    """Renders an authentic QR code image with optional visual tampering and degradation."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=ecl,
        box_size=3,
        border=2,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    
    # 1. Central Logo Tampering (High ECL Abuse)
    if tamper_logo:
        draw = ImageDraw.Draw(img)
        w, h = img.size
        cw, ch = int(w * 0.28), int(h * 0.28)
        top_left = ((w - cw) // 2, (h - ch) // 2)
        bottom_right = ((w + cw) // 2, (h + ch) // 2)
        # Draw a synthetic brand badge in center
        draw.rectangle([top_left, bottom_right], fill=(30, 80, 200), outline=(255, 255, 255), width=2)

    # 2. Color Inversion (Dark Mode)
    if invert_color:
        img_np = np.array(img)
        img_np = 255 - img_np
        img = Image.fromarray(img_np)

    # 3. Glare / Blur Degradation
    if add_glare:
        img = img.filter(ImageFilter.GaussianBlur(radius=0.6))

    # Resize to standard input resolution
    img = img.resize(IMAGE_SIZE, Image.Resampling.BILINEAR)
    img_gray = np.array(img.convert("L"), dtype=np.float32) / 255.0
    return np.expand_dims(img_gray, axis=-1)


def generate_benchmark(sample_size=3000):
    print("=== Generating Deterministic Quishing Benchmark Dataset ===")
    
    # Load Real URLs from dataset
    paths = ["data/malicious_phish.csv", "backend/data/malicious_phish.csv"]
    df = None
    for p in paths:
        if os.path.exists(p):
            df = pd.read_csv(p)
            break
            
    if df is None:
        raise FileNotFoundError("Dataset malicious_phish.csv not found!")

    df = df.dropna(subset=['url', 'type'])
    benign_df = df[df['type'].str.lower() == 'benign']
    phish_df = df[df['type'].str.lower() != 'benign']
    
    half = sample_size // 2
    benign_urls = benign_df['url'].sample(min(len(benign_df), half), random_state=42).tolist()
    phish_urls = phish_df['url'].sample(min(len(phish_df), half), random_state=42).tolist()
    
    # Load Character Tokenizer
    tokenizer_path = "tokenizer.pkl" if os.path.exists("tokenizer.pkl") else "backend/tokenizer.pkl"
    with open(tokenizer_path, "rb") as f:
        tokenizer = pickle.load(f)
        
    X_images_id = []
    X_urls_raw_id = []
    y_id = []

    print(f"Synthesizing {sample_size} In-Distribution (ID) QR Code Visuals & Payloads...")
    
    # 1. Synthesize Benign Samples (Clean QR, ECL L/M, no logo tampering)
    for i, url in enumerate(benign_urls):
        ecl_choice = np.random.choice([ERROR_CORRECT_L, ERROR_CORRECT_M])
        img = create_qr_image(url, ecl=ecl_choice, tamper_logo=False, invert_color=(i % 15 == 0))
        X_images_id.append(img)
        X_urls_raw_id.append(url)
        y_id.append(0)

    # 2. Synthesize Malicious Quishing Samples (ECL Q/H, 45% Logo Tampered, 20% Inverted/Glared)
    for i, url in enumerate(phish_urls):
        ecl_choice = np.random.choice([ERROR_CORRECT_Q, ERROR_CORRECT_H])
        tamper = (i % 2 == 0) # 50% logo tampering
        invert = (i % 8 == 0)
        glare = (i % 10 == 0)
        img = create_qr_image(url, ecl=ecl_choice, tamper_logo=tamper, invert_color=invert, add_glare=glare)
        X_images_id.append(img)
        X_urls_raw_id.append(url)
        y_id.append(1)

    X_images_id = np.array(X_images_id, dtype=np.float32)
    y_id = np.array(y_id, dtype=np.int32)
    
    # Pad sequences
    from tensorflow.keras.preprocessing.sequence import pad_sequences
    X_seq_id = pad_sequences(tokenizer.texts_to_sequences(X_urls_raw_id), maxlen=MAX_LEN)
    
    # Shuffle ID dataset
    perm = np.random.RandomState(42).permutation(len(y_id))
    X_images_id = X_images_id[perm]
    X_seq_id = X_seq_id[perm]
    y_id = y_id[perm]
    
    # Save ID Dataset
    os.makedirs("data", exist_ok=True)
    os.makedirs("backend/data", exist_ok=True)
    out_id_path = "data/quishing_id_dataset.npz" if os.path.exists("data") else "backend/data/quishing_id_dataset.npz"
    np.savez_compressed(out_id_path, images=X_images_id, sequences=X_seq_id, labels=y_id)
    print(f"Saved In-Distribution (ID) Benchmark to {out_id_path} (Shape: {X_images_id.shape}, {X_seq_id.shape})")

    # 3. Synthesize Out-of-Distribution (OOD / Zero-Day Attack Set) (N = 400)
    print("Synthesizing 400 Out-of-Distribution (OOD / Zero-Day) Samples...")
    ood_schemes = [
        "WIFI:S:Executive_Guest_Wifi;T:WPA;P:CorpHarvest!99;;",
        "UPI://pay?pa=finance-tax-refund@fakebank&pn=GovTax&am=7500",
        "bitcoin:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq?amount=0.5",
        "ethereum:0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe?value=2e18",
        "geo:51.5074,-0.1278;u=25",
        "tel:+18885550144",
        "otpauth://totp/CorpSecure:admin@portal.net?secret=HXDMVJECJJWSRB3HWG",
        "matrix:r/cybersec_alerts:matrix.org",
        "ssh://git@corp-internal-git.com:8022/dev/keys.pem",
        "magnet:?xt=urn:btih:d2b2a32c65369da2188ca763f21040173096dec2",
        "BEGIN:VCARD\nVERSION:3.0\nN:Davis;Sarah\nORG:FinCorp\nTEL:555-0122\nEND:VCARD",
        "{\"iot_gateway\": \"gw-9902\", \"telemetry\": [44.2, 12.1, 99.8]}",
        "plain security advisory: reset all departmental passwords by Friday",
        "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
        "data:text/html;base64,PHNjcmlwdD53aW5kb3cubG9jYXRpb249J2h0dHA6Ly9waGlzaC54eXonPC9zY3JpcHQ+",
        "http://qrco.de/x992_nested_redirect_bypass_auth_token_77a9"
    ]
    
    X_images_ood = []
    X_urls_raw_ood = []
    y_ood = []
    
    for i in range(400):
        scheme_payload = ood_schemes[i % len(ood_schemes)]
        img = create_qr_image(scheme_payload, ecl=ERROR_CORRECT_M, tamper_logo=False, add_glare=False)
        X_images_ood.append(img)
        X_urls_raw_ood.append(scheme_payload)
        y_ood.append(1) # All OOD are zero-day / novel evasion attack vectors
        
    X_images_ood = np.array(X_images_ood, dtype=np.float32)
    X_seq_ood = pad_sequences(tokenizer.texts_to_sequences(X_urls_raw_ood), maxlen=MAX_LEN)
    y_ood = np.array(y_ood, dtype=np.int32)
    
    for d in ["data", "backend/data"]:
        if os.path.exists(d):
            out_ood_path = os.path.join(d, "quishing_ood_dataset.npz")
            np.savez_compressed(out_ood_path, images=X_images_ood, sequences=X_seq_ood, labels=y_ood)
            print(f"Saved OOD Zero-Day Benchmark to {out_ood_path} (Shape: {X_images_ood.shape})")

if __name__ == "__main__":
    generate_benchmark(sample_size=3000)
