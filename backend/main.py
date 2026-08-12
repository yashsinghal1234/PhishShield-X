from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import cv2
import numpy as np
from pyzbar.pyzbar import decode
from PIL import Image
import io

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
    saved = save_history(db, "url", request.url, result)
    return {
        "id": saved.id,
        "scan_type": "url",
        "prediction": result["prediction"],
        "confidence": result["confidence"],
        "details": result["details"]
    }

@app.post("/api/detect/email", response_model=schemas.ScanResponse)
def scan_email(request: schemas.EmailScanRequest, db: Session = Depends(get_db)):
    result = ml_services.detect_email_phishing(request.content)
    saved = save_history(db, "email", request.content[:200] + "...", result) # Save snippet
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

@app.get("/api/stats", response_model=schemas.DashboardStatsResponse)
def get_stats(db: Session = Depends(get_db)):
    total = db.query(models.DetectionHistory).count()
    phishing = db.query(models.DetectionHistory).filter(models.DetectionHistory.prediction == "Phishing").count()
    suspicious = db.query(models.DetectionHistory).filter(models.DetectionHistory.prediction == "Suspicious").count()
    safe = db.query(models.DetectionHistory).filter(models.DetectionHistory.prediction == "Safe").count()
    recent = db.query(models.DetectionHistory).order_by(models.DetectionHistory.timestamp.desc()).limit(5).all()
    
    return {
        "total_scans": total,
        "phishing_detected": phishing,
        "suspicious_detected": suspicious,
        "safe_detected": safe,
        "recent_threats": recent
    }
