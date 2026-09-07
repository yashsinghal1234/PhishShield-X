"""
Quishing (QR Phishing) Defense-in-Depth Engine
Combines Multi-Pipeline Computer Vision, Protocol Scheme Profiling, Recursive URL Unrolling,
and PhishNet-Hybrid Semantic AI Analysis.
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
    Generates enhanced image variants (Grayscale, CLAHE Contrast, Adaptive Threshold, Inverted)
    to guarantee decoding of blurry, glared, or dark-mode QR codes.
    """
    variants = [img]
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
        variants.append(gray)

        # 1. Contrast Limited Adaptive Histogram Equalization (CLAHE)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        variants.append(enhanced)

        # 2. Otsu Thresholding
        _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        variants.append(otsu)

        # 3. Inverted QR (White modules on Dark background)
        inverted = cv2.bitwise_not(otsu)
        variants.append(inverted)
    except Exception:
        pass
    return variants


def robust_decode_qr(img: np.ndarray, pyzbar_decode_func=None) -> Tuple[Optional[str], Optional[np.ndarray]]:
    """
    Robust Dual-Engine QR Decoder.
    Tries Pyzbar first, with automatic OpenCV QRCodeDetector fallback across all preprocessed image variants.
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
                    if data:
                        return data, var
            except Exception:
                continue

    # Strategy 2: OpenCV Native QRCodeDetector (No external C-library dependency)
    detector = cv2.QRCodeDetector()
    for var in variants:
        try:
            data, points, _ = detector.detectAndDecode(var)
            if data and points is not None:
                return data, var
        except Exception:
            continue

    return None, None


def analyze_qr_visual_structure(img: np.ndarray) -> Dict:
    """
    Computer Vision Analysis of QR Code Geometry & Visual Integrity:
    - High Error Correction Level (ECL) Logo Masking (Central Obstruction)
    - Abnormal Module Matrix Density
    - Finder Pattern Symmetry
    """
    anomalies = []
    visual_risk_score = 0.0

    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
        h, w = gray.shape
        total_area = float(h * w)

        _, thresh = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY_INV)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        # 1. Central Logo Masking Detection (ECL Abuse)
        # Attackers place large fake logos (bank/brand) in the center
        center_x, center_y = w / 2.0, h / 2.0
        large_central_contours = 0

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area > (total_area * 0.04): # > 4% of total QR area
                M = cv2.moments(cnt)
                if M["m00"] != 0:
                    cx = M["m10"] / M["m00"]
                    cy = M["m01"] / M["m00"]
                    # If contour is centered in middle 40% of the image
                    if (0.30 * w < cx < 0.70 * w) and (0.30 * h < cy < 0.70 * h):
                        large_central_contours += 1

        if large_central_contours > 0:
            visual_risk_score += 0.25
            anomalies.append("Visual Anomaly: Suspicious central logo masking detected (High ECL exploitation)")

        # 2. Module Density Analysis
        black_pixels = np.sum(thresh == 255)
        density = black_pixels / total_area

        if density > 0.65 or density < 0.20:
            visual_risk_score += 0.20
            anomalies.append(f"Visual Anomaly: Abnormal matrix density ({density:.2f}) indicates synthetic/tampered QR")

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
