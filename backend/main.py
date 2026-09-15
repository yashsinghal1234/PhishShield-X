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

app = FastAPI(title="PhishShield-X API", version="0.1.0")

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
    history_entry = models.DetectionHistory(
        scan_type=scan_type,
        input_data=input_data,
        prediction=result["prediction"],
        confidence=result["confidence"],
        details=result["details"]
    )
    db.add(history_entry)
    db.commit()
    db.refresh(history_entry)
    return history_entry

@app.api_route("/", methods=["GET", "HEAD"])
def read_root():
    return {"message": "Welcome to PhishShield-X API", "status": "healthy"}

@app.api_route("/health", methods=["GET", "HEAD"])
def health_check():
    return {"status": "ok"}

@app.post("/api/detect/url", response_model=schemas.ScanResponse)
def scan_url(request: schemas.URLScanRequest, db: Session = Depends(get_db)):
    result = ml_services.detect_url_phishing(request.url)
    osint_data = ml_services.get_osint_data(request.url)
    
    saved = save_history(db, "url", request.url, result)
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
        "certificate_details": osint_data.get("certificate_details")
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


def _capture_with_playwright(target: str):
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            try:
                page = browser.new_page(
                    viewport={"width": 1280, "height": 800},
                    ignore_https_errors=True,
                )
                page.goto(target, wait_until="domcontentloaded", timeout=20000)
                page.wait_for_timeout(1200)
                return page.screenshot(type="png")
            finally:
                browser.close()
    except Exception as e:
        print(f"Playwright screenshot error: {e}")
        return None


def _fetch_remote_screenshot(target: str):
    import urllib.parse

    scrapfly_key = os.environ.get("SCRAPFLY_API_KEY")
    scrapingbee_key = os.environ.get("SCRAPINGBEE_API_KEY")
    encoded_url = urllib.parse.quote(target, safe="")

    candidates = []
    if scrapfly_key:
        candidates.append(f"https://api.scrapfly.io/screenshot?key={scrapfly_key}&url={encoded_url}&format=png")
    if scrapingbee_key:
        candidates.append(
            f"https://app.scrapingbee.com/api/v1/?api_key={scrapingbee_key}&url={encoded_url}&screenshot=true"
        )
    candidates.extend([
        f"https://image.thum.io/get/width/1280/noanimate/{target}",
        f"https://s0.wordpress.com/mshots/v1/{encoded_url}?w=1280",
    ])

    for candidate in candidates:
        try:
            resp = requests.get(candidate, timeout=20, allow_redirects=True)
            if _is_image_response(resp):
                return resp.content
        except Exception as e:
            print(f"Screenshot API error ({candidate}): {e}")
    return None


@app.get("/api/detect/screenshot")
async def get_secure_screenshot(url: str):
    """
    Capture a live page screenshot locally with Playwright, then fall back to
    optional paid APIs and public screenshot services.
    """
    target = _normalize_page_url(url)
    if not target:
        raise HTTPException(status_code=400, detail="url is required")

    loop = asyncio.get_running_loop()
    png = await loop.run_in_executor(None, _capture_with_playwright, target)
    if not png:
        png = await loop.run_in_executor(None, _fetch_remote_screenshot, target)

    if not png:
        raise HTTPException(status_code=502, detail="Screenshot unavailable")

    return Response(
        content=png,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=300"},
    )


@app.post("/api/detect/email", response_model=schemas.ScanResponse)
async def scan_email(
    file: Optional[UploadFile] = File(None),
    content: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    if file:
        file_bytes = await file.read()
        result = ml_services.detect_eml_phishing(file_bytes)
        input_data = f"EML File: {file.filename}"
    elif content:
        result = ml_services.detect_email_phishing(content)
        input_data = content[:200] + "..."
    else:
        raise HTTPException(status_code=400, detail="Must provide either a file or text content")
        
    saved = save_history(db, "email", input_data, result)
    return {
        "id": saved.id,
        "scan_type": "email",
        "prediction": result["prediction"],
        "confidence": result["confidence"],
        "details": result["details"]
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
            raise HTTPException(status_code=400, detail="No readable QR code found in image (checked multiple contrast/inverted variants).")

        result = ml_services.detect_qr_phishing(qr_data, img)
        saved = save_history(db, "qr", f"Extracted Payload: {qr_data[:120]}", result)

        return {
            "id": saved.id,
            "scan_type": "qr",
            "prediction": result["prediction"],
            "confidence": result["confidence"],
            "details": result["details"]
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

    total = db.query(models.DetectionHistory).count()
    phishing = db.query(models.DetectionHistory).filter(models.DetectionHistory.prediction == "Phishing").count()
    suspicious = db.query(models.DetectionHistory).filter(models.DetectionHistory.prediction == "Suspicious").count()
    safe = db.query(models.DetectionHistory).filter(models.DetectionHistory.prediction == "Safe").count()
    
    # Current week
    c_total = db.query(models.DetectionHistory).filter(models.DetectionHistory.timestamp >= seven_days_ago).count()
    c_phishing = db.query(models.DetectionHistory).filter(models.DetectionHistory.prediction == "Phishing", models.DetectionHistory.timestamp >= seven_days_ago).count()
    c_suspicious = db.query(models.DetectionHistory).filter(models.DetectionHistory.prediction == "Suspicious", models.DetectionHistory.timestamp >= seven_days_ago).count()
    c_safe = db.query(models.DetectionHistory).filter(models.DetectionHistory.prediction == "Safe", models.DetectionHistory.timestamp >= seven_days_ago).count()

    # Previous week
    p_total = db.query(models.DetectionHistory).filter(models.DetectionHistory.timestamp >= fourteen_days_ago, models.DetectionHistory.timestamp < seven_days_ago).count()
    p_phishing = db.query(models.DetectionHistory).filter(models.DetectionHistory.prediction == "Phishing", models.DetectionHistory.timestamp >= fourteen_days_ago, models.DetectionHistory.timestamp < seven_days_ago).count()
    p_suspicious = db.query(models.DetectionHistory).filter(models.DetectionHistory.prediction == "Suspicious", models.DetectionHistory.timestamp >= fourteen_days_ago, models.DetectionHistory.timestamp < seven_days_ago).count()
    p_safe = db.query(models.DetectionHistory).filter(models.DetectionHistory.prediction == "Safe", models.DetectionHistory.timestamp >= fourteen_days_ago, models.DetectionHistory.timestamp < seven_days_ago).count()

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
