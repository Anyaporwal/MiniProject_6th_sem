"""
Incident business logic – reference numbers, spam prevention, queries.
"""
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session
from sqlalchemy import func

from models import Incident


def generate_reference_number(db: Session) -> str:
    """Generate a unique INC-YYYY-NNNNNN reference number."""
    year = datetime.now(timezone.utc).year
    while True:
        seq = random.randint(100000, 999999)
        ref = f"INC-{year}-{seq}"
        exists = db.query(Incident).filter(Incident.reference_number == ref).first()
        if not exists:
            return ref


def check_rate_limit(db: Session, user_id: int) -> dict:
    """
    Spam prevention:
    - Max 3 reports per hour
    - Max 10 reports per day
    Returns {"allowed": bool, "reason": str | None}
    """
    now = datetime.now(timezone.utc)
    one_hour_ago = now - timedelta(hours=1)
    one_day_ago = now - timedelta(days=1)

    hourly_count = db.query(func.count(Incident.id)).filter(
        Incident.user_id == user_id,
        Incident.created_at >= one_hour_ago,
    ).scalar()

    if hourly_count >= 3:
        return {"allowed": False, "reason": "Rate limit: max 3 reports per hour."}

    daily_count = db.query(func.count(Incident.id)).filter(
        Incident.user_id == user_id,
        Incident.created_at >= one_day_ago,
    ).scalar()

    if daily_count >= 10:
        return {"allowed": False, "reason": "Rate limit: max 10 reports per day."}

    return {"allowed": True, "reason": None}


def can_edit_incident(incident: Incident) -> bool:
    """Incidents can only be edited/deleted within 24 hours of creation."""
    if not incident.created_at:
        return False
    now = datetime.now(timezone.utc)
    age = now - incident.created_at.replace(tzinfo=timezone.utc)
    return age < timedelta(hours=24)


def get_nearby_incidents(db: Session, lat: float, lon: float, radius_km: float = 0.5, limit: int = 20):
    """
    Fetch incidents near a coordinate using Haversine approximation.
    SQLite doesn't have PostGIS, so we filter by bounding box then refine.
    """
    # Rough bounding box (1 degree lat ≈ 111 km)
    delta_lat = radius_km / 111.0
    delta_lon = radius_km / (111.0 * max(abs(__import__("math").cos(__import__("math").radians(lat))), 0.01))

    return db.query(Incident).filter(
        Incident.latitude.between(lat - delta_lat, lat + delta_lat),
        Incident.longitude.between(lon - delta_lon, lon + delta_lon),
        Incident.status != "dismissed",
    ).order_by(Incident.created_at.desc()).limit(limit).all()
