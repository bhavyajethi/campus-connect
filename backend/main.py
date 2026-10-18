from fastapi import FastAPI, Depends, status, HTTPException 
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from uuid import UUID
import schemas
import qrcode
import io
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from database import get_db
from typing import List
from datetime import date
import auth

# Import our database engine and models
from database import engine
import models

# MAGIC HAPPENS HERE: 
# This line tells SQLAlchemy to look at all the classes in models.py 
# and automatically create the corresponding tables in Neon PostgreSQL if they don't exist yet.
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

@app.on_event("startup")
def seed_admin_account():
    auth.ensure_admin_account()

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
        role=models.RoleEnum.student,
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
        
    role = user.role.value if isinstance(user.role, models.RoleEnum) else user.role
    access_token = auth.create_access_token(data={
        "sub": str(user.id),
        "role": role,
        "name": user.name,
        "email": user.email,
    })
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": role,
    }

@app.post("/events/", response_model=schemas.EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    event: schemas.EventCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    role = current_user.role.value if isinstance(current_user.role, models.RoleEnum) else current_user.role
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required to create events")

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
def get_events(
    skip: int = 0,
    limit: int = 100,
    include_past: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(models.Event)
    if not include_past:
        query = query.filter(models.Event.date >= date.today())
    return query.order_by(models.Event.date.asc()).offset(skip).limit(limit).all()

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
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=400, detail="User is already registered for this event") from error
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
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=400, detail="User already registered for this event") from error
    db.refresh(new_reg)
    return new_reg

@app.get("/registrations/my-ticket/{event_id}", response_model=schemas.RegistrationResponse)
def get_my_ticket(
    event_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    registration = db.query(models.Registration).filter(
        models.Registration.user_id == current_user.id,
        models.Registration.event_id == event_id
    ).first()
    if not registration:
        raise HTTPException(status_code=404, detail="No registration found for this event")
    return registration

@app.get("/registrations/me", response_model=List[schemas.RegistrationWithEvent])
def get_my_registrations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    registrations = (
        db.query(models.Registration, models.Event)
        .join(models.Event, models.Registration.event_id == models.Event.id)
        .filter(models.Registration.user_id == current_user.id)
        .order_by(models.Event.date.desc(), models.Registration.id.desc())
        .all()
    )
    return [
        {
            "id": registration.id,
            "user_id": registration.user_id,
            "event_id": registration.event_id,
            "status": registration.status.value,
            "is_verified": registration.is_verified,
            "event_name": event.name,
            "event_date": event.date,
        }
        for registration, event in registrations
    ]


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
def create_verification(verification: schemas.VerificationRequest, db: Session = Depends(get_db)):
    return verify_registration(verification.ticket_id, db)

@app.post("/registrations/{ticket_id}/verify", response_model=schemas.VerificationResponse)
def verify_registration_by_ticket_id(ticket_id: UUID, db: Session = Depends(get_db)):
    return verify_registration(ticket_id, db)

def verify_registration(ticket_id: UUID, db: Session):
    registration = db.query(models.Registration).filter(
        models.Registration.id == ticket_id
    ).with_for_update().first()
    if not registration:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if registration.is_verified:
        raise HTTPException(status_code=400, detail="Ticket already verified")

    registration.is_verified = True
    registration.status = models.StatusEnum.attended
    db.commit()
    db.refresh(registration)

    return {
        "message":"Checked In - User Validated",
        "ticket_id":registration.id,
        "user_id":registration.user_id,
        "status":"checked_in",
        "is_verified":registration.is_verified
    }
