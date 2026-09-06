from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID
from datetime import date

# --- User Schemas (From Step 5) ---
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    role: str = "student"
    year: Optional[int] = None

class UserResponse(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    role: str
    year: Optional[int]

    class Config:
        from_attributes = True

# --- NEW: Event Schemas ---

# Input Schema: What the organizer sends when creating an event
class EventCreate(BaseModel):
    name: str
    date: date
    description: Optional[str] = None

# Output Schema: What the API sends back (includes the generated ID)
class EventResponse(BaseModel):
    id: UUID
    name: str
    date: date
    description: Optional[str] = None

    class Config:
        from_attributes = True
        
# Input Event : Registration schema for creating a new registration per user
class RegistrationCreate(BaseModel):
    user_id : UUID
    event_id : UUID
# Output Event : Registration schema for returning registration details
class RegistrationResponse(BaseModel):  
    id : UUID
    user_id : UUID
    event_id : UUID
    status: str

    class Config:
        from_attributes = True

# Output Event : Verification schema for returning verification details
# Output Schema: What the scanner sees when verifying a ticket
class VerificationResponse(BaseModel):
    message: str
    ticket_id: UUID
    user_id: UUID
    status: str

    class Config:
        from_attributes = True