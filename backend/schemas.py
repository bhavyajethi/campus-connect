from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Literal, Optional
from uuid import UUID
from datetime import date

# --- User Schemas (From Step 5) ---
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    role: Literal["student"] = "student"
    year: Optional[int] = None
    password: str

class UserResponse(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    role: str
    year: Optional[int]

    model_config = ConfigDict(from_attributes=True)

# --- NEW: Event Schemas ---

# Input Schema: What the organizer sends when creating an event
class EventCreate(BaseModel):
    name: str
    date: date
    description: Optional[str] = None
    category: Literal["Tech", "Cultural", "Sports"] = "Tech"
    venue: str = "Campus venue"
    capacity: int = Field(default=100, ge=1)

# Output Schema: What the API sends back (includes the generated ID)
class EventResponse(BaseModel):
    id: UUID
    name: str
    date: date
    description: Optional[str] = None
    category: str = "Tech"
    venue: str = "Campus venue"
    capacity: int = 100
    current_registrations: int = 0
    seats_remaining: int = 100

    model_config = ConfigDict(from_attributes=True)
        
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
    is_verified: bool

    model_config = ConfigDict(from_attributes=True)

class RegistrationWithEvent(RegistrationResponse):
    event_name: str
    event_date: date
    event_venue: str = "Campus venue"

class EventRegistrationBreakdown(BaseModel):
    event_id: UUID
    event_name: str
    event_date: date
    registered_count: int
    verified_count: int
    capacity: int

class AdminStats(BaseModel):
    total_users: int
    total_tickets: int
    verified_checkins: int
    checkin_percentage: float
    registrations_per_event: list[EventRegistrationBreakdown]

# Input schema for the legacy verification route.
class VerificationRequest(BaseModel):
    ticket_id: UUID

# Output schema for ticket check-in.
class VerificationResponse(BaseModel):
    message: str
    ticket_id: UUID
    user_id: UUID
    status: str
    is_verified: bool

    model_config = ConfigDict(from_attributes=True)

# Authentication Schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: UUID
    name: str
    email: EmailStr
    role: str

class TokenData(BaseModel):
    user_id: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str
