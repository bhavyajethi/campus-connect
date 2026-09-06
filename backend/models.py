import uuid
import enum
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum, Date
from sqlalchemy.dialects.postgresql import UUID
from database import Base

# --- Enums for Data Validation ---
class RoleEnum(enum.Enum):
    organizer = "organizer"
    volunteer = "volunteer"
    student = "student"

class StatusEnum(enum.Enum):
    registered = "registered"
    attended = "attended"

# --- Database Tables ---
class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.student, nullable=False)
    year = Column(Integer, nullable=True) # Year is optional (volunteers/organizers might not need it)

class Event(Base):
  __tablename__ = "events"

  id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  name = Column(String, nullable=False)
  date = Column(Date, nullable=False)
  description = Column(
      String, nullable=True
  )

class Registration(Base):
    __tablename__ = "registrations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False)
    
    # This is the secret code that will be embedded in the QR Code!
    ticket_uuid = Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4, index=True)
    status = Column(Enum(StatusEnum), default=StatusEnum.registered, nullable=False)