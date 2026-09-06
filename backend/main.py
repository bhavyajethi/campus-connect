from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
import schemas
from sqlalchemy.orm import Session
from database import get_db
from typing import List

# Import our database engine and models
from database import engine
import models

# MAGIC HAPPENS HERE: 
# This line tells SQLAlchemy to look at all the classes in models.py 
# and automatically create the corresponding tables in Neon PostgreSQL if they don't exist yet.
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/status")
async def check_status():
    return {"message": "Hello from FastAPI! The connection is successful.", "status": "ok"}

@app.post("/events/", response_model=schemas.EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(event: schemas.EventCreate, db: Session = Depends(get_db)):
    # 1. Convert Pydantic schema to SQLAlchemy database model
    new_event = models.Event(
        name=event.name,
        date=event.date,
        description=event.description
    )
    
    # 2. Save to database
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    
    # 3. Return the created event
    return new_event

# STEP 6: Event Listing Endpoint (GET)
@app.get("/events/", response_model=List[schemas.EventResponse])
def get_events(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    # Fetch a list of events from the database
    events = db.query(models.Event).offset(skip).limit(limit).all()
    return events