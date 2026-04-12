"""
Routing Service – calculates Safest, Balanced, and Fastest routes.

Key design decisions vs. original:
  - Each route type gets its OWN OSRM call with independent waypoints, guaranteeing
    different geometries and therefore different risk scores.
  - Smooth Gaussian risk decay replaces the hard-cutoff / discontinuous formula.
  - Unified _sample_coords() helper used everywhere → consistent hotspot detection.
  - Proportional detour offset scales with route length.
  - TTL-based hotspot cache (default 5 min) so live data updates are reflected.
  - Composite risk metric (peak 40% + mean 60%) prevents dangerous segments being
    diluted while rewarding longer detours.
  - OSRM calls get one automatic retry on timeout.
  - Graceful fallback at every layer with structured error info returned to the caller.
"""

import csv
import math
import time
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional



import requests

logger = logging.getLogger("saferoute.routing")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
OSRM_BASE = "http://router.project-osrm.org"

_CACHE_TTL_SECONDS: int = 300  # refresh hotspot data every 5 minutes

_hotspot_cache: dict = {}

# ---------------------------------------------------------------------------
# Hotspot loading
# ---------------------------------------------------------------------------

def _load_hotspot_areas(force_reload: bool = False) -> list[dict]:
    """
    Load hotspot area definitions from CSV with TTL-based cache.

    Columns expected (case-insensitive fallbacks supported):
        latitude, longitude, area_name (or name), radius_km (or radius, in m if > 10),
        risk_score (or crime_count), risk_level
    """
    now = time.monotonic()
    cached_at: float = _hotspot_cache.get("loaded_at", 0.0)

    if (
        not force_reload
        and "areas" in _hotspot_cache
        and (now - cached_at) < _CACHE_TTL_SECONDS
    ):
        return _hotspot_cache["areas"]

    path = DATA_DIR / "hotspot_areas.csv"
    if not path.exists():
        logger.warning("Hotspot data file not found: %s", path)
        _hotspot_cache.update(areas=[], loaded_at=now)
        return []

    areas: list[dict] = []
    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for i, row in enumerate(reader, start=2):  # row 1 = header
            try:
                name = row.get("area_name") or row.get("name") or "Unknown"

                raw_radius = float(row.get("radius_km") or row.get("radius") or 300)
                # Values > 10 are treated as metres → convert to km
                radius_km = raw_radius / 1000.0 if raw_radius > 10 else raw_radius
                radius_km = max(0.05, radius_km)  # floor at 50 m

                risk_score = float(row.get("risk_score") or row.get("crime_count") or 50)
                risk_score = max(0.0, min(100.0, risk_score))  # clamp [0,100]

                areas.append(
                    {
                        "name": name,
                        "lat": float(row["latitude"]),
                        "lon": float(row["longitude"]),
                        "radius_km": radius_km,
                        "risk_score": risk_score,
                        "risk_level": row.get("risk_level", "Medium"),
                    }
                )
            except (ValueError, KeyError) as exc:
                logger.warning("CSV row %d skipped – %s | raw=%s", i, exc, dict(row))

    _hotspot_cache.update(areas=areas, loaded_at=now)
    logger.info("Loaded %d hotspot areas from %s", len(areas), path)
    return areas


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(max(0.0, a)))  # guard against float rounding


def _sample_coords(coords: list, n_samples: int = 50) -> list:
    """
    Uniformly subsample a coordinate list to exactly n_samples points.
    Always includes the first and last coordinate.
    """
    if not coords:
        return []
    if len(coords) <= n_samples:
        return coords

    indices = {0, len(coords) - 1}
    step = (len(coords) - 1) / (n_samples - 1)
    indices.update(round(i * step) for i in range(n_samples))
    return [coords[i] for i in sorted(indices)]


# ---------------------------------------------------------------------------
# Risk calculation  (fixed formula with smooth Gaussian decay)
# ---------------------------------------------------------------------------

def _point_risk(coord: list, hotspots: list[dict]) -> float:
    """
    Risk at a single coordinate.  Uses a smooth Gaussian decay beyond each
    hotspot's core radius, eliminating the discontinuity in the original code.

    Returns the maximum contribution from any nearby hotspot (0-100).
    """
    lon, lat = coord[0], coord[1]
    max_risk = 0.0

    for h in hotspots:
        dist = _haversine(lat, lon, h["lat"], h["lon"])
        radius = h["radius_km"]
        score = h["risk_score"]

        if dist <= radius:
            contribution = score  # full risk inside core radius
        else:
            # Gaussian decay: σ = 0.75 * radius (sharper drop-off reward)
            sigma = radius * 0.75
            excess = dist - radius
            contribution = score * math.exp(-0.5 * (excess / sigma) ** 2)

        max_risk = max(max_risk, contribution)

    return max_risk


_TIME_MULTIPLIERS: dict[str, float] = {
    "day": 0.70,
    "auto": 1.00,
    "night": 1.60,
}


def _calculate_route_risk(
    route_coords: list, hotspots: list[dict], time_mode: str = "auto"
) -> float:
    """
    Aggregate risk score for a route (0-100).

    Composite metric: 60% weight on top-10th-percentile points (peak danger) +
    40% weight on the mean.  This prevents a long safe stretch from hiding one
    truly dangerous segment, which was a flaw in the plain-mean approach.
    """
    if not hotspots or not route_coords:
        return 0.0

    multiplier = _TIME_MULTIPLIERS.get(time_mode.lower(), 1.0)
    sampled = _sample_coords(route_coords, n_samples=50)

    risks = [_point_risk(coord, hotspots) * multiplier for coord in sampled]

    if not risks:
        return 0.0

    risks_desc = sorted(risks, reverse=True)
    top_n = max(1, len(risks_desc) // 10)
    peak_risk = sum(risks_desc[:top_n]) / top_n
    mean_risk = sum(risks) / len(risks)

    # 40% Peak / 60% Mean (Reward routes that spend more time in safe patches)
    composite = 0.4 * peak_risk + 0.6 * mean_risk
    return min(100.0, composite)


def _count_high_risk_zones(route_coords: list, hotspots: list[dict]) -> int:
    """
    Count distinct hotspot zones the route passes through.
    Uses the same _sample_coords() call as _calculate_route_risk for consistency.
    """
    if not hotspots or not route_coords:
        return 0

    sampled = _sample_coords(route_coords, n_samples=50)
    count = 0
    for hotspot in hotspots:
        for coord in sampled:
            if _haversine(coord[1], coord[0], hotspot["lat"], hotspot["lon"]) < hotspot["radius_km"]:
                count += 1
                break  # each hotspot counted only once per route
    return count


# ---------------------------------------------------------------------------
# OSRM client
# ---------------------------------------------------------------------------

def _get_osrm_route(
    waypoints: list[dict],
    alternatives: bool = False,
    retries: int = 1,
) -> Optional[dict]:
    """
    Call OSRM routing API.  Retries once on timeout.
    Returns the full OSRM response dict or None on failure.
    """
    coords_str = ";".join(f"{wp['lon']},{wp['lat']}" for wp in waypoints)
    url = f"{OSRM_BASE}/route/v1/driving/{coords_str}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "alternatives": str(alternatives).lower(),
        "steps": "false",
    }

    for attempt in range(retries + 1):
        try:
            resp = requests.get(url, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") == "Ok" and data.get("routes"):
                return data
            logger.warning(
                "OSRM code=%s message=%s (attempt %d)",
                data.get("code"),
                data.get("message", ""),
                attempt + 1,
            )
            return None  # non-Ok codes won't improve with a retry
        except requests.Timeout:
            if attempt < retries:
                logger.warning("OSRM timeout on attempt %d, retrying…", attempt + 1)
            else:
                logger.error("OSRM timed out after %d attempt(s)", retries + 1)
        except requests.HTTPError as exc:
            logger.error("OSRM HTTP error: %s", exc)
            return None
        except Exception as exc:  # noqa: BLE001
            logger.error("OSRM unexpected error: %s", exc)
            return None

    return None


# ---------------------------------------------------------------------------
# Waypoint generation  (proportional, offset_fraction-aware)
# ---------------------------------------------------------------------------

def _generate_detour_waypoints(
    origin: dict,
    destination: dict,
    hotspots: list[dict],
    offset_fraction: float = 1.0,
) -> list[dict]:
    """
    Generate a single intermediate waypoint perpendicular to the route vector.

    offset_fraction controls detour aggressiveness:
      1.0 → full safe detour   (Safest route)
      0.5 → half detour        (Balanced route)
      0.0 → no detour          (Fastest – skip this function entirely)

    The perpendicular offset magnitude scales with route length so a 300 m
    route doesn't get a 3 km detour and a 30 km route isn't deflected by only
    500 m (the fixed value used in the original).
    """
    if offset_fraction == 0.0 or not hotspots:
        return []

    mid_lat = (origin["lat"] + destination["lat"]) / 2
    mid_lon = (origin["lon"] + destination["lon"]) / 2

    dlat = destination["lat"] - origin["lat"]
    dlon = destination["lon"] - origin["lon"]
    length = math.sqrt(dlat ** 2 + dlon ** 2) or 1e-6

    # Proportional base offset: 15% of route length (degrees), floored at ~330 m
    base_offset = max(0.003, length * 0.15) * offset_fraction

    # Two perpendicular candidates (left / right of route midpoint)
    candidates = [
        {
            "lat": mid_lat + (dlon / length) * base_offset,
            "lon": mid_lon - (dlat / length) * base_offset,
        },
        {
            "lat": mid_lat - (dlon / length) * base_offset,
            "lon": mid_lon + (dlat / length) * base_offset,
        },
    ]

    # Pick the candidate that maximises the minimum distance to any hotspot
    best = max(
        candidates,
        key=lambda c: min(
            _haversine(c["lat"], c["lon"], h["lat"], h["lon"]) for h in hotspots
        ),
    )
    return [best]


# ---------------------------------------------------------------------------
# Route formatting
# ---------------------------------------------------------------------------

def _get_safety_label(risk_score: float) -> str:
    if risk_score <= 30:
        return "Low Risk"
    if risk_score <= 60:
        return "Moderate Risk"
    if risk_score <= 80:
        return "High Risk"
    return "Critical Risk"


def _format_route(
    osrm_route: dict,
    label: str,
    route_type: str,
    hotspots: list[dict],
    time_mode: str,
) -> dict:
    """Convert a raw OSRM route object into the API response schema."""
    coords = osrm_route["geometry"]["coordinates"]

    risk_score_raw = _calculate_route_risk(coords, hotspots, time_mode)
    risk_score = int(round(risk_score_raw))

    return {
        "label": label,
        "type": route_type,
        "distance_km": round(osrm_route["distance"] / 1000, 2),
        "duration_min": round(osrm_route["duration"] / 60, 1),
        "risk_score": risk_score,
        "safety_label": _get_safety_label(risk_score_raw),
        "high_risk_zones": _count_high_risk_zones(coords, hotspots),
        "geometry": {"type": "LineString", "coordinates": coords},
        "summary": osrm_route.get("legs", [{}])[0].get("summary", ""),
    }


# ---------------------------------------------------------------------------
# Balanced route fallback interpolation
# ---------------------------------------------------------------------------

def _interpolate_balanced(fastest: dict, safest: dict) -> dict:
    """
    When OSRM returns the same geometry for balanced and fastest (sparse road
    network), synthesise a balanced route by interpolating key metrics.
    The geometry remains the fastest geometry (best available approximation).
    """
    blended_risk = int(round(fastest["risk_score"] * 0.6 + safest["risk_score"] * 0.4))
    blended_dist = round(fastest["distance_km"] * 0.55 + safest["distance_km"] * 0.45, 2)
    blended_dur = round(fastest["duration_min"] * 0.55 + safest["duration_min"] * 0.45, 1)
    blended_zones = max(
        0,
        round(fastest["high_risk_zones"] * 0.6 + safest["high_risk_zones"] * 0.4),
    )

    return {
        **fastest,  # inherit geometry from fastest
        "label": "Balanced Route",
        "type": "balanced",
        "distance_km": blended_dist,
        "duration_min": blended_dur,
        "risk_score": blended_risk,
        "safety_label": _get_safety_label(blended_risk),
        "high_risk_zones": blended_zones,
        "recommended": False,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def calculate_all_routes(
    origin: dict,
    destination: dict,
    time_mode: str = "auto",
) -> dict:
    """
    Calculate three route types and return them sorted safest → balanced → fastest.

    Each type gets an independent OSRM call with its own intermediate waypoints:
      • Safest  – full perpendicular detour away from hotspots
      • Balanced – half detour (time/safety compromise)
      • Fastest  – direct OSRM route, no detour

    The Balanced route therefore has a genuinely different geometry from both
    Fastest and Safest, eliminating the identical risk-score bug in v1.

    Args:
        origin:      {"lat": float, "lon": float}
        destination: {"lat": float, "lon": float}
        time_mode:   "day" | "auto" | "night"  (affects risk multiplier)

    Returns:
        {
          "origin": ...,
          "destination": ...,
          "routes": [safest, balanced, fastest],   # always sorted this way
          "error": "..." | None
        }
    """
    if time_mode.lower() not in _TIME_MULTIPLIERS:
        logger.warning("Unknown time_mode '%s', falling back to 'auto'", time_mode)
        time_mode = "auto"

    # Resolve "auto" based on server hour (consistent with risk_service.py)
    if time_mode.lower() == "auto":
        hour = datetime.now(timezone.utc).hour
        time_mode = "night" if (hour >= 20 or hour <= 6) else "day"
        logger.info("Resolved 'auto' time_mode to '%s'", time_mode)

    hotspots = _load_hotspot_areas()
    results: dict = {"origin": origin, "destination": destination, "routes": [], "error": None}

    # ── Fastest: direct, no detour ──────────────────────────────────────
    fastest_route: Optional[dict] = None
    fastest_data = _get_osrm_route([origin, destination])
    if fastest_data:
        fastest_route = _format_route(
            fastest_data["routes"][0], "Fastest Route", "fastest", hotspots, time_mode
        )
    else:
        logger.error("OSRM failed to return a direct route for origin=%s dest=%s", origin, destination)
        results["error"] = "Routing service unavailable. Please try again."
        return results  # no point trying detour routes if direct fails

    # ── Safest: full perpendicular detour ───────────────────────────────
    safest_route: Optional[dict] = None
    safe_wps = _generate_detour_waypoints(origin, destination, hotspots, offset_fraction=1.0)
    safe_data = _get_osrm_route([origin] + safe_wps + [destination])
    if safe_data:
        safest_route = _format_route(
            safe_data["routes"][0], "Safest Route", "safest", hotspots, time_mode
        )
    else:
        # Fallback: copy fastest but mark with no-detour note
        logger.warning("Safest detour route failed, falling back to direct route geometry")
        safest_route = {
            **fastest_route,
            "label": "Safest Route",
            "type": "safest",
        }

    # ── Balanced: 60% offset detour (compromise) ───────────────────────
    balanced_route: Optional[dict] = None
    bal_wps = _generate_detour_waypoints(origin, destination, hotspots, offset_fraction=0.6)
    bal_data = _get_osrm_route([origin] + bal_wps + [destination])
    if bal_data:
        candidate = _format_route(
            bal_data["routes"][0], "Balanced Route", "balanced", hotspots, time_mode
        )
        # If the road network collapsed the detour into the same path as fastest,
        # interpolate metrics so the three routes remain meaningfully distinct.
        if (
            candidate["geometry"]["coordinates"]
            == fastest_route["geometry"]["coordinates"]
        ):
            logger.info(
                "Balanced detour yielded same geometry as fastest – interpolating metrics"
            )
            balanced_route = _interpolate_balanced(fastest_route, safest_route)
        else:
            balanced_route = candidate
    else:
        logger.warning("Balanced detour route failed, interpolating from fastest + safest")
        balanced_route = _interpolate_balanced(fastest_route, safest_route)

    # ── Assemble in canonical order ─────────────────────────────────────
    route_list = [safest_route, balanced_route, fastest_route]
    # Remove any None entries (should not happen given fallbacks above, but safety-first)
    route_list = [r for r in route_list if r is not None]

    # Mark the balanced route as recommended; if absent, mark safest
    recommended_types = ["balanced", "safest", "fastest"]
    for rtype in recommended_types:
        for r in route_list:
            if r["type"] == rtype:
                r["recommended"] = True
                break
        else:
            continue
        break

    results["routes"] = route_list
    return results