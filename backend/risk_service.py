import pandas as pd
import math

# =========================
# 📌 LOAD CRIME DATA
# =========================
crime_data = pd.read_csv("../data/nagpur_crime.csv")

# convert severity to numeric
crime_data["severity"] = pd.to_numeric(crime_data["severity"], errors="coerce").fillna(1)

crime_points = list(zip(
    crime_data["latitude"].astype(float),
    crime_data["longitude"].astype(float),
    crime_data["severity"].astype(float)
))

# 📌 RISK LEVEL
def get_risk_level(score):
    if score < 20:
        return "low"
    elif score < 50:
        return "medium"
    else:
        return "high"

# =========================
# 📌 RISK CALCULATION
# =========================
def calculate_risk(lat, lon):
    risk = 0

    for c_lat, c_lon, severity in crime_points:
        dist = math.sqrt((lat - c_lat)**2 + (lon - c_lon)**2)

        if dist < 0.01:
            risk += severity * (1 / (dist + 0.001))

    return min(int(risk), 100)

# =========================
# 📌 HEATMAP
# =========================
def generate_heatmap(bbox):
    min_lon, min_lat, max_lon, max_lat = bbox

    grid = []
    step = 0.002

    lat = min_lat
    while lat <= max_lat:
        lon = min_lon
        while lon <= max_lon:
            score = calculate_risk(lat, lon)

            grid.append({
                "center": {"lat": lat, "lon": lon},
                "risk_score": score,
                "risk_level": get_risk_level(score)
            })

            lon += step
        lat += step

    return grid