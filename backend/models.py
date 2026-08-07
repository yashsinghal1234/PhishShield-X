from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from datetime import datetime
from database import Base

class DetectionHistory(Base):
    __tablename__ = "detection_history"

    id = Column(Integer, primary_key=True, index=True)
    scan_type = Column(String, index=True) # url, email, qr
    input_data = Column(Text) # the url, email snippet, or qr decoded content
    prediction = Column(String) # Safe or Phishing
    confidence = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)
    details = Column(Text, nullable=True) # for XAI explanations later
