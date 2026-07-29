import requests
import json
import math
from pathlib import Path
from itertools import pairwise

BASE        = Path(__file__).resolve().parents[1]
DATA_FOLDER = BASE / "data"

DAY_FILE   = DATA_FOLDER / "hotspots_day_ml.geojson"
NIGHT_FILE = DATA_FOLDER / "hotspots_night_ml.geojson"

OSRM_BASE = "http://router.project-osrm.org"


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
# OSRM: fetch route for a coordinate list
# =========================
def _osrm_fetch(coord_list: list, alternatives: bool = False) -> list:
    """
    coord_list : [(lat, lon), ...]
    Returns    : list of raw OSRM route objects, empty list on failure.
    """
    coord_str = ";".join(f"{lon},{lat}" for lat, lon in coord_list)
    alt_param = "true" if alternatives else "false"
    url = (
        f"{OSRM_BASE}/route/v1/driving/{coord_str}"
        f"?overview=full&geometries=geojson&alternatives={alt_param}"
    )
    try:
        res = requests.get(url, timeout=10).json()
        if res.get("code") != "Ok":
            return []
        return res.get("routes", [])
    except Exception:
        return []


def _hotspots_near_path(origin, destination, hotspots, threshold_m=600) -> list:
    """Return list of (c_lat, c_lon, count) for hotspots within threshold of direct path."""
    steps  = 50
    found  = {}
    for i in range(steps + 1):
        t   = i / steps
        lat = origin[0] + t * (destination[0] - origin[0])
        lon = origin[1] + t * (destination[1] - origin[1])
        for f in hotspots:
            c_lat = f["properties"]["center_lat"]
            c_lon = f["properties"]["center_lng"]
            count = f["properties"].get("count", 1)
            key   = (round(c_lat, 6), round(c_lon, 6))
            if haversine_distance(lat, lon, c_lat, c_lon) < threshold_m:
                if key not in found or found[key][2] < count:
                    found[key] = (c_lat, c_lon, count)
    # sort by danger descending
    return sorted(found.values(), key=lambda x: x[2], reverse=True)


def _perpendicular_waypoints(origin, destination, h_lat, h_lon, shifts, t_positions):
    """
    Generate waypoints offset perpendicularly away from the hotspot.
    Corrected for geographic coordinate distortion (longitude scaling).
    """
    # Latitude in radians to calculate longitude scaling factor
    cos_lat = math.cos(math.radians(origin[0]))
    
    # Scale longitude to approximate meters-proportional distance
    dx = destination[0] - origin[0]
    dy = (destination[1] - origin[1]) * cos_lat
    
    route_len_sq = dx * dx + dy * dy
    if route_len_sq == 0:
        return []

    # Perpendicular unit vectors
    perp_x, perp_y = -dy, dx
    length = math.sqrt(perp_x ** 2 + perp_y ** 2)
    if length == 0:
        return []
    perp_x /= length
    perp_y /= length

    waypoints = []
    for t in t_positions:
        t = max(0.1, min(0.9, t))
        proj_lat = origin[0] + t * dx
        
        # Un-scale the longitude back to degrees for projection calculation
        proj_lon_scaled = (origin[1] - origin[1]) * cos_lat + t * dy 
        proj_lon = origin[1] + (proj_lon_scaled / cos_lat)

        # Side calculation using scaled coordinates for accurate geometry
        side = (h_lat - proj_lat) * perp_x + ((h_lon - origin[1]) * cos_lat - proj_lon_scaled) * perp_y
        sign = -1 if side >= 0 else 1

        for shift in shifts:
            # shift is in degrees. Apply shift to latitude, un-scale shift for longitude
            wp = (proj_lat + sign * perp_x * shift,
                  proj_lon + (sign * perp_y * shift) / cos_lat)
            waypoints.append(wp)
    return waypoints


def collect_all_candidate_routes(origin, destination, hotspots) -> list:
    """
    Returns a deduplicated list of raw OSRM route objects.
    Deduplication fixed to use geometry strings instead of rounded distances.
    """
    seen_geometries = {}  # key: geometry string -> best route object

    def _add_routes(raw_routes, label=""):
        for r in raw_routes:
            # Use the stringified geometry coordinates as a unique footprint for the route
            key = str(r["geometry"]["coordinates"])
            if key not in seen_geometries:
                r["_label"] = label
                seen_geometries[key] = r
            else:
                # If geometry matches but this new route is somehow faster, keep it
                if r["duration"] < seen_geometries[key]["duration"]:
                    r["_label"] = label
                    seen_geometries[key] = r

    # 1. Direct route + OSRM-native alternatives
    direct = _osrm_fetch([origin, destination], alternatives=True)
    _add_routes(direct, label="direct/alternative")

    # 2. Detour waypoints for each nearby hotspot
    nearby = _hotspots_near_path(origin, destination, hotspots)
    t_positions = [0.25, 0.5, 0.75]
    shifts      = [0.004, 0.007, 0.012] 

    for h_lat, h_lon, _ in nearby[:3]:
        wps = _perpendicular_waypoints(
            origin, destination, h_lat, h_lon, shifts, t_positions
        )
        for wp in wps:
            routes = _osrm_fetch([origin, wp, destination], alternatives=False)
            _add_routes(routes, label=f"detour_via_{round(wp[0],4)}_{round(wp[1],4)}")

    return list(seen_geometries.values())


# =========================
# RISK SCORER
# =========================
def calculate_route_risk(osrm_route, hotspots) -> float:
    """
    Calculates float risk score.
    Normalizes risk by total route distance, not node count,
    to prevent node-density bias from OSRM curved road geometries.
    """
    if not hotspots:
        return 0.0

    coords_lonlat = osrm_route["geometry"]["coordinates"]
    latlon_pairs  = [(c[1], c[0]) for c in coords_lonlat]

    step          = max(1, len(latlon_pairs) // 80)
    sample_points = latlon_pairs[::step]
    if not sample_points:
        return 0.0

    total_risk = 0.0
    for lat, lon in sample_points:
        for f in hotspots:
            c_lat = f["properties"]["center_lat"]
            c_lon = f["properties"]["center_lng"]
            count = f["properties"].get("count", 1)
            d     = haversine_distance(lat, lon, c_lat, c_lon)
            if d < 150:
                total_risk += count * 15
            elif d < 300:
                total_risk += count * 10
            elif d < 500:
                total_risk += count * 6
            elif d < 800:
                total_risk += count * 2

    distance_km = osrm_route["distance"] / 1000
    if distance_km == 0:
        return 0.0
        
    # Normalize risk per kilometer rather than per sample point
    return round(total_risk / distance_km, 2)


# =========================
# BUILD ROUTE OBJECT
# =========================
def build_route(osrm_route, hotspots, route_id: str, precalculated_risk: float = None) -> dict:
    coords_lonlat = osrm_route["geometry"]["coordinates"]
    latlon        = [(c[1], c[0]) for c in coords_lonlat]

    distance_km  = osrm_route["distance"] / 1000
    duration_min = osrm_route["duration"] / 60
    
    # Use precalculated risk if provided, fallback to calculating it
    risk = precalculated_risk if precalculated_risk is not None else calculate_route_risk(osrm_route, hotspots)

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
        "route_id": route_id,
        "name":     f"{route_id.capitalize()} Route",
        "segments": segments,
        "summary": {
            "total_distance_km":      round(distance_km, 2),
            "estimated_time_minutes": int(duration_min),
        },
        "_internal": {
            "risk_score":   risk,
            "osrm_label":   osrm_route.get("_label", ""),
        },
    }


# =========================
# CALCULATE ALL ROUTES  (main entry point)
# =========================
def calculate_all_routes(origin, destination, mode: str = "day") -> list:
    """
    Returns up to two route dicts: fastest and safest.
    """
    hotspots   = load_hotspots(mode)
    candidates = collect_all_candidate_routes(origin, destination, hotspots)

    if not candidates:
        return []

    scored = []
    for r in candidates:
        risk     = calculate_route_risk(r, hotspots)
        duration = r["duration"]
        scored.append((risk, duration, r))

    # Fastest = minimum duration among all candidates
    fastest_entry = min(scored, key=lambda x: x[1])

    # Safest = minimum risk score; break ties by duration
    safest_entry  = min(scored, key=lambda x: (x[0], x[1]))

    results = []

    # Pass the precalculated risk to avoid O(P*H) recalculation
    fastest_route = build_route(fastest_entry[2], hotspots, "fastest", precalculated_risk=fastest_entry[0])
    results.append(fastest_route)

    # Check for identical routes using geometry strings, not rounded distance
    fastest_geom = str(fastest_entry[2]["geometry"]["coordinates"])
    safest_geom  = str(safest_entry[2]["geometry"]["coordinates"])

    if safest_geom != fastest_geom:
        safest_route = build_route(safest_entry[2], hotspots, "safest", precalculated_risk=safest_entry[0])
        results.append(safest_route)
    else:
        # Same physical route won both
        fastest_route["route_id"] = "fastest_and_safest"
        fastest_route["name"]     = "Fastest & Safest Route"

    return results


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
            print(f"  Via      : {route['_internal']['osrm_label']}")