from fastapi import FastAPI, Depends, status, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.responses import Response
from uuid import UUID
import os
import smtplib
import schemas
import qrcode
import io
import csv
from io import StringIO
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.exc import IntegrityError
from sqlalchemy import case, func
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

def send_event_notification(action_type: str, event_name: str, user_email: str):
    print(f"[EMAIL NOTIFICATION] Action: {action_type} | Event: {event_name} | Target: {user_email}")
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587") or "587")
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    if not smtp_host or not smtp_user or not smtp_password:
        return

    sender = os.getenv("SMTP_FROM", "noreply@campusconnect.local")
    msg = MIMEMultipart()
    msg["From"] = sender
    msg["To"] = user_email
    msg["Subject"] = f"Campus Connect Event Notification: {action_type}"
    body = f"Action: {action_type}\nEvent: {event_name}\nTarget: {user_email}"
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
    except Exception as exc:
        print(f"[EMAIL ERROR] Failed to send notification: {exc}")

@app.on_event("startup")
def seed_admin_account():
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "ALTER TABLE events "
            "ADD COLUMN IF NOT EXISTS category VARCHAR NOT NULL DEFAULT 'Tech', "
            "ADD COLUMN IF NOT EXISTS venue VARCHAR NOT NULL DEFAULT 'Campus venue', "
            "ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 100"
        )
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
    background_tasks: BackgroundTasks,
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
        description=event.description,
        category=event.category,
        venue=event.venue,
        capacity=event.capacity,
    )
    
    # 2. Save to database
    db.add(new_event)
    db.commit()
    db.refresh(new_event)

    background_tasks.add_task(send_event_notification, "CREATED", event.name, current_user.email)

    return {
        "id": new_event.id,
        "name": new_event.name,
        "date": new_event.date,
        "description": new_event.description,
        "category": new_event.category,
        "venue": new_event.venue,
        "capacity": new_event.capacity,
        "current_registrations": 0,
        "seats_remaining": new_event.capacity,
    }

@app.delete("/events/{event_id}")
def delete_event(
    event_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    role = current_user.role.value if isinstance(current_user.role, models.RoleEnum) else current_user.role
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    registrations = db.query(models.Registration).filter(models.Registration.event_id == event_id).all()
    for registration in registrations:
        user = db.query(models.User).filter(models.User.id == registration.user_id).first()
        if user and user.email:
            background_tasks.add_task(send_event_notification, "CANCELLED", event.name, user.email)

    db.delete(event)
    db.commit()
    return {"detail": "Event deleted successfully"}

# STEP 6: Event Listing Endpoint (GET)
@app.get("/events/", response_model=List[schemas.EventResponse])
def get_events(
    skip: int = 0,
    limit: int = 100,
    include_past: bool = False,
    db: Session = Depends(get_db)
):
    registration_counts = (
        db.query(
            models.Registration.event_id.label("event_id"),
            func.count(models.Registration.id).label("current_registrations"),
        )
        .group_by(models.Registration.event_id)
        .subquery()
    )
    query = db.query(
        models.Event,
        func.coalesce(registration_counts.c.current_registrations, 0).label("current_registrations"),
    ).outerjoin(registration_counts, registration_counts.c.event_id == models.Event.id)
    if not include_past:
        query = query.filter(models.Event.date >= date.today())
    rows = query.order_by(models.Event.date.asc()).offset(skip).limit(limit).all()
    return [
        {
            "id": event.id,
            "name": event.name,
            "date": event.date,
            "description": event.description,
            "category": event.category,
            "venue": event.venue,
            "capacity": event.capacity,
            "current_registrations": count,
            "seats_remaining": max(event.capacity - count, 0),
        }
        for event, count in rows
    ]

@app.post("/registrations/", response_model=schemas.RegistrationResponse, status_code=status.HTTP_201_CREATED)
def create_registration(reg: schemas.RegistrationCreate, db: Session = Depends(get_db)):
    # 1. Verify User exists
    user = db.query(models.User).filter(models.User.id == reg.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # 2. Verify Event exists
    event = db.query(models.Event).filter(models.Event.id == reg.event_id).with_for_update().first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    # 3. Prevent Double Booking
    existing_reg = db.query(models.Registration).filter(
        models.Registration.user_id == reg.user_id,
        models.Registration.event_id == reg.event_id
    ).first()
    if existing_reg:
        raise HTTPException(status_code=400, detail="User is already registered for this event")

    current_registrations = db.query(func.count(models.Registration.id)).filter(
        models.Registration.event_id == reg.event_id
    ).scalar()
    if current_registrations >= event.capacity:
        raise HTTPException(status_code=400, detail="Event Sold Out")
        
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
    event = db.query(models.Event).filter(models.Event.id == event_id).with_for_update().first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    # Check duplicate registration using current_user.id
    existing_reg = db.query(models.Registration).filter(
        models.Registration.user_id == current_user.id,
        models.Registration.event_id == event_id
    ).first()
    if existing_reg:
        raise HTTPException(status_code=400, detail="User already registered for this event")

    current_registrations = db.query(func.count(models.Registration.id)).filter(
        models.Registration.event_id == event_id
    ).scalar()
    if current_registrations >= event.capacity:
        raise HTTPException(status_code=400, detail="Event Sold Out")
        
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
            "event_venue": event.venue,
        }
        for registration, event in registrations
    ]

def require_admin(current_user: models.User) -> None:
    role = current_user.role.value if isinstance(current_user.role, models.RoleEnum) else current_user.role
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

@app.get("/admin/stats", response_model=schemas.AdminStats)
def get_admin_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    require_admin(current_user)
    total_users = db.query(func.count(models.User.id)).scalar() or 0
    total_tickets = db.query(func.count(models.Registration.id)).scalar() or 0
    verified_checkins = db.query(func.count(models.Registration.id)).filter(
        models.Registration.is_verified.is_(True)
    ).scalar() or 0
    breakdown_rows = (
        db.query(
            models.Event,
            func.count(models.Registration.id).label("registered_count"),
            func.coalesce(
                func.sum(case((models.Registration.is_verified.is_(True), 1), else_=0)),
                0,
            ).label("verified_count"),
        )
        .outerjoin(models.Registration, models.Registration.event_id == models.Event.id)
        .group_by(models.Event.id)
        .order_by(models.Event.date.desc())
        .all()
    )
    return {
        "total_users": total_users,
        "total_tickets": total_tickets,
        "verified_checkins": verified_checkins,
        "checkin_percentage": round(verified_checkins / total_tickets * 100, 1) if total_tickets else 0.0,
        "registrations_per_event": [
            {
                "event_id": event.id,
                "event_name": event.name,
                "event_date": event.date,
                "registered_count": registered_count,
                "verified_count": verified_count,
                "capacity": event.capacity,
            }
            for event, registered_count, verified_count in breakdown_rows
        ],
    }

@app.get("/admin/attendees.csv")
def export_admin_attendees(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    require_admin(current_user)
    rows = (
        db.query(models.Event.name, models.Event.date, models.User.name, models.User.email, models.Registration.is_verified)
        .join(models.Registration, models.Registration.event_id == models.Event.id)
        .join(models.User, models.User.id == models.Registration.user_id)
        .order_by(models.Event.date, models.Event.name, models.User.name)
        .all()
    )
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["event_name", "event_date", "attendee_name", "attendee_email", "checked_in"])
    writer.writerows(rows)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=campus-connect-attendees.csv"},
    )


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
