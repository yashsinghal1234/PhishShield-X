from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class URLScanRequest(BaseModel):
    url: str

class EmailScanRequest(BaseModel):
    content: str

class ScanResponse(BaseModel):
    id: Optional[int] = None
    scan_type: str
    prediction: str
    confidence: float
    details: Optional[str] = None

class DetectionHistoryResponse(BaseModel):
    id: int
    scan_type: str
    input_data: str
    prediction: str
    confidence: float
    timestamp: datetime
    details: Optional[str] = None

    class Config:
        from_attributes = True

class DashboardStatsResponse(BaseModel):
    total_scans: int
    phishing_detected: int
    suspicious_detected: int
    safe_detected: int
    recent_threats: List[DetectionHistoryResponse]
