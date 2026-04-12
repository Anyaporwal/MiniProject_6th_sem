"""
SafeRoute API – Main Application Entry Point.
Thin orchestrator: mounts routers, configures middleware, creates tables.
"""
import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import get_settings
from database import engine
from models import Base
from middleware import RateLimitMiddleware

# Import routers
from auth import router as auth_router, user_router
from routers.risk import router as risk_router
from routers.routes import router as routes_router
from routers.incidents import router as incidents_router
from routers.safety import router as safety_router
from routers.alerts import router as alerts_router

# ── Setup ───────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-30s │ %(levelname)-8s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("saferoute")

settings = get_settings()

# Create all tables
Base.metadata.create_all(bind=engine)

# Ensure upload directory exists
upload_dir = Path(settings.UPLOAD_DIR)
upload_dir.mkdir(parents=True, exist_ok=True)
(upload_dir / "incidents").mkdir(exist_ok=True)

# ── App ─────────────────────────────────────────────────────────
app = FastAPI(
    title="SafeRoute API",
    description="Women Safety and Route Navigation API for Nagpur",
    version="2.0.0",
)

# ── Middleware ──────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Dev mode — restrict in production via settings.cors_origin_list
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware, auth_limit=500, unauth_limit=200)

# ── Static files (uploaded photos) ──────────────────────────────
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

# ── Mount Routers ───────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(user_router)
app.include_router(risk_router)
app.include_router(routes_router)
app.include_router(incidents_router)
app.include_router(safety_router)
app.include_router(alerts_router)


# ── Health Check ────────────────────────────────────────────────
@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "version": "2.0.0",
        "service": "SafeRoute API",
    }


# ── Legacy compatibility endpoints ─────────────────────────────
# Keep /login and /register at root for backward compat with mobile app
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import Depends
from sqlalchemy.orm import Session
from database import get_db


@app.post("/login", tags=["Legacy"], include_in_schema=False)
def legacy_login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Legacy login endpoint for backward compatibility."""
    from auth import login
    return login(form_data=form_data, db=db)


@app.post("/register", tags=["Legacy"], include_in_schema=False, status_code=201)
def legacy_register(data: dict, db: Session = Depends(get_db)):
    """Legacy register endpoint for backward compatibility."""
    from schemas import UserCreate, UserResponse
    from auth import register
    user_data = UserCreate(**data)
    return register(data=user_data, db=db)


@app.post("/check-risk", tags=["Legacy"], include_in_schema=False)
def legacy_check_risk(data: dict):
    """Legacy risk check endpoint."""
    from risk_service import calculate_dcti
    return calculate_dcti(data.get("latitude", 0), data.get("longitude", 0))


logger.info("[OK] SafeRoute API v2.0.0 ready")
logger.info(f"[DIR] Uploads directory: {upload_dir.resolve()}")
logger.info(f"[MAIL] Notifications: {'MOCK (console)' if settings.SMTP_MOCK else 'LIVE (SMTP)'}")