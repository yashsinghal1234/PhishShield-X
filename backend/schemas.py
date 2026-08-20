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
    ip_address: Optional[str] = None
    location: Optional[str] = None
    asn: Optional[str] = None
    hosting_provider: Optional[str] = None
    tld: Optional[str] = None
    screenshot_url: Optional[str] = None
    brand: Optional[str] = None
    certificate_details: Optional[str] = None

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
    total_scans_trend: float
    phishing_detected: int
    phishing_trend: float
    suspicious_detected: int
    suspicious_trend: float
    safe_detected: int
    safe_trend: float
    recent_threats: List[DetectionHistoryResponse]
