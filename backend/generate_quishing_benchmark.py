"""
Programmatic Quishing (QR Phishing) Benchmark Synthesis & Augmentation Generator (V2).
Generates reproducible In-Distribution (ID) and Out-of-Distribution (OOD / Zero-Day) datasets
with ground-truth visual matrices (96x96) and lexical token sequences (L=180).

V2 Data Strategy (see research_paper/quish_edl_improvement_research.md, section 5):
  - 96x96 input resolution to preserve module-level QR detail (W2 fix).
  - Visual style attributes (logo, inversion, glare, error-correction level) are randomized
    INDEPENDENTLY of the class label, closing the shortcut-learning loophole where the
    visual branch could classify from generator artifacts instead of genuine structure (W5 fix).
  - Real-capture augmentation: perspective warp, JPEG roundtrip, sensor noise, blur.

Run from the repository root:  python generate_quishing_benchmark.py
"""

import os
import qrcode
from qrcode.constants import ERROR_CORRECT_L, ERROR_CORRECT_M, ERROR_CORRECT_Q, ERROR_CORRECT_H
import numpy as np
import pandas as pd
from PIL import Image, ImageDraw, ImageFilter
import cv2
import pickle

IMAGE_SIZE = (96, 96)  # V2: crisp module detail preserved
MAX_LEN = 180
VOCAB_SIZE = 110

# Error Correction Levels decoupled from the label (both classes use the same distribution)
ECL_CHOICES = [ERROR_CORRECT_L, ERROR_CORRECT_M, ERROR_CORRECT_Q, ERROR_CORRECT_H]
ECL_PROBS = [0.35, 0.35, 0.20, 0.10]


def apply_capture_augmentation(img_pil: Image.Image, rng: np.random.RandomState) -> Image.Image:
    """Applies realistic capture-path degradation (print/phone/screenshot) with 0-2 effects."""
    n_effects = rng.randint(0, 3)
    choices = rng.choice(["warp", "jpeg", "noise", "blur", "moire"], size=n_effects, replace=False)

    for effect in choices:
        if effect == "warp":
            # Perspective warp (phone photo of a printed sticker)
            w, h = img_pil.size
            shift = int(min(w, h) * rng.uniform(0.02, 0.09))
            src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
            dst = np.float32([
                [rng.randint(-shift, shift), rng.randint(-shift, shift)],
                [w + rng.randint(-shift, shift), rng.randint(-shift, shift)],
                [w + rng.randint(-shift, shift), h + rng.randint(-shift, shift)],
                [rng.randint(-shift, shift), h + rng.randint(-shift, shift)],
            ])
            arr = np.array(img_pil.convert("RGB"), dtype=np.uint8)
            m = cv2.getPerspectiveTransform(src, dst) if len({tuple(r) for r in dst.tolist()}) == 4 else None
            if m is not None:
                warped = cv2.warpPerspective(arr, m, (w, h), borderValue=(255, 255, 255))
                img_pil = Image.fromarray(warped)
        elif effect == "jpeg":
            quality = int(rng.uniform(40, 90))
            import io
            buf = io.BytesIO()
            img_pil.convert("RGB").save(buf, format="JPEG", quality=quality)
            buf.seek(0)
            img_pil = Image.open(buf)
        elif effect == "noise":
            arr = np.array(img_pil.convert("L"), dtype=np.float32)
            arr = arr + rng.normal(0, rng.uniform(4, 14), arr.shape)
            arr = np.clip(arr, 0, 255).astype(np.uint8)
            img_pil = Image.fromarray(arr)
        elif effect == "blur":
            img_pil = img_pil.filter(ImageFilter.GaussianBlur(radius=rng.uniform(0.4, 1.1)))
        elif effect == "moire":
            # Screen-capture moire interference bands
            arr = np.array(img_pil.convert("L"), dtype=np.float32)
            h_, w_ = arr.shape
            yy = np.arange(h_).reshape(-1, 1)
            xx = np.arange(w_).reshape(1, -1)
            freq = rng.uniform(0.15, 0.45)
            amp = rng.uniform(4, 10)
            wave = amp * np.sin(2 * np.pi * (xx * freq + yy * freq * 0.7))
            arr = np.clip(arr + wave, 0, 255).astype(np.uint8)
            img_pil = Image.fromarray(arr)

    return img_pil.convert("RGB")


def create_qr_image(payload: str, ecl=ERROR_CORRECT_M, tamper_logo=False, invert_color=False,
                    add_glare=False, rounded=False, colored=False, rng=None) -> np.ndarray:
    """Renders an authentic QR code image with optional visual styling and capture degradation."""
    if rng is None:
        rng = np.random.RandomState()

    qr = qrcode.QRCode(
        version=None,
        error_correction=ecl,
        box_size=4,
        border=rng.choice([2, 4, 6]),
    )
    qr.add_data(payload)
    qr.make(fit=True)
    back_color = "white" if not colored else str(rng.choice(["#F5F5F5", "#EAF5F0", "#EEF2FF"]))
    fill_color = "black" if not colored else str(rng.choice(["#000000", "#1F2A44", "#1F6A45"]))
    img = qr.make_image(fill_color=fill_color, back_color=back_color).convert("RGB")

    # 1. Central Logo Badge (ECL-abuse tampering *or* legitimate marketing style)
    if tamper_logo:
        draw = ImageDraw.Draw(img)
        w, h = img.size
        cw, ch = int(w * rng.uniform(0.22, 0.30)), int(h * rng.uniform(0.22, 0.30))
        top_left = ((w - cw) // 2, (h - ch) // 2)
        bottom_right = ((w + cw) // 2, (h + ch) // 2)
        fill = tuple(int(c) for c in [(30, 80, 200), (200, 40, 40), (30, 120, 80)][int(rng.randint(0, 3))])
        draw.rectangle([top_left, bottom_right], fill=tuple(fill), outline=(255, 255, 255), width=2)

    # 2. Rounded-module stylization (dotted QR styles seen in designer QR generators)
    if rounded:
        arr = np.array(img.convert("L"), dtype=np.uint8)
        arr_inv = cv2.bitwise_not(arr)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        closed = cv2.morphologyEx(arr_inv, cv2.MORPH_CLOSE, kernel, iterations=1)
        img = Image.fromarray(cv2.bitwise_not(closed))

    # 3. Color Inversion (Dark Mode)
    if invert_color:
        img_np = np.array(img)
        img_np = 255 - img_np
        img = Image.fromarray(img_np)

    # 4. Glare / Blur Degradation
    if add_glare:
        img = img.filter(ImageFilter.GaussianBlur(radius=0.6))

    img = apply_capture_augmentation(img, rng)

    # Resize to standard input resolution
    img = img.resize(IMAGE_SIZE, Image.Resampling.BILINEAR)
    img_gray = np.array(img.convert("L"), dtype=np.float32) / 255.0
    return np.expand_dims(img_gray, axis=-1)


def _pick_styles(rng: np.random.RandomState):
    """Visual style attributes randomized INDEPENDENTLY of the class label (anti-shortcut)."""
    return {
        "tamper_logo": bool(rng.rand() < 0.25),
        "invert_color": bool(rng.rand() < 0.10),
        "add_glare": bool(rng.rand() < 0.15),
        "rounded": bool(rng.rand() < 0.10),
        "colored": bool(rng.rand() < 0.20),
        "ecl": int(rng.choice(ECL_CHOICES, p=ECL_PROBS)),
        "rng": rng,
    }


def generate_benchmark(sample_size=3000):
    print("=== Generating Deterministic Quishing Benchmark Dataset (V2, 96x96) ===")

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

    for label, urls in ((0, benign_urls), (1, phish_urls)):
        for i, url in enumerate(urls):
            styles = _pick_styles(np.random.RandomState(1000 + label * 5000 + i))
            img = create_qr_image(url, **styles)
            X_images_id.append(img)
            X_urls_raw_id.append(url)
            y_id.append(label)

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

    # Save ID Dataset (both roots, mirroring the OOD dataset writer)
    os.makedirs("data", exist_ok=True)
    os.makedirs("backend/data", exist_ok=True)
    for out_id_path in ["data/quishing_id_dataset.npz", "backend/data/quishing_id_dataset.npz"]:
        np.savez_compressed(out_id_path, images=X_images_id, sequences=X_seq_id, labels=y_id)
        print(f"Saved In-Distribution (ID) Benchmark to {out_id_path} (Shape: {X_images_id.shape}, {X_seq_id.shape})")

    # 3. Synthesize Out-of-Distribution (OOD / Zero-Day Attack Set) (N = 400)
    # 16 scheme families x 25 deterministic capture variants; family index = i % 16
    # (Leave-Families-Out splits operate on i % 16 parity — do not reorder this list)
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
        styles = _pick_styles(np.random.RandomState(70000 + i))
        styles["tamper_logo"] = False  # keep scheme-families visually distinguishable from logo-tamper ID style
        img = create_qr_image(scheme_payload, **styles)
        X_images_ood.append(img)
        X_urls_raw_ood.append(scheme_payload)
        y_ood.append(1)  # All OOD are zero-day / novel evasion attack vectors

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
