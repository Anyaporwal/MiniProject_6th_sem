"""
Incident Reporting Router – CRUD with photo upload, rate limiting, nearby search.
"""
import os
import uuid
import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session

from database import get_db
from config import get_settings
from models import Incident, User
from schemas import IncidentCreate, IncidentResponse, IncidentUpdate
from services.incident_service import generate_reference_number, check_rate_limit, can_edit_incident, get_nearby_incidents
from services.notification_service import send_incident_confirmation
from auth import get_current_user

settings = get_settings()

router = APIRouter(prefix="/api/v1/incidents", tags=["Incidents"])


@router.post("/", response_model=IncidentResponse, status_code=201)
def create_incident(
    data: IncidentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new incident report."""
    # Rate limit check
    limit = check_rate_limit(db, current_user.id)
    if not limit["allowed"]:
        raise HTTPException(status_code=429, detail=limit["reason"])

    ref = generate_reference_number(db)

    incident = Incident(
        reference_number=ref,
        user_id=None if data.is_anonymous else current_user.id,
        crime_type=data.crime_type,
        latitude=data.latitude,
        longitude=data.longitude,
        description=data.description,
        severity=data.severity,
        is_anonymous=data.is_anonymous,
        location_name=data.location_name,
        occurred_at=data.occurred_at,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    # Send confirmation (mock)
    send_incident_confirmation(current_user.email, ref, data.crime_type.value)

    return incident


@router.post("/{incident_id}/photos", status_code=201)
async def upload_photos(
    incident_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload photos for an incident (max 3, max 5MB each)."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    if incident.user_id and incident.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your incident")

    if len(files) > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 photos allowed")

    existing_photos = incident.photos or []
    if len(existing_photos) + len(files) > 3:
        raise HTTPException(status_code=400, detail=f"Incident already has {len(existing_photos)} photos. Max 3 total.")

    # Ensure upload directory exists
    upload_dir = Path(settings.UPLOAD_DIR) / "incidents" / str(incident_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    saved_files = []
    for file in files:
        # Validate size
        content = await file.read()
        if len(content) > settings.max_upload_bytes:
            raise HTTPException(status_code=400, detail=f"File '{file.filename}' exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")

        # Validate type
        allowed = {"image/jpeg", "image/png", "image/webp"}
        if file.content_type not in allowed:
            raise HTTPException(status_code=400, detail=f"File type '{file.content_type}' not allowed. Use JPEG, PNG, or WebP.")

        # Save file
        ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        filename = f"{uuid.uuid4().hex[:12]}.{ext}"
        filepath = upload_dir / filename

        with open(filepath, "wb") as f:
            f.write(content)

        saved_files.append(filename)

    # Update incident photos
    incident.photos = existing_photos + saved_files
    db.commit()
    db.refresh(incident)

    return {
        "message": f"{len(saved_files)} photo(s) uploaded successfully",
        "photos": incident.photos,
    }


@router.get("/me", response_model=list[IncidentResponse])
def get_my_incidents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
):
    """Get current user's incident reports."""
    incidents = db.query(Incident).filter(
        Incident.user_id == current_user.id
    ).order_by(Incident.created_at.desc()).offset(skip).limit(limit).all()
    return incidents


@router.get("/nearby", response_model=list[IncidentResponse])
def get_nearby(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(0.5, ge=0.1, le=5.0),
    db: Session = Depends(get_db),
):
    """Get recent incidents near a location (community alerts)."""
    return get_nearby_incidents(db, latitude, longitude, radius_km)


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(
    incident_id: int,
    db: Session = Depends(get_db),
):
    """Get a single incident by ID."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.patch("/{incident_id}", response_model=IncidentResponse)
def update_incident(
    incident_id: int,
    data: IncidentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an incident (only within 24 hours of creation)."""
    incident = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.user_id == current_user.id,
    ).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found or not yours")

    if not can_edit_incident(incident):
        raise HTTPException(status_code=403, detail="Cannot edit incidents older than 24 hours")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(incident, key, value)

    db.commit()
    db.refresh(incident)
    return incident


@router.delete("/{incident_id}", status_code=204)
def delete_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an incident (only within 24 hours of creation)."""
    incident = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.user_id == current_user.id,
    ).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found or not yours")

    if not can_edit_incident(incident):
        raise HTTPException(status_code=403, detail="Cannot delete incidents older than 24 hours")

    # Delete associated photos
    upload_dir = Path(settings.UPLOAD_DIR) / "incidents" / str(incident_id)
    if upload_dir.exists():
        shutil.rmtree(upload_dir)

    db.delete(incident)
    db.commit()
