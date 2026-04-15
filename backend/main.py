from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
import pandas as pd
import math
import json
import smtplib
from email.mime.text import MIMEText
from datetime import datetime

from risk_service import generate_heatmap
from routing_service import calculate_all_routes
from auth import router as auth_router

# -------------------------
# 📌 APP SETUP
# -------------------------
app = FastAPI(title="Crime Safety API", version="2.0")
app.include_router(auth_router)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# 📌 FILE PATHS
# -------------------------
BASE       = Path(__file__).resolve().parent
DATA_FOLDER = BASE.parent / "data"

DAY_FILE   = DATA_FOLDER / "hotspots_day_ml.geojson"
NIGHT_FILE = DATA_FOLDER / "hotspots_night_ml.geojson"
CSV_FILE   = DATA_FOLDER / "hotspot_areas.csv"

print("DAY_FILE:",   DAY_FILE)
print("NIGHT_FILE:", NIGHT_FILE)
print("CSV_FILE:",   CSV_FILE)

data = pd.read_csv(CSV_FILE)

# -------------------------
# 📌 MODELS
# -------------------------
class Location(BaseModel):
    lat: float
    lon: float

class RouteRequest(BaseModel):
    origin: Location
    destination: Location
    preferences: dict = {}

class RiskRequest(BaseModel):
    latitude: float
    longitude: float

class ContactRequest(BaseModel):
    contacts: list

class AlertRequest(BaseModel):
    latitude: float
    longitude: float
    time: str

# -------------------------
# 🔥 HELPER
# -------------------------
def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def resolve_mode(time_mode: str) -> str:
    if time_mode == "auto":
        hour = datetime.now().hour
        return "night" if (hour >= 21 or hour <= 4) else "day"
    return time_mode  # "day" or "night"


def load_hotspot_features(mode: str) -> list:
    file = DAY_FILE if mode == "day" else NIGHT_FILE
    if not file.exists():
        return []
    with open(file) as f:
        gj = json.load(f)
    return gj.get("features", [])


# -------------------------
# 🔥 HEATMAP
# -------------------------
@app.get("/api/v1/risk/heatmap")
def get_heatmap(min_lon: float, min_lat: float, max_lon: float, max_lat: float):
    grid = generate_heatmap((min_lon, min_lat, max_lon, max_lat))
    return {"grid_cells": grid, "total_cells": len(grid)}


# -------------------------
# 🔥 ROUTES  ← FIXED: time_mode respected
# -------------------------
@app.post("/api/v1/routes/calculate")
def calculate_routes(req: RouteRequest):
    time_mode = req.preferences.get("time_mode", "auto")
    mode = resolve_mode(time_mode)

    routes = calculate_all_routes(
        (req.origin.lat,      req.origin.lon),
        (req.destination.lat, req.destination.lon),
        mode=mode,
    )
    return {"routes": routes}


# -------------------------
# 🔥 HOTSPOT FILES
# -------------------------
@app.get("/api/v1/hotspots/day")
def get_day_hotspots():
    with open(DAY_FILE) as f:
        return json.load(f)

@app.get("/api/v1/hotspots/night")
def get_night_hotspots():
    with open(NIGHT_FILE) as f:
        return json.load(f)


# -------------------------
# 🔥 HOTSPOTS CSV
# -------------------------
@app.get("/hotspots")
def get_hotspots():
    return data.to_dict(orient="records")


# -------------------------
# 🔥 CHECK RISK
# -------------------------
@app.post("/check-risk")
def check_risk(user: RiskRequest):
    for _, zone in data.iterrows():
        distance = haversine(
            user.latitude, user.longitude,
            zone["latitude"], zone["longitude"],
        )
        if distance <= zone["radius"]:
            return {
                "area_name":  zone["area_name"],
                "risk_score": zone["risk_score"],
                "risk_level": zone["risk_level"],
                "distance":   distance,
                "alert": "⚠️ You are inside a dangerous hotspot zone",
            }
    return {"risk_level": "Safe", "alert": "You are in a safe area"}


# -------------------------
# 🔥 CHECK ISOLATION  ← FIXED: uses real lat/lon + hotspot data
# -------------------------
@app.post("/check-isolation")
def check_isolation(user: RiskRequest):
    """
    Count how many ML hotspot zones fall within 1 km of the user.
      0  nearby zones → Well Connected
      1  nearby zone  → Moderately Isolated
      2+ nearby zones → Highly Isolated
    """
    mode     = resolve_mode("auto")
    features = load_hotspot_features(mode)

    RADIUS_M    = 1000
    nearby_count = sum(
        1 for f in features
        if haversine(
            user.latitude, user.longitude,
            f["properties"]["center_lat"],
            f["properties"]["center_lng"],
        ) <= RADIUS_M
    )

    if nearby_count == 0:
        status = "Well Connected"
    elif nearby_count == 1:
        status = "Moderately Isolated"
    else:
        status = "Highly Isolated"

    return {"status": status, "nearby_zones": nearby_count, "mode": mode}


# -------------------------
# 🔥 SAVE CONTACTS
# -------------------------
@app.post("/save-contacts")
def save_contacts(req: ContactRequest):
    try:
        with open("contacts.json") as f:
            contacts = json.load(f)
    except Exception:
        contacts = []
    contacts.extend(req.contacts)
    with open("contacts.json", "w") as f:
        json.dump(contacts, f, indent=4)
    return {"status": "contacts saved"}


# -------------------------
# 🔥 SEND EMAIL ALERT
# -------------------------
@app.post("/send-emergency-alert")
def send_alert(req: AlertRequest):
    sender   = "guptag@rknec.edu"
    password = "xkpiquxcgibiushn"
    receiver = "guptag@rknec.edu"

    location_link = f"https://maps.google.com/?q={req.latitude},{req.longitude}"
    body = f"Emergency Alert Triggered\n\nTime: {req.time}\nLocation: {location_link}\n"

    msg = MIMEText(body)
    msg["Subject"] = "🚨 Emergency Alert"
    msg["From"]    = sender
    msg["To"]      = receiver

    server = smtplib.SMTP("smtp.gmail.com", 587)
    server.starttls()
    server.login(sender, password)
    server.send_message(msg)
    server.quit()
    return {"message": "Emergency email sent"}


# -------------------------
# 🔥 REPORT INCIDENT
# -------------------------
@app.post("/api/v1/report")
def report_incident(req: dict):
    try:
        with open("reports.json") as f:
            reports = json.load(f)
    except Exception:
        reports = []
    reports.append(req)
    with open("reports.json", "w") as f:
        json.dump(reports, f, indent=4)
    return {"message": "Incident reported successfully"}


# -------------------------
# ROOT
# -------------------------
@app.get("/")
def root():
    return {"message": "API Running 🚀"}