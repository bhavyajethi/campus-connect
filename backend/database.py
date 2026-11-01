import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from dotenv import load_dotenv

# Load local .env file if present
load_dotenv()

# 1. Fetch DATABASE_URL from environment variables
DATABASE_URL = os.getenv("DATABASE_URL")

# 2. Check if variable exists and fix postgres:// prefix for SQLAlchemy 1.4+ / 2.0+
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# 3. Raise clear error if missing on Render
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is missing on Render!")

# 4. Initialize SQLAlchemy Engine
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()