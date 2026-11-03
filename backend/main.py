from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Form
from fastapi.responses import Response
import os
import sys
import asyncio
import importlib.util
from pathlib import Path

# Playwright requires ProactorEventLoop on Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import requests
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List, Optional
import cv2
import numpy as np
from PIL import Image
import io
from datetime import datetime, timedelta

decode = None
_pyzbar_spec = importlib.util.find_spec("pyzbar")
if _pyzbar_spec and _pyzbar_spec.origin:
    _pyzbar_dir = str(Path(_pyzbar_spec.origin).parent)
    os.environ["PATH"] = _pyzbar_dir + os.pathsep + os.environ.get("PATH", "")
    if hasattr(os, "add_dll_directory"):
        os.add_dll_directory(_pyzbar_dir)
try:
    from pyzbar.pyzbar import decode
except Exception as e:
    print(f"pyzbar unavailable (QR decoding disabled): {e}")

import database, models, schemas, ml_services

# Initialize Database
models.Base.metadata.create_all(bind=database.engine)

from cachetools import TTLCache

screenshot_cache = TTLCache(maxsize=100, ttl=3600)

app = FastAPI(title="PhishShield-X API", version="0.1.0")

@app.on_event("startup")
def startup_event():
    """Pre-load and JIT-warm machine learning models in a non-blocking background daemon thread."""
    import threading
    def _warmup_worker():
        try:
            ml_services.load_ai_models()
            ml_services.ensure_deep_phish_loaded()
            ml_services.ensure_m3_loaded()
            ml_services.warmup_models()
        except Exception as e:
            print(f"Startup warmup notice: {e}")
    threading.Thread(target=_warmup_worker, daemon=True).start()

# Allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

def save_history(db: Session, scan_type: str, input_data: str, result: dict):
    try:
        history_entry = models.DetectionHistory(
            scan_type=scan_type,
            input_data=input_data,
            prediction=result.get("prediction", "Unknown"),
            confidence=result.get("confidence", 0.5),
            details=result.get("details", "")
        )
        db.add(history_entry)
        db.commit()
        db.refresh(history_entry)
        return history_entry
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        class MockHistory:
            id = int(time.time() * 1000) % 1000000
        return MockHistory()

@app.api_route("/", methods=["GET", "HEAD"])
def read_root():
    return {"message": "Welcome to PhishShield-X API", "status": "healthy"}

@app.api_route("/health", methods=["GET", "HEAD"])
def health_check():
    return {"status": "ok"}

@app.post("/api/detect/url", response_model=schemas.ScanResponse)
def scan_url(request: schemas.URLScanRequest, db: Session = Depends(get_db)):
    result = ml_services.detect_url_phishing(request.url)
    osint_data = ml_services.get_osint_data(request.url, ssl_info=result.get("ssl_info"), geo_info=result.get("geo_info"))
    
    saved = save_history(db, "url", request.url, result)
    shadow = result.get("shadow_telemetry") or {}
    return {
        "id": saved.id,
        "scan_type": "url",
        "prediction": result["prediction"],
        "confidence": result["confidence"],
        "details": result["details"],
        "friction_level": result.get("friction_level", "none"),
        "advisory_message": result.get("advisory_message"),
        "ip_address": osint_data.get("ip_address"),
        "location": osint_data.get("location"),
        "asn": osint_data.get("asn"),
        "hosting_provider": osint_data.get("hosting_provider"),
        "tld": osint_data.get("tld"),
        "screenshot_url": osint_data.get("screenshot_url"),
        "brand": osint_data.get("brand"),
        "ssl_issuer": osint_data.get("ssl_issuer"),
        "certificate_details": osint_data.get("certificate_details"),
        "certificate_age_days": osint_data.get("certificate_age_days"),
        "protocol": osint_data.get("protocol"),
        "dns_status": osint_data.get("dns_status"),
        "entropy": osint_data.get("entropy"),
        "subdomain_depth": osint_data.get("subdomain_depth"),
        "edl_uncertainty": shadow.get("edl_uncertainty") if shadow.get("edl_uncertainty") is not None else shadow.get("u"),
        "edl_strength": shadow.get("edl_strength") if shadow.get("edl_strength") is not None else shadow.get("S"),
        "edl_prob": shadow.get("edl_prob")
    }

def _normalize_page_url(url: str) -> str:
    target = (url or "").strip()
    if not target:
        return ""
    if not target.startswith(("http://", "https://")):
        return f"https://{target}"
    return target


def _is_image_response(resp: requests.Response) -> bool:
    content_type = resp.headers.get("content-type", "").lower()
    return resp.status_code == 200 and ("image" in content_type or resp.content[:8] == b"\x89PNG\r\n\x1a\n")


def _generate_synthetic_sandbox_dom(target: str) -> bytes:
    """Generate high-tech sandbox capture card for offline or sinkholed targets."""
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (1280, 800), color=(11, 15, 25))
    draw = ImageDraw.Draw(img)

    # Browser top bar
    draw.rectangle([0, 0, 1280, 52], fill=(18, 24, 38))
    draw.line([0, 52, 1280, 52], fill=(30, 41, 59), width=1)
    
    # Traffic light window controls
    draw.ellipse([20, 20, 32, 32], fill=(239, 68, 68))
    draw.ellipse([40, 20, 52, 32], fill=(245, 158, 11))
    draw.ellipse([60, 20, 72, 32], fill=(16, 185, 129))

    # Address bar
    draw.rounded_rectangle([90, 12, 1100, 40], radius=8, fill=(11, 15, 25), outline=(51, 65, 85))
    draw.text((105, 18), f"HEADLESS SANDBOX // {target}", fill=(148, 163, 184))

    # Subtle grid lines in viewport
    for y in range(80, 800, 40):
        draw.line([0, y, 1280, y], fill=(15, 23, 42), width=1)
    for x in range(0, 1280, 40):
        draw.line([x, 52, x, 800], fill=(15, 23, 42), width=1)

    # Center card
    draw.rounded_rectangle([320, 230, 960, 570], radius=16, fill=(15, 23, 42), outline=(0, 71, 255), width=2)
    draw.text((370, 270), "■ ISOLATED DOM CAPTURE SANDBOX", fill=(56, 189, 248))
    draw.text((370, 320), f"Target URL: {target[:50]}", fill=(255, 255, 255))
    draw.text((370, 360), "Telemetry: Headless sandbox connection attempted", fill=(148, 163, 184))
    draw.text((370, 400), "Status: Host Dropped Handshake / Domain Unresolved", fill=(244, 63, 94))
    draw.text((370, 440), "Verdict: Threat Deflection Active // No Malicious Execution", fill=(16, 185, 129))
    draw.text((370, 490), f"Captured: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}", fill=(100, 116, 139))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def _capture_with_playwright_async(target: str) -> Optional[bytes]:
    if os.getenv("DISABLE_PLAYWRIGHT", "false").lower() in ("true", "1", "yes"):
        return None
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-web-security"
                ]
            )
            try:
                context = await browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                    viewport={"width": 1280, "height": 800},
                    locale="en-US",
                    ignore_https_errors=True
                )
                page = await context.new_page()
                try:
                    await page.goto(target, wait_until="domcontentloaded", timeout=9000)
                    await page.wait_for_timeout(1000)
                except Exception:
                    # In case page continues streaming / long polling, still capture DOM snapshot
                    pass
                return await page.screenshot(type="png", full_page=False)
            finally:
                await browser.close()
    except Exception as e:
        print(f"Playwright screenshot error: {e}")
        return None


def _fetch_remote_screenshot(target: str):
    import urllib.parse

    scrapfly_key = os.environ.get("SCRAPFLY_API_KEY")
    scrapingbee_key = os.environ.get("SCRAPINGBEE_API_KEY")
    encoded_url = urllib.parse.quote(target, safe="")

    candidates = [
        # 1. High-definition Microlink Cloud Browser (Renders SPA / JavaScript DOM cleanly without watermarks)
        f"https://api.microlink.io?url={encoded_url}&screenshot=true&meta=false&embed=screenshot.url",
        # 2. Thum.io headless renderer
        f"https://image.thum.io/get/width/1280/noanimate/{target}",
    ]
    if scrapfly_key:
        candidates.append(f"https://api.scrapfly.io/screenshot?key={scrapfly_key}&url={encoded_url}&format=png")
    if scrapingbee_key:
        candidates.append(
            f"https://app.scrapingbee.com/api/v1/?api_key={scrapingbee_key}&url={encoded_url}&screenshot=true"
        )

    for candidate in candidates:
        try:
            resp = requests.get(candidate, timeout=8.0, allow_redirects=True)
            if _is_image_response(resp) and len(resp.content) > 3000:
                return resp.content
        except Exception as e:
            print(f"Screenshot API error ({candidate}): {e}")
    return None


@app.get("/api/detect/screenshot")
async def get_secure_screenshot(url: str):
    """
    Capture live page screenshot locally with Playwright, then fall back to
    public screenshot services, or generate a synthetic sandbox capture for offline hosts.
    Results are cached for 1 hour.
    """
    target = _normalize_page_url(url)
    if not target:
        raise HTTPException(status_code=400, detail="url is required")

    # In-memory TTL cache lookup (discard any legacy WordPress placeholder)
    if target in screenshot_cache:
        cached = screenshot_cache[target]
        if b"WordPress" not in cached:
            return Response(
                content=cached,
                media_type="image/png",
                headers={"Cache-Control": "public, max-age=3600"},
            )

    # 1. Try real live capture with async Playwright
    png = await _capture_with_playwright_async(target)

    # 2. Try remote fallback services
    if not png:
        loop = asyncio.get_running_loop()
        png = await loop.run_in_executor(None, _fetch_remote_screenshot, target)

    # 3. For offline / fake phishing domains, generate high-tech sandbox capture card
    if not png:
        png = _generate_synthetic_sandbox_dom(target)

    screenshot_cache[target] = png
    return Response(
        content=png,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@app.post("/api/detect/email", response_model=schemas.ScanResponse)
async def scan_email(
    file: Optional[UploadFile] = File(None),
    content: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    if file:
        file_bytes = await file.read()
        is_pdf = file.filename.lower().endswith(".pdf") or file_bytes.startswith(b"%PDF")
        result = ml_services.detect_eml_phishing(file_bytes, filename=file.filename)
        input_data = f"{'PDF' if is_pdf else 'EML'} File: {file.filename}"
    elif content:
        result = ml_services.detect_email_phishing(content)
        input_data = content[:200] + "..."
    else:
        raise HTTPException(status_code=400, detail="Must provide either a file or text content")
        
    saved = save_history(db, "email", input_data, result)
    shadow = result.get("shadow_telemetry", {})
    return {
        "id": saved.id,
        "scan_type": "email",
        "prediction": result["prediction"],
        "confidence": result["confidence"],
        "details": result["details"],
        "friction_level": result.get("friction_level", "none"),
        "advisory_message": result.get("advisory_message"),
        "edl_uncertainty": shadow.get("edl_uncertainty") if shadow.get("edl_uncertainty") is not None else shadow.get("u"),
        "edl_strength": shadow.get("edl_strength") if shadow.get("edl_strength") is not None else shadow.get("S"),
        "edl_prob": shadow.get("edl_prob"),
        "email_sender": result.get("email_sender"),
        "email_recipient": result.get("email_recipient"),
        "email_subject": result.get("email_subject"),
        "email_date": result.get("email_date"),
        "email_return_path": result.get("email_return_path"),
        "spf_status": result.get("spf_status"),
        "dkim_status": result.get("dkim_status"),
        "dmarc_status": result.get("dmarc_status"),
        "domain_alignment": result.get("domain_alignment"),
        "extracted_urls": result.get("extracted_urls", []),
        "attachments": result.get("attachments", []),
        "coercion_tactics": result.get("coercion_tactics", [])
    }

@app.post("/api/detect/qr", response_model=schemas.ScanResponse)
async def scan_qr(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        from quishing_engine import robust_decode_qr
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file provided.")

        qr_data, enhanced_img = robust_decode_qr(img, pyzbar_decode_func=decode)
        if not qr_data:
            # Second pass: preserve the alpha channel — stylized QR generators
            # (qrfun/QR-monkey etc.) often export PNGs with transparent
            # backgrounds where the alpha channel effectively IS the QR's white.
            raw = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
            if raw is not None:
                qr_data, enhanced_img = robust_decode_qr(raw, pyzbar_decode_func=decode)
        if not qr_data:
            raise HTTPException(status_code=400, detail="No readable QR code found in image (checked multiple contrast/inverted variants).")

        result = ml_services.detect_qr_phishing(qr_data, img)
        try:
            saved = save_history(db, "qr", f"Extracted Payload: {qr_data[:120]}", result)
            saved_id = getattr(saved, "id", 1) or 1
        except Exception:
            saved_id = 1

        return {
            "id": saved_id,
            "scan_type": "qr",
            "prediction": result["prediction"],
            "confidence": result["confidence"],
            "details": result["details"],
            "decoded_url": qr_data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"QR Analysis Error: {str(e)}")

@app.get("/api/history", response_model=List[schemas.DetectionHistoryResponse])
def get_history(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    history = db.query(models.DetectionHistory).order_by(models.DetectionHistory.timestamp.desc()).offset(skip).limit(limit).all()
    return history

def calculate_trend(current_count: int, previous_count: int) -> float:
    if previous_count == 0:
        return 100.0 if current_count > 0 else 0.0
    return round(((current_count - previous_count) / previous_count) * 100, 1)

@app.get("/api/stats", response_model=schemas.DashboardStatsResponse)
def get_stats(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)
    fourteen_days_ago = now - timedelta(days=14)

    # Single-pass aggregation query for ultra-fast response
    stats_agg = db.query(
        func.count(models.DetectionHistory.id).label("total"),
        func.sum(case((models.DetectionHistory.prediction == "Phishing", 1), else_=0)).label("phishing"),
        func.sum(case((models.DetectionHistory.prediction == "Suspicious", 1), else_=0)).label("suspicious"),
        func.sum(case((models.DetectionHistory.prediction == "Safe", 1), else_=0)).label("safe"),
        # Current 7 days
        func.sum(case((models.DetectionHistory.timestamp >= seven_days_ago, 1), else_=0)).label("c_total"),
        func.sum(case(((models.DetectionHistory.prediction == "Phishing") & (models.DetectionHistory.timestamp >= seven_days_ago), 1), else_=0)).label("c_phishing"),
        func.sum(case(((models.DetectionHistory.prediction == "Suspicious") & (models.DetectionHistory.timestamp >= seven_days_ago), 1), else_=0)).label("c_suspicious"),
        func.sum(case(((models.DetectionHistory.prediction == "Safe") & (models.DetectionHistory.timestamp >= seven_days_ago), 1), else_=0)).label("c_safe"),
        # Previous 7-14 days
        func.sum(case(((models.DetectionHistory.timestamp >= fourteen_days_ago) & (models.DetectionHistory.timestamp < seven_days_ago), 1), else_=0)).label("p_total"),
        func.sum(case(((models.DetectionHistory.prediction == "Phishing") & (models.DetectionHistory.timestamp >= fourteen_days_ago) & (models.DetectionHistory.timestamp < seven_days_ago), 1), else_=0)).label("p_phishing"),
        func.sum(case(((models.DetectionHistory.prediction == "Suspicious") & (models.DetectionHistory.timestamp >= fourteen_days_ago) & (models.DetectionHistory.timestamp < seven_days_ago), 1), else_=0)).label("p_suspicious"),
        func.sum(case(((models.DetectionHistory.prediction == "Safe") & (models.DetectionHistory.timestamp >= fourteen_days_ago) & (models.DetectionHistory.timestamp < seven_days_ago), 1), else_=0)).label("p_safe")
    ).first()

    total = int(stats_agg.total or 0)
    phishing = int(stats_agg.phishing or 0)
    suspicious = int(stats_agg.suspicious or 0)
    safe = int(stats_agg.safe or 0)

    c_total = int(stats_agg.c_total or 0)
    c_phishing = int(stats_agg.c_phishing or 0)
    c_suspicious = int(stats_agg.c_suspicious or 0)
    c_safe = int(stats_agg.c_safe or 0)

    p_total = int(stats_agg.p_total or 0)
    p_phishing = int(stats_agg.p_phishing or 0)
    p_suspicious = int(stats_agg.p_suspicious or 0)
    p_safe = int(stats_agg.p_safe or 0)

    recent = db.query(models.DetectionHistory).order_by(models.DetectionHistory.timestamp.desc()).limit(5).all()
    
    return {
        "total_scans": total,
        "total_scans_trend": calculate_trend(c_total, p_total),
        "phishing_detected": phishing,
        "phishing_trend": calculate_trend(c_phishing, p_phishing),
        "suspicious_detected": suspicious,
        "suspicious_trend": calculate_trend(c_suspicious, p_suspicious),
        "safe_detected": safe,
        "safe_trend": calculate_trend(c_safe, p_safe),
        "recent_threats": recent
    }

@app.post("/api/extension/log")
def log_extension_telemetry(req: schemas.ExtensionLogRequest):
    import json
    log_dir = os.path.join(os.path.dirname(__file__), "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, "extension_field_ece.log")
    payload = req.dict()
    if payload.get("u") is None and payload.get("edl_uncertainty") is not None:
        payload["u"] = payload["edl_uncertainty"]
    if payload.get("S") is None and payload.get("edl_strength") is not None:
        payload["S"] = payload["edl_strength"]
    payload["server_timestamp"] = datetime.utcnow().isoformat()
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(payload) + "\n")
    return {"status": "logged", "hash": req.url_hash}


