from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.responses import Response, RedirectResponse
import os
import requests
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import cv2
import numpy as np
from pyzbar.pyzbar import decode
from PIL import Image
import io
from datetime import datetime, timedelta

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

@app.get("/")
def read_root():
    return {"message": "Welcome to PhishShield-X API"}

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
        "ip_address": osint_data.get("ip_address"),
        "location": osint_data.get("location"),
        "asn": osint_data.get("asn"),
        "hosting_provider": osint_data.get("hosting_provider"),
        "tld": osint_data.get("tld"),
        "screenshot_url": osint_data.get("screenshot_url"),
        "brand": osint_data.get("brand"),
        "certificate_details": osint_data.get("certificate_details")
    }

@app.get("/api/detect/screenshot")
def get_secure_screenshot(url: str):
    """
    Secure proxy endpoint to fetch screenshots without exposing API keys to the frontend.
    Tries Scrapfly -> ScrapingBee -> MShots Fallback
    """
    scrapfly_key = os.environ.get("SCRAPFLY_API_KEY")
    scrapingbee_key = os.environ.get("SCRAPINGBEE_API_KEY")
    
    try:
        # Try Scrapfly
        if scrapfly_key:
            scrapfly_url = f"https://api.scrapfly.io/screenshot?key={scrapfly_key}&url={url}&format=png"
            resp = requests.get(scrapfly_url, timeout=15)
            if resp.status_code == 200:
                return Response(content=resp.content, media_type="image/png")
                
        # Try ScrapingBee
        if scrapingbee_key:
            scrapingbee_url = f"https://app.scrapingbee.com/api/v1/?api_key={scrapingbee_key}&url={url}&screenshot=true"
            resp = requests.get(scrapingbee_url, timeout=15)
            if resp.status_code == 200:
                return Response(content=resp.content, media_type="image/png")
    except Exception as e:
        print(f"Screenshot API error: {e}")
        
    # Fallback to free Thum.io
    import urllib.parse
    encoded_url = urllib.parse.quote(url, safe='')
    return RedirectResponse(url=f"https://image.thum.io/get/width/1024/crop/800/{url}")

from fastapi import Form
from typing import Optional

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
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        decoded_objects = decode(img)
        if not decoded_objects:
            raise HTTPException(status_code=400, detail="No QR code found in image")
        
        qr_data = decoded_objects[0].data.decode('utf-8')
        result = ml_services.detect_qr_phishing(qr_data, img)
        saved = save_history(db, "qr", f"Extracted URL: {qr_data}", result)
        
        return {
            "id": saved.id,
            "scan_type": "qr",
            "prediction": result["prediction"],
            "confidence": result["confidence"],
            "details": result["details"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
