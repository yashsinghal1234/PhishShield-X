from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from datetime import datetime
from database import Base

class DetectionHistory(Base):
    __tablename__ = "detection_history"

    id = Column(Integer, primary_key=True, index=True)
    scan_type = Column(String, index=True) # url, email, qr
    input_data = Column(Text) # the url, email snippet, or qr decoded content
    prediction = Column(String, index=True) # Safe or Phishing
    confidence = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    details = Column(Text, nullable=True) # for XAI explanations later

class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    email = Column(String, index=True)
    message = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    status = Column(String, default="received")

