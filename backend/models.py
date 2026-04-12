"""
SQLAlchemy ORM models for SafeRoute.
Covers: Users, Incidents, EmergencyContacts, AlertHistory, SOSEvents.
"""
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, JSON,
    ForeignKey, Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum

from database import Base


# ── Enums ───────────────────────────────────────────────────────
class CrimeType(str, enum.Enum):
    theft = "theft"
    assault = "assault"
    harassment = "harassment"
    vandalism = "vandalism"
    suspicious = "suspicious"
    other = "other"


class Severity(str, enum.Enum):
    minor = "minor"
    moderate = "moderate"
    serious = "serious"


class IncidentStatus(str, enum.Enum):
    submitted = "submitted"
    verified = "verified"
    investigating = "investigating"
    resolved = "resolved"
    dismissed = "dismissed"


class AlertAction(str, enum.Enum):
    viewed = "viewed"
    dismissed = "dismissed"
    rerouted = "rerouted"
    ignored = "ignored"


# ── Users ───────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(256), unique=True, nullable=False, index=True)
    password = Column(String(256), nullable=False)

    # Profile fields  (FR-MA-001)
    phone = Column(String(20), nullable=True)
    gender = Column(String(32), nullable=True)       # male, female, other, prefer_not_to_say
    age_range = Column(String(16), nullable=True)     # 18-24, 25-34, ...

    # Preferences
    location_sharing = Column(String(16), default="while_using")  # always / while_using / never
    alert_threshold = Column(Integer, default=60)     # 0-100
    notification_prefs = Column(JSON, default=lambda: {
        "push": True, "email": True,
        "dnd_start": "23:00", "dnd_end": "07:00",
    })

    # Women Safety Mode
    women_safety_enabled = Column(Boolean, default=False)
    women_safety_auto_hours = Column(JSON, default=lambda: {"start": "22:00", "end": "06:00"})

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    incidents = relationship("Incident", back_populates="user", cascade="all, delete-orphan")
    emergency_contacts = relationship("EmergencyContact", back_populates="user", cascade="all, delete-orphan")
    alert_history = relationship("AlertHistory", back_populates="user", cascade="all, delete-orphan")
    sos_events = relationship("SOSEvent", back_populates="user", cascade="all, delete-orphan")


# ── Incidents ───────────────────────────────────────────────────
class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    reference_number = Column(String(20), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # nullable for anonymous
    crime_type = Column(SAEnum(CrimeType), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    occurred_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    description = Column(Text, nullable=True)
    severity = Column(SAEnum(Severity), default=Severity.moderate)
    is_anonymous = Column(Boolean, default=False)
    status = Column(SAEnum(IncidentStatus), default=IncidentStatus.submitted)
    location_name = Column(String(256), nullable=True)  # human-readable location

    # Photo attachments (up to 3 filenames stored as JSON list)
    photos = Column(JSON, default=list)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="incidents")


# ── Emergency Contacts ──────────────────────────────────────────
class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(128), nullable=False)
    phone = Column(String(20), nullable=False)
    relation = Column(String(64), nullable=True)  # named 'relation' to avoid shadowing SQLAlchemy relationship()

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="emergency_contacts")


# ── Alert History ───────────────────────────────────────────────
class AlertHistory(Base):
    __tablename__ = "alert_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    risk_score = Column(Integer, nullable=False)
    risk_level = Column(String(16), nullable=False)
    action_taken = Column(SAEnum(AlertAction), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="alert_history")


# ── SOS Events ──────────────────────────────────────────────────
class SOSEvent(Base):
    __tablename__ = "sos_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    triggered_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    contacts_notified = Column(JSON, default=list)

    user = relationship("User", back_populates="sos_events")