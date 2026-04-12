"""
Alert History & Settings Router.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import User, AlertHistory
from schemas import AlertSettingsUpdate, AlertHistoryResponse
from auth import get_current_user

router = APIRouter(prefix="/api/v1/alerts", tags=["Alerts"])


@router.get("/history", response_model=list[AlertHistoryResponse])
def get_alert_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
):
    """Get user's alert history."""
    return db.query(AlertHistory).filter(
        AlertHistory.user_id == current_user.id
    ).order_by(AlertHistory.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/settings")
def get_alert_settings(
    current_user: User = Depends(get_current_user),
):
    """Get current alert settings."""
    return {
        "alert_threshold": current_user.alert_threshold,
        "notification_prefs": current_user.notification_prefs,
    }


@router.post("/settings")
def update_alert_settings(
    data: AlertSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update alert preferences."""
    if data.alert_threshold is not None:
        current_user.alert_threshold = data.alert_threshold
    if data.notification_prefs is not None:
        current_user.notification_prefs = data.notification_prefs

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Alert settings updated",
        "alert_threshold": current_user.alert_threshold,
        "notification_prefs": current_user.notification_prefs,
    }
