"""
QR Decoding Robustness Benchmark
Generates N stylized / degraded QR symbologies and stress-tests four decode
configurations (raw engines vs the PhishShield multi-engine variant pipeline),
recording decode success and latency for the research robustness table.

Run:  python benchmark_qr_robustness.py
Artifacts: qr_robustness_results.json (raw per-cell results + summary table)
"""

import cv2
import json
import time
import numpy as np
from typing import Optional

import qrcode
import quishing_engine as qe
import zxingcpp

BASE_PAYLOAD = "https://phishshield-bench.test/survey/login-verify-checkpoint"

# ---------------------------------------------------------------- generators
def _make_qr(version=6, ec=qrcode.constants.ERROR_CORRECT_H):
    qr = qrcode.QRCode(version=version, error_correction=ec, box_size=10, border=2)
    qr.add_data(BASE_PAYLOAD)
    qr.make(fit=True)
    img = np.array(qr.make_image(fill_color="black", back_color="white").convert("RGB"))
    return cv2.cvtColor(img, cv2.COLOR_RGB2BGR)


def style_plain():
    return _make_qr()

def style_no_quiet_zone():
    img = _make_qr()
    b = int(img.shape[0] * 0.055)  # strip the generator's quiet border
    return img[b:-b, b:-b]

def style_jpeg_compressed():
    img = _make_qr()
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 12])
    return cv2.imdecode(buf, cv2.IMREAD_COLOR)

def style_blurred():
    return cv2.GaussianBlur(_make_qr(), (5, 5), 2.0)

def style_noisy():
    img = _make_qr().astype(np.int16)
    noise = np.random.randint(-45, 45, img.shape, dtype=np.int16)
    np.clip(img + noise, 0, 255).astype(np.uint8)

    return cv2.GaussianBlur(np.clip(img + noise, 0, 255).astype(np.uint8), (3, 3), 0)

def style_downscaled():
    img = _make_qr()
    return cv2.resize(img, (96, 96), interpolation=cv2.INTER_AREA)

def style_dark_mode():
    return cv2.bitwise_not(_make_qr())

def _logo_overlay(cover_frac: float):
    img = _make_qr()
    h, w = img.shape[:2]
    half = int(min(h, w) * 0.5 * cover_frac)
    cv2.rectangle(img, (w // 2 - half, h // 2 - half), (w // 2 + half, h // 2 + half), (255, 255, 255), -1)
    cv2.circle(img, (w // 2, h // 2), int(half * 0.85), (60, 90, 210), -1)
    return img

def style_logo_20():
    return _logo_overlay(0.20)

def style_logo_40():
    return _logo_overlay(0.40)

def style_colored_gradient():
    img = _make_qr()
    h, w = img.shape[:2]
    grad = np.tile(np.linspace(0, 1, w, dtype=np.float32), (h, 1))
    colored = img.copy().astype(np.float32)
    mask = np.all(colored < 60, axis=2)
    r = (40 + grad * 90).astype(np.float32)
    colored[mask, 0] = r[mask]
    colored[mask, 1] = (90 + grad * 80)[mask]
    colored[mask, 2] = (25 + grad * 40)[mask]
    return colored.astype(np.uint8)

def style_dotted():
    qr = qrcode.QRCode(version=6, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=1, border=2)
    qr.add_data(BASE_PAYLOAD)
    qr.make(fit=True)
    mat = np.array(qr.get_matrix(), dtype=bool)
    cell = 7
    h, w = mat.shape
    out = np.full(((h + 4) * cell, (w + 4) * cell, 3), 245, dtype=np.uint8)
    off = 2 * cell
    for r in range(h):
        for c in range(w):
            if mat[r][c]:
                cv2.circle(out, (off + c * cell + cell // 2, off + r * cell + cell // 2), cell // 2 - 1, (25, 25, 25), -1)
    return out

def style_transparent_alpha():
    qr = qrcode.QRCode(version=6, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=0)
    qr.add_data(BASE_PAYLOAD)
    qr.make(fit=True)
    mat = np.array(qr.get_matrix(), dtype=bool)
    size = mat.shape[0]
    rgba = np.zeros((size, size, 4), dtype=np.uint8)
    rgba[mat, 0] = 20; rgba[mat, 1] = 20; rgba[mat, 2] = 20; rgba[mat, 3] = 255
    return rgba  # 4-channel — exercises the alpha compositing pass

def style_perspective():
    img = _make_qr()
    h, w = img.shape[:2]
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst = np.float32([[w * 0.08, h * 0.12], [w * 0.97, h * 0.03], [w * 1.02, h * 0.95], [w * 0.02, h * 1.02]])
    M = cv2.getPerspectiveTransform(src, dst)
    size = (int(w * 1.1), int(h * 1.1))
    return cv2.warpPerspective(img, M, size, borderValue=(245, 245, 245))

def style_shadow_lighting():
    img = _make_qr().astype(np.float32)
    h, w = img.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    shading = 1.0 + 0.35 * ((xx / w) - 0.5) * 2  # darker right edge
    out = np.clip(img * shading[:, :, None], 0, 255)
    # keep whites near-white so thresholding still separates modules
    out = 255 - (255 - out) * 1.05
    return np.clip(out, 0, 255).astype(np.uint8)

STYLES = {
    "plain": style_plain,
    "no_quiet_zone": style_no_quiet_zone,
    "jpeg_q12": style_jpeg_compressed,
    "blur": style_blurred,
    "noise": style_noisy,
    "downscale_96px": style_downscaled,
    "dark_mode_inverted": style_dark_mode,
    "logo_20pct": style_logo_20,
    "logo_40pct": style_logo_40,
    "colored_gradient": style_colored_gradient,
    "dotted_round": style_dotted,
    "transparent_alpha": style_transparent_alpha,
    "perspective_tilt": style_perspective,
    "shadow_lighting": style_shadow_lighting,
}

# ------------------------------------------------------------------- engines
def engine_full_pipeline(img):
    """Patched PhishShield multi-engine pipeline (zxing + pyzbar-guard + OpenCV)."""
    data, _ = qe.robust_decode_qr(img, None)
    return data

def engine_legacy_pipeline(img):
    """Pre-fix pipeline: OpenCV variants only (simulates broken pyzbar + no zxing)."""
    real = qe._ZXINGCPP
    qe._ZXINGCPP = None
    try:
        data, _ = qe.robust_decode_qr(img, None)
    finally:
        qe._ZXINGCPP = real
    return data

def engine_zxing_raw(img):
    try:
        res = zxingcpp.read_barcodes(img, try_downscale=True)
        return res[0].text if res else None
    except Exception:
        return None

def engine_opencv_raw(img):
    try:
        data, points, _ = cv2.QRCodeDetector().detectAndDecode(img)
        return data if data and points is not None else None
    except Exception:
        return None

ENGINES = {
    "phishshield_pipeline (patched)": engine_full_pipeline,
    "legacy_pipeline (OpenCV-only)": engine_legacy_pipeline,
    "zxing_raw": engine_zxing_raw,
    "opencv_raw": engine_opencv_raw,
}

# ------------------------------------------------------------------- runner
def normalize(data: Optional[str]) -> Optional[str]:
    if not data:
        return None
    return data.strip()

def main():
    results = {}
    rows = {}

    for style_name, builder in STYLES.items():
        img = builder()
        results[style_name] = {}
        for eng_name, fn in ENGINES.items():
            t0 = time.perf_counter()
            try:
                data = normalize(fn(img))
            except Exception as e:
                data = None
                print(f"  ! {style_name}/{eng_name} raised {type(e).__name__}: {e}")
            ms = (time.perf_counter() - t0) * 1000
            ok = data == BASE_PAYLOAD
            results[style_name][eng_name] = {"decoded": ok, "payload": data, "latency_ms": round(ms, 1)}

    # Summary table
    engines_names = list(ENGINES.keys())
    print("\n", "=" * 100)
    print("QR DECODE ROBUSTNESS MATRIX (payload = %s)" % BASE_PAYLOAD)
    print("=" * 100)
    header = f"{'style':<20}" + "".join(f"{e[:22]:>24}" for e in engines_names)
    print(header)
    print("-" * len(header))
    for style_name in STYLES:
        line = f"{style_name:<20}"
        for eng_name in engines_names:
            cell = results[style_name][eng_name]
            mark = "OK" if cell["decoded"] else "FAIL"
            line += f"{mark + ' ' + str(cell['latency_ms']) + 'ms':>24}"
            ok = cell["decoded"]
            rows.setdefault(eng_name, [0, 0])
            rows[eng_name][0 if ok else 1] += 1
        print(line)

    print("-" * len(header))
    line = f"{'TOTAL (pass/fail)':<20}"
    for eng_name in engines_names:
        p, f = rows[eng_name]
        line += f"{f'{p}/{p + f}':>24}"
    print(line)

    out = {
        "payload": BASE_PAYLOAD,
        "engines": engines_names,
        "results": results,
        "summary": {e: {"pass": rows[e][0], "fail": rows[e][1]} for e in engines_names},
    }
    with open("qr_robustness_results.json", "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2)
    print("\nsaved -> qr_robustness_results.json")

if __name__ == "__main__":
    main()
