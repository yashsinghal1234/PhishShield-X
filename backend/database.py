from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# --- DATABASE CONFIGURATION ---
# To use PostgreSQL, uncomment the PostgreSQL URL and update your credentials:
# SQLALCHEMY_DATABASE_URL = "postgresql://username:password@localhost/phishshield"

# Defaulting to SQLite for now until you update your credentials
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./phishshield.db")

# For SQLite, we need connect_args={"check_same_thread": False}. For Postgres, we don't.
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
