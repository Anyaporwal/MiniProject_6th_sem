"""
Pydantic V2 request/response schemas for all SafeRoute API contracts.
"""
from pydantic import BaseModel, Field, field_validator, EmailStr
from typing import Optional
from datetime import datetime
from enum import Enum


# ── Enums ───────────────────────────────────────────────────────
class CrimeTypeEnum(str, Enum):
    theft = "theft"
    assault = "assault"
    harassment = "harassment"
    vandalism = "vandalism"
    suspicious = "suspicious"
    other = "other"


class SeverityEnum(str, Enum):
    minor = "minor"
    moderate = "moderate"
    serious = "serious"


class IncidentStatusEnum(str, Enum):
    submitted = "submitted"
    verified = "verified"
    investigating = "investigating"
    resolved = "resolved"
    dismissed = "dismissed"


# ── Auth ────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    email: str = Field(..., max_length=256)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least 1 uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least 1 lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least 1 number")
        if not any(c in "!@#$%^&*()_+-=[]{}|;:',.<>?/" for c in v):
            raise ValueError("Password must contain at least 1 special character")
        return v


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserUpdate(BaseModel):
    phone: Optional[str] = None
    gender: Optional[str] = None
    age_range: Optional[str] = None
    location_sharing: Optional[str] = None
    alert_threshold: Optional[int] = Field(None, ge=0, le=100)
    notification_prefs: Optional[dict] = None
    women_safety_enabled: Optional[bool] = None
    women_safety_auto_hours: Optional[dict] = None


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    phone: Optional[str] = None
    gender: Optional[str] = None
    age_range: Optional[str] = None
    location_sharing: str = "while_using"
    alert_threshold: int = 60
    notification_prefs: Optional[dict] = None
    women_safety_enabled: bool = False
    women_safety_auto_hours: Optional[dict] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Risk ────────────────────────────────────────────────────────
class RiskCheckRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class RiskFactor(BaseModel):
    score: float
    weight: float
    contribution: float


class DCTIResponse(BaseModel):
    location: dict
    timestamp: str
    dcti_score: int
    risk_level: str
    risk_factors: dict
    primary_threats: list[str]
    recommendations: list[str]


# ── Routes ──────────────────────────────────────────────────────
class Location(BaseModel):
    lat: float
    lon: float


class RouteRequest(BaseModel):
    origin: Location
    destination: Location
    preferences: dict = {}


# ── Incidents ───────────────────────────────────────────────────
class IncidentCreate(BaseModel):
    crime_type: CrimeTypeEnum
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    description: Optional[str] = Field(None, max_length=500)
    severity: SeverityEnum = SeverityEnum.moderate
    is_anonymous: bool = False
    location_name: Optional[str] = None
    occurred_at: Optional[datetime] = None


class IncidentResponse(BaseModel):
    id: int
    reference_number: str
    crime_type: str
    latitude: float
    longitude: float
    occurred_at: Optional[datetime] = None
    description: Optional[str] = None
    severity: str
    is_anonymous: bool
    status: str
    location_name: Optional[str] = None
    photos: list = []
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class IncidentUpdate(BaseModel):
    description: Optional[str] = Field(None, max_length=500)
    severity: Optional[SeverityEnum] = None
    location_name: Optional[str] = None


# ── Emergency Contacts ──────────────────────────────────────────
class EmergencyContactCreate(BaseModel):
    name: str = Field(..., max_length=128)
    phone: str = Field(..., max_length=20)
    relation: Optional[str] = Field(None, max_length=64)


class EmergencyContactResponse(BaseModel):
    id: int
    name: str
    phone: str
    relation: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Safety / SOS ────────────────────────────────────────────────
class SOSRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class CheckInRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    message: str = "I'm Safe"


# ── Alerts ──────────────────────────────────────────────────────
class AlertSettingsUpdate(BaseModel):
    alert_threshold: Optional[int] = Field(None, ge=0, le=100)
    notification_prefs: Optional[dict] = None


class AlertHistoryResponse(BaseModel):
    id: int
    latitude: float
    longitude: float
    risk_score: int
    risk_level: str
    action_taken: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
