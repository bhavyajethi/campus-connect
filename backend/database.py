import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from dotenv import load_dotenv

# Load environment variables from the .env file
load_dotenv()

# Get the database URL from the environment variables
# If it can't find it, it defaults to a local sqlite database (just in case)
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# The Engine is the core interface to the database.
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# A SessionLocal class. Each instance of this class will be an actual database session.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for our database models (we will use this in the next step to create tables)
Base = declarative_base()

# Dependency to get the database session in our FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()