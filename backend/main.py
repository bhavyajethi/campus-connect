from fastapi import FastAPI, Depends, status, HTTPException 
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from uuid import UUID
import schemas
import qrcode
import io
from sqlalchemy.orm import Session
from database import get_db
from typing import List
from datetime import date
from backend import auth

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

@app.post("/users/", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_pwd = auth.hash_password(user.password)
    new_user = models.User(
        name=user.name,
        email=user.email,
        role=user.role,
        year=user.year,
        password_hash=hashed_pwd
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# Login Route returning JWT Token
@app.post("/login", response_model=schemas.Token)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not auth.verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")
        
    access_token = auth.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

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
    events = (
        db.query(models.Event)
        .filter(models.Event.date >= date.today())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return events

@app.post("/registrations/", response_model=schemas.RegistrationResponse, status_code=status.HTTP_201_CREATED)
def create_registration(reg: schemas.RegistrationCreate, db: Session = Depends(get_db)):
    # 1. Verify User exists
    user = db.query(models.User).filter(models.User.id == reg.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # 2. Verify Event exists
    event = db.query(models.Event).filter(models.Event.id == reg.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    # 3. Prevent Double Booking
    existing_reg = db.query(models.Registration).filter(
        models.Registration.user_id == reg.user_id,
        models.Registration.event_id == reg.event_id
    ).first()
    if existing_reg:
        raise HTTPException(status_code=400, detail="User is already registered for this event")
        
    # 4. Save Registration to Database
    new_reg = models.Registration(
        user_id=reg.user_id,
        event_id=reg.event_id,
        status="registered"
    )
    db.add(new_reg)
    db.commit()
    db.refresh(new_reg)
    
    return new_reg

@app.post("/registrations/authenticated/", response_model=schemas.RegistrationResponse)
def create_registration_authenticated(
    event_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Verify event exists
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    # Check duplicate registration using current_user.id
    existing_reg = db.query(models.Registration).filter(
        models.Registration.user_id == current_user.id,
        models.Registration.event_id == event_id
    ).first()
    if existing_reg:
        raise HTTPException(status_code=400, detail="User already registered for this event")
        
    new_reg = models.Registration(user_id=current_user.id, event_id=event_id)
    db.add(new_reg)
    db.commit()
    db.refresh(new_reg)
    return new_reg


# STEP 7: Generate Live QR Code Image Endpoint
@app.get("/registrations/{ticket_id}/qr")
def get_qr_code(ticket_id: UUID):
    # 1. The data we want hidden inside the QR code
    qr_data = f"{str(ticket_id)}"
    
    # 2. Generate the QR Code image in memory
    img = qrcode.make(qr_data)
    
    # 3. Save it to a virtual bytes buffer (so we don't clog the hard drive)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0) # Reset buffer pointer to the start
    
    # 4. Stream the image directly to the browser
    return StreamingResponse(buf, media_type="image/png")

# STEP 8: Admin Ticket Verification (Scanner API)
@app.post("/verifications/", response_model=schemas.VerificationResponse, status_code=status.HTTP_201_CREATED)
def create_verification(verification: schemas.VerificationResponse, db: Session = Depends(get_db)):
    # 1) Verify the ticket in the database
    registration = db.query(models.Registration).filter(models.Registration.id == verification.ticket_id).first()
    
    if not registration:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # 2. Check if the ticket has already been used
    if registration.status == "attended":
        raise HTTPException(status_code=400, detail="Ticket has already been used")

    # 3) Update the registration status to "attended"
    registration.status = "attended"
    db.commit()
    db.refresh(registration)    

    return {
        "message":"Registration Successful",
        "ticket_id":registration.id,
        "user_id":registration.user_id,
        "status":registration.status
    }