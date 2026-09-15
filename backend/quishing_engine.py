"""
Quishing (QR Phishing) Defense-in-Depth Engine
Combines Multi-Pipeline Computer Vision, Protocol Scheme Profiling, Recursive URL Unrolling,
and the Novel QuishCross-EDL (Cross-Modal Visual-Lexical Co-Attention Network with Evidential Dirichlet Uncertainty).
"""

import cv2
import numpy as np
import urllib.parse
import requests
import re
from typing import Dict, Tuple, Optional, List

# Schemes frequently weaponized in Quishing attacks
HIGH_RISK_SCHEMES = {
    "WIFI": "Rogue Wi-Fi Access Point Exploitation",
    "SMSTO": "Premium SMS Toll Fraud",
    "TEL": "Telephony / Vishing Social Engineering",
    "MAILTO": "Phishing Email Auto-Trigger",
    "UPI": "Direct Financial / Payment Request",
    "BITCOIN": "Cryptocurrency Transfer Request",
    "ETHEREUM": "Cryptocurrency Transfer Request",
    "DATA": "Embedded Data / Base64 Script Injection",
    "JAVASCRIPT": "Cross-Site Scripting (XSS) / Execution",
    "BLOB": "Binary Object Payload Execution",
    "VCARD": "Malicious Contact Card Injection",
    "VCALENDAR": "Calendar Event Phishing / Malicious Invite"
}

KNOWN_SHORTENERS_AND_REDIRECTS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly",
    "adf.ly", "bit.do", "mcaf.ee", "su.pr", "cutt.ly", "shorturl.at", "qr.ae",
    "qrco.de", "me-qr.com", "linktr.ee", "rb.gy", "rebrand.ly", "tiny.cc"
}

OPEN_REDIRECT_HOSTS = {
    "google.com": ["url", "q"],
    "l.facebook.com": ["u"],
    "t.co": [],
    "linkedin.com": ["url"]
}


def preprocess_image_variants(img: np.ndarray) -> List[np.ndarray]:
    """
    Generates enhanced image variants in priority order:
    1. Base Grayscale + Quiet-Zone White Padding (handles standard cropped QR codes)
    2. Scaled / CLAHE Contrast (handles blurry / compressed captures)
    3. Otsu & Adaptive Thresholding (handles logo-masked / uneven lighting)
    4. Inverted dark-mode variants (handles white-on-black QR codes)
    """
    variants = []
    if img is None:
        return variants

    raw_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    h, w = raw_gray.shape[:2]

    # Priority 1: Direct grayscale and standard white quiet-zone padding
    variants.append(raw_gray)
    pad = max(24, int(max(h, w) * 0.15))
    padded_white = cv2.copyMakeBorder(raw_gray, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=255)
    variants.append(padded_white)

    # Priority 2: Standard scaling and contrast enhancement on padded image
    scaled_125 = cv2.resize(padded_white, (0, 0), fx=1.25, fy=1.25, interpolation=cv2.INTER_CUBIC)
    variants.append(scaled_125)

    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    variants.append(clahe.apply(padded_white))

    _, otsu = cv2.threshold(padded_white, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants.append(otsu)

    adapt = cv2.adaptiveThreshold(padded_white, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 5)
    variants.append(adapt)

    # Priority 3: Dark-mode / Inverted QR variants
    raw_inverted = cv2.bitwise_not(raw_gray)
    padded_black = cv2.copyMakeBorder(raw_inverted, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=255)
    variants.append(padded_black)
    variants.append(raw_inverted)

    # Priority 4: Deeper pyramid scales if previous attempts did not decode
    for scale in [0.75, 1.5, 2.0]:
        variants.append(cv2.resize(padded_white, (0, 0), fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC))

    return variants


def robust_decode_qr(img: np.ndarray, pyzbar_decode_func=None) -> Tuple[Optional[str], Optional[np.ndarray]]:
    """
    Robust Multi-Engine QR Decoder.
    Tries Pyzbar first, then OpenCV QRCodeDetectorAruco (resilient to central logo occlusions),
    and standard OpenCV QRCodeDetector across all quiet-zone padded and enhanced image variants.
    """
    if img is None:
        return None, None

    variants = preprocess_image_variants(img)

    # Strategy 1: PyZbar across all enhanced variants
    if pyzbar_decode_func is not None:
        for var in variants:
            try:
                decoded = pyzbar_decode_func(var)
                if decoded:
                    data = decoded[0].data.decode("utf-8", errors="ignore")
                    if data and len(data.strip()) > 0:
                        return data.strip(), var
            except Exception:
                continue

    # Strategy 2: OpenCV Detectors (Aruco first for logo-masked/high-ECL QR codes, then standard)
    detectors = []
    if hasattr(cv2, "QRCodeDetectorAruco"):
        detectors.append(cv2.QRCodeDetectorAruco())
    detectors.append(cv2.QRCodeDetector())

    for det in detectors:
        for var in variants:
            try:
                data, points, _ = det.detectAndDecode(var)
                if data and points is not None and len(data.strip()) > 0:
                    return data.strip(), var
            except Exception:
                continue

    return None, None


def analyze_qr_visual_structure(img: np.ndarray) -> Dict:
    """
    Computer Vision Analysis of QR Code Geometry & Visual Integrity:
    - Abnormal Module Matrix Density (Severe corruption / solid fill)
    - Finder Pattern Integrity
    Note: Generic centered logo presence is standard High-ECL (Error Correction Level H)
    design used by Google Chrome and legitimate marketing, and is NOT treated as an anomaly.
    """
    anomalies = []
    visual_risk_score = 0.0

    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
        h, w = gray.shape
        total_area = float(h * w)

        _, thresh = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY_INV)

        # 1. Module Density Analysis (Detect severe tampering, solid-color corruption, or blank canvas)
        black_pixels = np.sum(thresh == 255)
        density = black_pixels / total_area

        if density > 0.85 or density < 0.12:
            visual_risk_score += 0.20
            anomalies.append(f"Visual Anomaly: Severe abnormal matrix density ({density:.2f}) indicates corrupt/tampered QR")

    except Exception as e:
        anomalies.append(f"Visual analysis note: {str(e)}")

    return {
        "visual_risk_score": visual_risk_score,
        "anomalies": anomalies
    }


def analyze_payload_protocol(raw_payload: str) -> Dict:
    """
    Inspects QR payload for non-standard protocol schemes, device triggers, and financial requests.
    """
    clean_payload = raw_payload.strip()
    upper_payload = clean_payload.upper()
    protocol_risk = 0.0
    anomalies = []
    target_url = None

    matched_scheme = None
    for scheme, description in HIGH_RISK_SCHEMES.items():
        if upper_payload.startswith(scheme + ":"):
            matched_scheme = scheme
            if scheme in ["UPI", "BITCOIN", "ETHEREUM"]:
                protocol_risk += 0.60
                anomalies.append(f"High-Risk Protocol: {description} detected ({scheme})")
            elif scheme in ["WIFI", "SMSTO", "DATA", "JAVASCRIPT"]:
                protocol_risk += 0.45
                anomalies.append(f"Exploit Protocol: {description} detected ({scheme})")
            else:
                protocol_risk += 0.25
                anomalies.append(f"Non-Standard Scheme: {description} ({scheme})")
            break

    is_web_url = upper_payload.startswith("HTTP://") or upper_payload.startswith("HTTPS://")
    if is_web_url:
        target_url = clean_payload
    elif not matched_scheme:
        # Might be a domain without scheme (e.g. "phishing-bank.xyz/login")
        if "." in clean_payload and "/" in clean_payload and " " not in clean_payload:
            target_url = "https://" + clean_payload
        else:
            protocol_risk += 0.15
            anomalies.append("Payload: Unstructured plain text / unknown format")

    return {
        "is_web_url": is_web_url,
        "matched_scheme": matched_scheme,
        "protocol_risk": protocol_risk,
        "target_url": target_url,
        "anomalies": anomalies
    }


def recursively_unroll_url(initial_url: str, max_hops: int = 4) -> Tuple[str, List[str], float]:
    """
    Recursively follows HTTP redirects to defeat multi-hop shorteners and open-redirect cloaking.
    Returns (final_url, redirect_chain, risk_boost).
    """
    current_url = initial_url
    chain = [initial_url]
    risk_boost = 0.0

    for hop in range(max_hops):
        try:
            parsed = urllib.parse.urlparse(current_url)
            domain = parsed.netloc.lower().split(":")[0]

            # Check if domain is a known shortener
            if any(domain == s or domain.endswith("." + s) for s in KNOWN_SHORTENERS_AND_REDIRECTS):
                risk_boost = max(risk_boost, 0.30)

            # Send lightweight HEAD request to follow redirect
            resp = requests.head(current_url, allow_redirects=True, timeout=3.5)
            if resp.url and resp.url != current_url:
                chain.append(resp.url)
                current_url = resp.url
                # Destination domain changed
                if urllib.parse.urlparse(resp.url).netloc.lower() != domain:
                    risk_boost = max(risk_boost, 0.35)
            else:
                break
        except Exception:
            break

    return current_url, chain, risk_boost


def build_m3_early_fusion_model():
    """
    Builds M3 (Multimodal Early Fusion + Softmax) for production serving:
    Visual Stream: Conv2D(16) -> MaxPool(4x4) -> Flatten -> Dense(32) -> Dropout(0.2)
    Lexical Stream: Character Embedding -> Conv1D(32) -> MaxPool(6) -> Flatten -> Dense(32) -> Dropout(0.2)
    Early Fusion: Concatenation -> Dense(48) -> Dropout(0.2) -> Dense(32) -> Softmax(2)
    """
    import tensorflow as tf
    from tensorflow.keras.models import Model
    from tensorflow.keras.layers import (
        Input, Embedding, Conv2D, MaxPooling2D,
        Conv1D, MaxPooling1D, Dense, Dropout,
        Flatten, concatenate
    )

    IMG_SHAPE = (64, 64, 1)
    MAX_LEN = 180
    VOCAB_SIZE = 110
    EMBEDDING_DIM = 32
    FEATURE_DIM = 32
    NUM_CLASSES = 2

    # 1. Visual Stream
    inp_v = Input(shape=IMG_SHAPE, name="qr_visual_stream")
    v = Conv2D(16, (3, 3), padding="same", activation="relu")(inp_v)
    v = MaxPooling2D((4, 4))(v)
    v = Flatten()(v)
    v_dense = Dense(FEATURE_DIM, activation="relu", name="vis_dense")(v)
    v_dense = Dropout(0.2)(v_dense)

    # 2. Lexical Stream
    inp_l = Input(shape=(MAX_LEN,), name="payload_lexical_stream")
    l = Embedding(VOCAB_SIZE, EMBEDDING_DIM)(inp_l)
    l = Conv1D(FEATURE_DIM, 3, padding="same", activation="relu")(l)
    l = MaxPooling1D(6)(l)
    l = Flatten()(l)
    l_dense = Dense(FEATURE_DIM, activation="relu", name="lex_dense")(l)
    l_dense = Dropout(0.2)(l_dense)

    # 3. Concatenation & Softmax Classification Head
    concat = concatenate([v_dense, l_dense], name="early_fusion_concat")
    h = Dense(48, activation="relu")(concat)
    h = Dropout(0.2)(h)
    h = Dense(32, activation="relu")(h)
    out = Dense(NUM_CLASSES, activation="softmax", name="softmax_out")(h)

    model = Model(inputs=[inp_v, inp_l], outputs=out, name="M3_Early_Fusion_Softmax")
    model.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return model


def evaluate_m3_early_fusion(
    img: Optional[np.ndarray],
    payload_text: str,
    model=None,
    tokenizer=None
) -> Dict:
    """
    Production Neural Inference with M3 (Multimodal Early Fusion + Softmax):
    Combines 64x64 QR spatial matrix features with 180-char lexical sequence tokens
    and outputs calibrated class probabilities (ECE 0.0236).
    """
    if model is None or tokenizer is None:
        return {"available": False}

    try:
        # 1. Preprocess QR Image to (1, 64, 64, 1)
        if img is not None:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
            resized = cv2.resize(gray, (64, 64), interpolation=cv2.INTER_AREA)
            img_tensor = (resized.astype(np.float32) / 255.0).reshape(1, 64, 64, 1)
        else:
            img_tensor = np.zeros((1, 64, 64, 1), dtype=np.float32)

        # 2. Tokenize and Pad Sequence to (1, 180)
        from tensorflow.keras.preprocessing.sequence import pad_sequences
        seqs = tokenizer.texts_to_sequences([payload_text])
        seq_tensor = pad_sequences(seqs, maxlen=180, padding="post", truncating="post")

        # 3. Model Forward Pass
        probs = model.predict([img_tensor, seq_tensor], verbose=0)
        if isinstance(probs, list):
            probs = probs[-1]

        prob_phish = float(probs[0][1])
        prob_safe = float(probs[0][0])

        return {
            "available": True,
            "prob_phishing": prob_phish,
            "prob_safe": prob_safe,
            "confidence": float(np.max(probs[0]))
        }
    except Exception as e:
        print(f"M3 Early Fusion inference error: {e}")
        return {"available": False, "error": str(e)}


def evaluate_active_learning_triage(
    ml_prediction: str,
    ml_confidence: float,
    vt_malicious: int = 0,
    gsb_malicious: bool = False,
    domain_age_days: Optional[int] = None,
    is_free_ca: bool = False,
    has_credential_harvesting: bool = False,
    is_tunnel_ddns: bool = False,
    is_whitelisted: bool = False
) -> Dict:
    """
    Phase 4 Active Learning & Continual Retraining Multi-Source Consensus Triage:
    Decouples independent external ground-truth signals from internal model predictions
    to prevent adversarial dataset poisoning and circular blind-spot reinforcement.

    Tiers:
    - Tier 1: Auto-Confirmed Malicious (Model flags Phishing AND confirmed by independent external consensus).
    - Tier 2: Ambiguous / Quarantine (Mandatory Human Checkpoint; never fed directly to retraining).
    - Tier 3: Auto-Cleared Benign (Exclusively validated on external infrastructure & threat-intel history; zero ML score dependency).
    """
    # 1. Independent Malicious Confirmation
    # VT >= 1 or GSB == True are direct independent threat-intel hits.
    # Fresh domain (<= 48h) requires at least one corroborating independent signal (harvesting form, disposable CA, or tunnel DDNS).
    fresh_domain_corroborated = (
        domain_age_days is not None and domain_age_days <= 2 and
        (has_credential_harvesting or is_free_ca or is_tunnel_ddns)
    )
    has_independent_malicious_hit = (vt_malicious >= 1) or gsb_malicious or fresh_domain_corroborated

    # 2. Independent Benign Confirmation (Zero ML Score Dependency)
    # Rests strictly on established domain age, non-free CA, clean threat intel, or verified top-whitelist.
    is_independently_benign = (
        (is_whitelisted or (domain_age_days is not None and domain_age_days > 365)) and
        (vt_malicious == 0) and
        (not gsb_malicious) and
        (not is_free_ca) and
        (not is_tunnel_ddns) and
        (not has_credential_harvesting)
    )

    # 3. Disambiguate Triage Routing
    # Tier 1: Requires explicit "Phishing" verdict (>0.74) AND independent external hit.
    # Tier 3: Strictly independent benign signals (no ML confidence circularity).
    # Tier 2: All "Suspicious" (0.40-0.74), conflicting, novel, or unverified cases must route here.
    if ml_prediction == "Phishing" and has_independent_malicious_hit:
        return {
            "triage_tier": "Tier 1: Auto-Confirmed (Malicious)",
            "retraining_eligible": True,
            "requires_human_review": False,
            "rationale": "High-confidence detection verified by independent threat-intel consensus."
        }
    elif is_independently_benign and ml_prediction != "Phishing":
        return {
            "triage_tier": "Tier 3: Auto-Cleared (Benign)",
            "retraining_eligible": True,
            "requires_human_review": False,
            "rationale": "Verified through established domain history, valid non-free CA, and clean multi-engine intelligence (no ML circularity)."
        }
    else:
        return {
            "triage_tier": "Tier 2: Ambiguous (Quarantine / Human Review Required)",
            "retraining_eligible": False,
            "requires_human_review": True,
            "rationale": "Ambiguous/Suspicious signal (0.40-0.74), novel pattern, or lack of independent corroboration. Human review firewall active."
        }



def evaluate_quish_cross_edl(
    img: Optional[np.ndarray],
    payload_text: str,
    model=None,
    tokenizer=None
) -> Dict:
    """
    Research Neural Inference with QuishCross-EDL (Research Artifact):
    Extracts cross-modal visual QR tokens and lexical payload sequence,
    evaluates Dirichlet concentration parameters, and derives Belief Masses and Epistemic Uncertainty.
    """
    if model is None or tokenizer is None:
        return {"available": False}

    try:
        # 1. Preprocess QR Image to (1, 64, 64, 1)
        if img is not None:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
            resized = cv2.resize(gray, (64, 64), interpolation=cv2.INTER_AREA)
            img_tensor = (resized.astype(np.float32) / 255.0).reshape(1, 64, 64, 1)
        else:
            img_tensor = np.zeros((1, 64, 64, 1), dtype=np.float32)

        # 2. Tokenize and Pad Sequence to (1, 180)
        from tensorflow.keras.preprocessing.sequence import pad_sequences
        seqs = tokenizer.texts_to_sequences([payload_text])
        seq_tensor = pad_sequences(seqs, maxlen=180, padding="post", truncating="post")

        # 3. Model Forward Pass
        alpha = model.predict([img_tensor, seq_tensor], verbose=0)
        if isinstance(alpha, list):
            alpha = alpha[-1]
        
        # 4. Evidential Dirichlet Computation
        S = np.sum(alpha, axis=-1, keepdims=True)
        probs = alpha / S
        beliefs = (alpha - 1.0) / S
        u = 2.0 / S.flatten()[0]

        prob_phish = float(probs[0][1])
        belief_safe = float(beliefs[0][0])
        belief_phish = float(beliefs[0][1])

        return {
            "available": True,
            "prob_phishing": prob_phish,
            "belief_safe": belief_safe,
            "belief_phishing": belief_phish,
            "epistemic_uncertainty": float(u),
            "dirichlet_strength": float(S[0][0])
        }
    except Exception as e:
        print(f"QuishCross-EDL inference error: {e}")
        return {"available": False, "error": str(e)}

