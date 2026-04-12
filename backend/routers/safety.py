"""
Women Safety Router – SOS, Emergency Alerts, Check-In, Emergency Contacts.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, EmergencyContact, SOSEvent
from schemas import SOSRequest, CheckInRequest, EmergencyContactCreate, EmergencyContactResponse
from services.notification_service import send_sos_alert, send_checkin_notification
from auth import get_current_user

router = APIRouter(prefix="/api/v1/safety", tags=["Women Safety"])


@router.post("/sos")
def trigger_sos(
    req: SOSRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Trigger SOS alert – notifies all emergency contacts with location.
    Sends mock console notifications in demo mode.
    """
    contacts = db.query(EmergencyContact).filter(
        EmergencyContact.user_id == current_user.id
    ).all()

    if not contacts:
        raise HTTPException(
            status_code=400,
            detail="No emergency contacts configured. Add contacts in your profile."
        )

    contact_dicts = [{"name": c.name, "phone": c.phone} for c in contacts]

    # Send notifications
    notified = send_sos_alert(
        user_name=current_user.username,
        latitude=req.latitude,
        longitude=req.longitude,
        contacts=contact_dicts,
    )

    # Record SOS event
    sos = SOSEvent(
        user_id=current_user.id,
        latitude=req.latitude,
        longitude=req.longitude,
        contacts_notified=notified,
    )
    db.add(sos)
    db.commit()
    db.refresh(sos)

    return {
        "message": "SOS alert sent successfully",
        "contacts_notified": notified,
        "sos_id": sos.id,
        "location": {
            "latitude": req.latitude,
            "longitude": req.longitude,
            "maps_link": f"https://maps.google.com/?q={req.latitude},{req.longitude}",
        },
    }


@router.post("/checkin")
def check_in(
    req: CheckInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send 'I'm Safe' check-in to all emergency contacts."""
    contacts = db.query(EmergencyContact).filter(
        EmergencyContact.user_id == current_user.id
    ).all()

    if not contacts:
        return {"message": "Check-in recorded. No emergency contacts to notify."}

    contact_dicts = [{"name": c.name, "phone": c.phone} for c in contacts]

    send_checkin_notification(
        user_name=current_user.username,
        latitude=req.latitude,
        longitude=req.longitude,
        message=req.message,
        contacts=contact_dicts,
    )

    return {
        "message": "Check-in sent to all emergency contacts",
        "contacts_notified": [c.name for c in contacts],
    }


@router.get("/contacts", response_model=list[EmergencyContactResponse])
def list_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List current user's emergency contacts."""
    return db.query(EmergencyContact).filter(
        EmergencyContact.user_id == current_user.id
    ).all()


@router.post("/contacts", response_model=EmergencyContactResponse, status_code=201)
def add_contact(
    data: EmergencyContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add an emergency contact (max 3 per user)."""
    count = db.query(EmergencyContact).filter(
        EmergencyContact.user_id == current_user.id
    ).count()

    if count >= 3:
        raise HTTPException(status_code=400, detail="Maximum 3 emergency contacts allowed")

    contact = EmergencyContact(
        user_id=current_user.id,
        name=data.name,
        phone=data.phone,
        relation=data.relation,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/contacts/{contact_id}", status_code=204)
def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove an emergency contact."""
    contact = db.query(EmergencyContact).filter(
        EmergencyContact.id == contact_id,
        EmergencyContact.user_id == current_user.id,
    ).first()

    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    db.delete(contact)
    db.commit()


@router.get("/sos-history")
def get_sos_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get user's SOS event history."""
    events = db.query(SOSEvent).filter(
        SOSEvent.user_id == current_user.id
    ).order_by(SOSEvent.triggered_at.desc()).limit(20).all()

    return [{
        "id": e.id,
        "latitude": e.latitude,
        "longitude": e.longitude,
        "triggered_at": e.triggered_at.isoformat() if e.triggered_at else None,
        "contacts_notified": e.contacts_notified,
    } for e in events]
