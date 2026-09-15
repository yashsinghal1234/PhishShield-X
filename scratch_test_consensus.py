import requests
import json
import qrcode
import cv2
import numpy as np

print("=== TEST 1: URL SCAN - Case A (fullstackopen.com) ===")
r1_a = requests.post("http://localhost:8000/api/detect/url", json={"url": "fullstackopen.com/en/part1/component_state_event_handlers"}, timeout=60).json()
print("Verdict:", r1_a["prediction"], "| Confidence:", f"{r1_a['confidence']*100:.1f}%")
print("Details:", r1_a["details"])

print("\n=== TEST 2: URL SCAN - Case B (paypal-security-update.xyz) ===")
r1_b = requests.post("http://localhost:8000/api/detect/url", json={"url": "http://paypal-security-update.xyz/login"}, timeout=60).json()
print("Verdict:", r1_b["prediction"], "| Confidence:", f"{r1_b['confidence']*100:.1f}%")
print("Details:", r1_b["details"])

print("\n=== TEST 3: QR SCAN - Case A (fullstackopen.com with Chrome Dino logo) ===")
qr_a = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, border=0)
qr_a.add_data("https://fullstackopen.com/en/part1/component_state_event_handlers")
qr_a.make(fit=True)
img_a = np.array(qr_a.make_image(fill_color="black", back_color="white").convert("RGB"))
h, w, _ = img_a.shape
img_a[h//3:2*h//3, w//3:2*w//3] = [0, 0, 0]
_, buf_a = cv2.imencode(".png", img_a)
r2_a = requests.post("http://localhost:8000/api/detect/qr", files={"file": ("chrome_dino.png", buf_a.tobytes(), "image/png")}, timeout=60).json()
print("Verdict:", r2_a["prediction"], "| Confidence:", f"{r2_a['confidence']*100:.1f}%")
print("Details:", r2_a["details"])

print("\n=== TEST 4: QR SCAN - Case B (paypal-security-update.xyz) ===")
qr_b = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=0)
qr_b.add_data("http://paypal-security-update.xyz/login")
qr_b.make(fit=True)
img_b = np.array(qr_b.make_image(fill_color="black", back_color="white").convert("RGB"))
_, buf_b = cv2.imencode(".png", img_b)
r2_b = requests.post("http://localhost:8000/api/detect/qr", files={"file": ("paypal_lure.png", buf_b.tobytes(), "image/png")}, timeout=60).json()
print("Verdict:", r2_b["prediction"], "| Confidence:", f"{r2_b['confidence']*100:.1f}%")
print("Details:", r2_b["details"])
