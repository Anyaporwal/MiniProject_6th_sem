import requests
import json
import math
from pathlib import Path
from itertools import pairwise

BASE        = Path(__file__).resolve().parents[1]
DATA_FOLDER = BASE / "data"

DAY_FILE   = DATA_FOLDER / "hotspots_day_ml.geojson"
NIGHT_FILE = DATA_FOLDER / "hotspots_night_ml.geojson"


# =========================
# LOAD HOTSPOTS
# =========================
def load_hotspots(mode: str = "day") -> list:
    file = DAY_FILE if mode == "day" else NIGHT_FILE
    if not file.exists():
        return []
    data = json.loads(file.read_text())
    return data.get("features", [])


# =========================
# HAVERSINE DISTANCE (metres)
# =========================
def haversine_distance(lat1, lon1, lat2, lon2) -> float:
    R = 6371000
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# =========================
# DETECT NEARBY HOTSPOTS ALONG DIRECT PATH
# =========================
def get_nearby_hotspots(origin, destination, hotspots, threshold_m: int = 500) -> list:
    nearby = {}
    steps  = 40
    for i in range(steps + 1):
        t   = i / steps
        lat = origin[0] + t * (destination[0] - origin[0])
        lon = origin[1] + t * (destination[1] - origin[1])
        for f in hotspots:
            c_lat  = f["properties"]["center_lat"]
            c_lon  = f["properties"]["center_lng"]
            count  = f["properties"].get("count", 1)
            key    = (round(c_lat, 6), round(c_lon, 6))
            if haversine_distance(lat, lon, c_lat, c_lon) < threshold_m:
                # keep track of crime count so we can sort
                nearby[key] = max(nearby.get(key, 0), count)
    # return sorted by danger (most dangerous hotspots first)
    return sorted(nearby.keys(), key=lambda k: nearby[k], reverse=True)


# =========================
# GENERATE DETOUR WAYPOINTS  ← FIXED: deterministic, perpendicular offset
# =========================
def generate_detour_waypoints(origin, destination, hotspots, level: str = "safe") -> list:
    nearby = get_nearby_hotspots(origin, destination, hotspots)
    if not nearby:
        return []

    # Direction vector along the route
    dx = destination[0] - origin[0]
    dy = destination[1] - origin[1]

    # Perpendicular unit vector (rotate 90° left)
    perp_x, perp_y = -dy, dx
    length = math.sqrt(perp_x ** 2 + perp_y ** 2)
    if length == 0:
        return []
    perp_x /= length
    perp_y /= length

    # Fixed shift: larger for "safest" route
    SHIFT = 0.007 if level == "safe" else 0.003

    waypoints = []
    # Use only the single most-dangerous hotspot as detour anchor
    # so the route stays coherent and doesn't zigzag.
    h_lat, h_lon = nearby[0]
    wp = (h_lat + perp_x * SHIFT, h_lon + perp_y * SHIFT)
    waypoints.append(wp)

    return waypoints


# =========================
# OSRM ROUTE
# =========================
def get_osrm_route_with_waypoints(origin, destination, waypoints=None):
    if waypoints is None:
        waypoints = []
    coords     = [origin] + waypoints + [destination]
    coord_str  = ";".join(f"{c[1]},{c[0]}" for c in coords)
    url        = (
        f"http://router.project-osrm.org/route/v1/driving/{coord_str}"
        "?overview=full&geometries=geojson"
    )
    try:
        res = requests.get(url, timeout=8).json()
        if res.get("code") != "Ok":
            return None
        routes = res.get("routes", [])
        return routes[0] if routes else None
    except Exception:
        return None


# =========================
# CALCULATE ROUTE RISK SCORE
# =========================
def calculate_route_risk(coords, hotspots) -> int:
    if not hotspots:
        return 0
    step          = max(1, len(coords) // 60)
    sample_points = coords[::step]
    total_risk    = 0

    for lat, lon in sample_points:
        local_risk = 0
        for f in hotspots:
            c_lat  = f["properties"]["center_lat"]
            c_lon  = f["properties"]["center_lng"]
            count  = f["properties"].get("count", 1)
            d      = haversine_distance(lat, lon, c_lat, c_lon)
            if d < 200:
                local_risk += count * 10
            elif d < 400:
                local_risk += count * 6
            elif d < 800:
                local_risk += count * 3
        total_risk += local_risk

    normalized = int(total_risk / max(1, len(sample_points) * 10))
    return min(normalized, 100)


# =========================
# BUILD ROUTE OBJECT
# =========================
def build_route(route, hotspots, route_type: str) -> dict:
    coords       = route["geometry"]["coordinates"]
    latlon       = [(c[1], c[0]) for c in coords]
    distance_km  = route["distance"] / 1000
    duration_min = route["duration"] / 60
    risk         = calculate_route_risk(latlon, hotspots)

    segments = [
        {
            "start":       {"lat": lat1, "lon": lon1},
            "end":         {"lat": lat2, "lon": lon2},
            "distance_m":  int(haversine_distance(lat1, lon1, lat2, lon2)),
            "instruction": f"Move to point {i + 1}",
        }
        for i, ((lat1, lon1), (lat2, lon2)) in enumerate(pairwise(latlon))
    ]

    return {
        "route_id": route_type,
        "name":     f"{route_type.capitalize()} Route",
        "segments": segments,
        "summary": {
            "total_distance_km":       round(distance_km, 2),
            "estimated_time_minutes":  int(duration_min),
        },
        "_internal": {"risk_score": risk},
    }


# =========================
# CALCULATE ALL ROUTES  ← FIXED: mode is used correctly
# =========================
def calculate_all_routes(origin, destination, mode: str = "day") -> list:
    hotspots = load_hotspots(mode)

    route_specs = [
        ("fastest", []),
        ("safest",  generate_detour_waypoints(origin, destination, hotspots)),
    ]

    routes = []
    seen   = set()

    for route_id, waypoints in route_specs:
        r = get_osrm_route_with_waypoints(origin, destination, waypoints)
        if not r:
            continue
        key = round(r["distance"], 1)
        if key not in seen:
            seen.add(key)
            routes.append(build_route(r, hotspots, route_id))

    return routes


# =========================
# TEST
# =========================
if __name__ == "__main__":
    origin      = (21.177682278850988, 79.04713819292918)
    destination = (21.159501, 79.100129)

    for mode in ["day", "night"]:
        print(f"\n=== {mode.upper()} ROUTES ===\n")
        for route in calculate_all_routes(origin, destination, mode):
            print(route["name"])
            print(f"  Distance : {route['summary']['total_distance_km']} km")
            print(f"  Time     : {route['summary']['estimated_time_minutes']} mins")
            print(f"  Risk     : {route['_internal']['risk_score']}")