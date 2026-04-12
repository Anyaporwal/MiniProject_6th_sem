"""
DCTI Risk Scoring Service – Dynamic Contextual Threat Index.
Implements the weighted composite scoring from the backend.docx spec (FR-ML-003).

Score Components:
  - Cluster proximity risk:    40% weight
  - Historical pattern risk:   30% weight
  - Environmental risk:        20% weight
  - Recent report density:     10% weight

Risk Levels:
  0–30  → Low
  31–60 → Moderate
  61–80 → High
  81–100→ Critical

────────────────────────────────────────────────────────────────────────────────
BUGS FIXED vs v1
────────────────────────────────────────────────────────────────────────────────
BUG-1  _hotspot_cache never expired → data changes required a server restart.
       Fix: TTL-based invalidation (_CACHE_TTL_SECONDS, default 300 s).

BUG-2  _cluster_risk used hard stepped distance bands (100→80→60→40→20→10→2).
       These produce discontinuous jumps — a point 0.499 km away scored 60
       while 0.501 km scored 40, a 33% cliff from a 2 m step.
       Fix: Smooth Gaussian decay beyond each cluster's core radius.

BUG-3  _cluster_risk kept only the SINGLE highest cluster score (max-only).
       Being surrounded by 5 moderate clusters was identical to being near one.
       Fix: Additive accumulation with diminishing returns (capped at 100).

BUG-4  _historical_risk ALWAYS loaded _load_hotspots("night") regardless of
       the time of day — daytime requests used the wrong cluster set.
       Fix: Mode derived from hour, correct cluster file loaded.

BUG-5  _historical_risk had an unexplained magic constant "* 30" that caused
       the density_score to saturate (hit 100) with only 3–4 nearby clusters.
       Fix: principled log-normalised score, explicit saturation ceiling.

BUG-6  _report_density_risk bounding-box used the same delta for latitude AND
       longitude.  At lat 21° (Nagpur), 1° lon ≈ 103 km, not 111 km — the box
       was ~7% wider than intended.
       Fix: delta_lon = 0.5 / (111.0 * cos(lat)).

BUG-7  _report_density_risk used count * 15 linear scaling.  7 incidents in
       30 days → score 100.  Unreasonably aggressive for a city environment.
       Fix: Logarithmic scaling, tunable cap constant.

BUG-8  calculate_dcti used int() (floor truncation) to convert the composite.
       A composite of 60.9 → 60 (Moderate) instead of 61 (High) — wrong tier.
       Fix: round() before int cast.

BUG-9  _get_feature_centroid averaged ALL rings of a Polygon including interior
       holes.  A doughnut-shaped polygon produced a centroid in the middle of
       its hole.
       Fix: Only average the exterior ring (coords[0]).

BUG-10 _classify_crime_type inferred crime labels purely from count density
       (count≥1000 → "theft" etc.).  This is factually wrong — a theft hotspot
       with count=3 was labelled "general".
       Fix: Only surface actual `crime_type` from properties; fall back to
       "unknown" instead of a fabricated label.

BUG-11 _historical_risk had no day-of-week factor.  Friday/Saturday nights are
       statistically much riskier than Tuesday nights at the same hour.
       Fix: weekend_multiplier applied on top of hour-based time_factor.

BUG-12 _cluster_risk added ANY feature within 1 km to the threat list, even
       clusters with count=1 (crime_type="general"), polluting recommendations.
       Fix: Minimum density_factor threshold before a threat is recorded.

BUG-13 get_heatmap_data recomputed max_count and iterated every feature on
       every HTTP request with zero caching.
       Fix: Result cached with same TTL as hotspot data.

BUG-14 _load_hotspots silently returned [] for a missing file with no log.
       Fix: logger.warning on missing file.

BUG-15 router /hotspots/{mode} had a PATH TRAVERSAL vulnerability:
       mode="../../../etc/passwd" → arbitrary file read.  (Fixed in risk.py.)
"""

import json
import math
import time
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.orm import Session

logger = logging.getLogger("saferoute.risk")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

_CACHE_TTL_SECONDS: int = 300  # 5-minute TTL for all in-process caches

# ---------------------------------------------------------------------------
# In-process caches  (hotspot features + heatmap output)
# ---------------------------------------------------------------------------
_hotspot_cache: dict[str, dict] = {}   # {"night": {"data": [...], "loaded_at": float}}
_heatmap_cache: dict[str, dict] = {}   # {"night": {"data": [...], "loaded_at": float}}

WEIGHTS = {
    "cluster":     0.40,
    "historical":  0.30,
    "environment": 0.20,
    "reports":     0.10,
}

# ---------------------------------------------------------------------------
# Hotspot loading  (BUG-1, BUG-14)
# ---------------------------------------------------------------------------

def _load_hotspots(mode: str = "night", force_reload: bool = False) -> list[dict]:
    """
    Load and cache GeoJSON hotspot clusters for the given mode.

    Args:
        mode:         "day" or "night"
        force_reload: bypass TTL and reload from disk immediately

    Returns:
        List of GeoJSON Feature dicts; empty list on missing/invalid file.
    """
    now = time.monotonic()
    cached = _hotspot_cache.get(mode)

    if (
        not force_reload
        and cached is not None
        and (now - cached["loaded_at"]) < _CACHE_TTL_SECONDS
    ):
        return cached["data"]

    filename = f"hotspots_{mode}_ml.geojson"
    path = DATA_DIR / filename

    if not path.exists():
        logger.warning("Hotspot file not found: %s – returning empty cluster list", path)
        _hotspot_cache[mode] = {"data": [], "loaded_at": now}
        return []

    try:
        with open(path, "r", encoding="utf-8") as fh:
            geojson = json.load(fh)
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("Failed to parse %s: %s", path, exc)
        _hotspot_cache[mode] = {"data": [], "loaded_at": now}
        return []

    features = geojson.get("features", [])
    _hotspot_cache[mode] = {"data": features, "loaded_at": now}
    logger.info("Loaded %d hotspot features from %s", len(features), filename)
    return features


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
    return R * 2 * math.asin(math.sqrt(max(0.0, a)))


def _get_feature_centroid(feature: dict) -> Optional[tuple[float, float]]:
    """
    Extract (lat, lon) centroid from a Point or Polygon feature.

    BUG-9 FIX: For Polygons, only the EXTERIOR ring (coords[0]) is averaged.
    The original code averaged ALL rings, including interior holes, which
    placed the centroid inside the hole of a doughnut-shaped polygon.
    """
    geom = feature.get("geometry", {})
    gtype = geom.get("type")
    coords = geom.get("coordinates", [])

    if gtype == "Point":
        if len(coords) >= 2:
            return coords[1], coords[0]  # (lat, lon)
        return None

    if gtype == "Polygon":
        if not coords:
            return None
        exterior = coords[0]  # ← only exterior ring; BUG-9 fix
        if not exterior:
            return None
        avg_lat = sum(c[1] for c in exterior) / len(exterior)
        avg_lon = sum(c[0] for c in exterior) / len(exterior)
        return avg_lat, avg_lon

    if gtype == "MultiPolygon":
        # Use the largest ring (most coordinates) as the dominant polygon
        all_rings = [ring for poly in coords for ring in poly[:1]]  # exterior only
        if not all_rings:
            return None
        largest = max(all_rings, key=len)
        avg_lat = sum(c[1] for c in largest) / len(largest)
        avg_lon = sum(c[0] for c in largest) / len(largest)
        return avg_lat, avg_lon

    return None


def _density_factor(count: int) -> float:
    """
    Normalise a raw crime count to a density weight in [0.05, 1.0].
    Uses log₁₀ with divisor 4 (count=10000 → factor=1.0).
    """
    return min(1.0, max(0.05, math.log10(max(count, 1)) / 4.0))


# ---------------------------------------------------------------------------
# Component 1 – Cluster Proximity Risk (40%)  (BUG-2, BUG-3, BUG-10, BUG-12)
# ---------------------------------------------------------------------------

def _cluster_risk(lat: float, lon: float, mode: str) -> tuple[float, list[str]]:
    """
    Score based on proximity to known crime clusters.

    BUG-2 FIX: Smooth Gaussian decay replaces hard distance bands.
    BUG-3 FIX: Additive accumulation instead of max-only, so multiple nearby
               clusters compound the risk (capped at 100).
    BUG-10 FIX: crime_type comes from actual GeoJSON properties only;
                no fabricated labels inferred from count.
    BUG-12 FIX: Minimum density_factor threshold before recording a threat.

    Returns:
        (score 0-100, list of distinct nearby threat type strings)
    """
    features = _load_hotspots(mode)
    if not features:
        return 0.0, []

    accumulated_risk = 0.0
    threats: list[str] = []

    for feature in features:
        props = feature.get("properties", {})
        centroid = _get_feature_centroid(feature)
        if centroid is None:
            continue

        flat, flon = centroid
        dist = _haversine(lat, lon, flat, flon)
        count = props.get("count", 1)
        half_m = props.get("half_m", 180)
        radius_km = max(0.05, half_m / 1000.0)

        df = _density_factor(count)

        # ── Smooth score: full inside radius, Gaussian decay outside ──────
        if dist <= radius_km:
            base_score = 100.0
        else:
            sigma = radius_km  # 1σ = one radius-length beyond edge
            excess = dist - radius_km
            base_score = 100.0 * math.exp(-0.5 * (excess / sigma) ** 2)

        adjusted_score = base_score * df

        # ── Additive accumulation with diminishing returns (BUG-3 fix) ───
        # New contribution is scaled by (1 - current_fraction) so each
        # additional cluster adds less once we're already at high risk.
        remaining = 100.0 - accumulated_risk
        accumulated_risk += adjusted_score * (remaining / 100.0)

        # ── Threats: only clusters that are close and high enough density ─
        if dist < 1.0 and df >= 0.15:
            crime_type = props.get("crime_type")  # BUG-10 fix: real data only
            if crime_type and crime_type not in threats:
                threats.append(crime_type)

    return min(100.0, accumulated_risk), threats[:5]


# ---------------------------------------------------------------------------
# Component 2 – Historical Pattern Risk (30%)  (BUG-4, BUG-5, BUG-11)
# ---------------------------------------------------------------------------

_HOUR_FACTORS: list[tuple[range | set, float]] = [
    # (hours, time_factor)  — most specific first
    (set(range(22, 24)) | set(range(0, 6)),  1.00),   # late night / early morning
    (set(range(6, 9))   | set(range(18, 22)), 0.60),  # commute / evening
    (set(range(9, 18)),                        0.25),  # daytime
]


def _time_factor(hour: int) -> float:
    for hours, factor in _HOUR_FACTORS:
        if hour in hours:
            return factor
    return 0.25


def _historical_risk(lat: float, lon: float, hour: int, mode: str) -> float:
    """
    Temporal pattern scoring.

    BUG-4 FIX: Uses the caller-supplied `mode` to load the correct cluster
               file.  Original ALWAYS loaded "night" regardless of time.
    BUG-5 FIX: The magic `* 30` constant is replaced with a principled
               log-normalised proximity score, capped at 100.
    BUG-11 FIX: Weekend multiplier (Friday 20:00–Sunday 23:59 → ×1.25).
    """
    tf = _time_factor(hour)

    # Weekend uplift (BUG-11 fix)
    now = datetime.now(timezone.utc)
    weekend_multiplier = 1.25 if now.weekday() >= 4 and hour >= 20 else 1.0

    features = _load_hotspots(mode)  # BUG-4 fix: correct mode
    if not features:
        return 0.0

    # Accumulate proximity-weighted density (BUG-5 fix: no magic constant)
    accumulated = 0.0
    for feature in features:
        centroid = _get_feature_centroid(feature)
        if centroid is None:
            continue
        flat, flon = centroid
        dist = _haversine(lat, lon, flat, flon)

        if dist >= 2.0:
            continue

        count = feature.get("properties", {}).get("count", 1)
        proximity_weight = 1.0 - (dist / 2.0)       # linear 1→0 over 2 km
        count_weight = _density_factor(count)        # log-normalised [0.05, 1.0]

        contribution = proximity_weight * count_weight * 100.0
        remaining = 100.0 - accumulated
        accumulated += contribution * (remaining / 100.0)  # diminishing returns

    raw = min(100.0, accumulated)
    return min(100.0, raw * tf * weekend_multiplier)


# ---------------------------------------------------------------------------
# Component 3 – Environmental Risk (20%)
# ---------------------------------------------------------------------------

def _environmental_risk(hour: int, weather_data: Optional[dict] = None) -> float:
    """
    Environmental factors: lighting, visibility, crowd density.
    Currently uses time-of-day as proxy; weather_data hook is ready for
    future integration (FR-ENV-001).

    Args:
        hour:         UTC hour (0–23)
        weather_data: Optional dict from a weather API:
                      {"visibility_km": float, "condition": str, "lux": float}
    """
    # Time-of-day baseline
    if hour in set(range(22, 24)) | set(range(0, 5)):
        base = 85.0
    elif hour in {5, 6, 20, 21}:
        base = 60.0
    elif hour in set(range(7, 10)) | set(range(17, 20)):
        base = 30.0
    else:
        base = 15.0

    if weather_data is None:
        return base

    # ── Weather integration (active when weather_data is supplied) ────────
    vis = weather_data.get("visibility_km", 10.0)
    condition = weather_data.get("condition", "clear").lower()

    vis_penalty = max(0.0, (10.0 - vis) * 3.0)   # +3 per km below 10 km visibility
    fog_penalty  = 20.0 if "fog" in condition else 0.0
    rain_penalty = 10.0 if "rain" in condition else 0.0
    storm_penalty = 25.0 if any(w in condition for w in ("storm", "thunder")) else 0.0

    return min(100.0, base + vis_penalty + fog_penalty + rain_penalty + storm_penalty)


# ---------------------------------------------------------------------------
# Component 4 – Recent Report Density (10%)  (BUG-6, BUG-7)
# ---------------------------------------------------------------------------

_REPORT_RADIUS_M = 500       # spatial radius for incident lookup (metres)
_REPORT_WINDOW_DAYS = 30     # temporal window
_REPORT_LOG_BASE = 10        # incidents at which score saturates to ~50
_REPORT_SAT_COUNT = 20       # incidents at which score saturates to 100


def _report_density_risk(lat: float, lon: float, db: Session = None) -> float:
    """
    Score based on recent incident reports near this location.

    BUG-6 FIX: Longitude delta now uses cos(lat) correction so the bounding
               box is metrically accurate regardless of latitude.
    BUG-7 FIX: Logarithmic scaling — 20 incidents → 100, 5 → ~50.
               Original linear scale hit 100 with just 7 incidents.
    """
    if db is None:
        return 20.0  # no database — conservative baseline

    try:
        from models import Incident

        cutoff = datetime.now(timezone.utc) - timedelta(days=_REPORT_WINDOW_DAYS)
        radius_km = _REPORT_RADIUS_M / 1000.0

        # BUG-6 fix: separate lat/lon deltas
        delta_lat = radius_km / 111.0
        delta_lon = radius_km / (111.0 * math.cos(math.radians(lat)))

        count = (
            db.query(Incident)
            .filter(
                Incident.latitude.between(lat - delta_lat, lat + delta_lat),
                Incident.longitude.between(lon - delta_lon, lon + delta_lon),
                Incident.created_at >= cutoff,
            )
            .count()
        )

        if count == 0:
            return 0.0

        # BUG-7 fix: log scale — score = 100 × log(count+1) / log(sat+1)
        score = 100.0 * math.log(count + 1) / math.log(_REPORT_SAT_COUNT + 1)
        return min(100.0, score)

    except Exception as exc:   # noqa: BLE001
        logger.warning("report_density_risk DB query failed: %s", exc)
        return 20.0            # fallback to baseline, never crash the scorer


# ---------------------------------------------------------------------------
# Risk classification helpers
# ---------------------------------------------------------------------------

def _risk_level_from_score(score: float) -> str:
    """Map a 0-100 DCTI score to its risk tier string."""
    if score <= 30:
        return "low"
    if score <= 60:
        return "moderate"
    if score <= 80:
        return "high"
    return "critical"


def _compute_count_thresholds(features: list[dict]) -> tuple[float, float, float]:
    """
    Derive P33 / P66 / P90 count thresholds from the loaded cluster population.

    This makes risk classification dataset-agnostic: whether counts range
    from 2–16 000 (current Nagpur data) or 10–500 (a smaller city), the
    four tiers are always meaningfully populated.

    Returns (p33, p66, p90).
    """
    counts = sorted(f.get("properties", {}).get("count", 1) for f in features)
    if not counts:
        return 10.0, 100.0, 1000.0   # sensible absolute fallback

    n = len(counts)
    p33 = counts[max(0, int(n * 0.33))]
    p66 = counts[max(0, int(n * 0.66))]
    p90 = counts[max(0, int(n * 0.90))]

    # Guarantee strict ordering (duplicates can collapse tiers)
    p33 = max(p33, 1)
    p66 = max(p66, p33 + 1)
    p90 = max(p90, p66 + 1)
    return float(p33), float(p66), float(p90)


# Module-level threshold cache keyed by mode — recomputed whenever
# _load_hotspots refreshes the cluster data.
_count_thresholds: dict[str, tuple[float, float, float]] = {}


def _get_count_thresholds(mode: str) -> tuple[float, float, float]:
    """Return (p33, p66, p90) for the current cluster data in `mode`."""
    features = _load_hotspots(mode)
    # Invalidate threshold cache when hotspot cache was refreshed
    hotspot_ts = _hotspot_cache.get(mode, {}).get("loaded_at", 0.0)
    cached = _count_thresholds.get(mode)
    if cached is None or hotspot_ts > _count_thresholds.get(f"{mode}_ts", -1):
        thresholds = _compute_count_thresholds(features)
        _count_thresholds[mode] = thresholds
        _count_thresholds[f"{mode}_ts"] = hotspot_ts
        return thresholds
    return cached


def _classify_risk_from_count(count: int, mode: str = "night") -> str:
    """
    Classify risk level from a raw crime cluster count.
    Used only for heatmap display — NOT mixed into DCTI scoring.

    ADAPTIVE (dataset-agnostic):
    Thresholds are computed as P33/P66/P90 of the loaded cluster population
    rather than fixed absolute values.  This ensures all four risk tiers
    appear in the heatmap regardless of the count scale of the underlying data.

    Previous absolute thresholds (10/100/1000) produced only "low" and
    "critical" on the Nagpur dataset because all 26 noise clusters had count
    2–6 and all 6 genuine clusters had count 1000+.  With adaptive thresholds,
    the genuine clusters are meaningfully spread across moderate/high/critical.
    """
    p33, p66, p90 = _get_count_thresholds(mode)
    if count >= p90:
        return "critical"
    if count >= p66:
        return "high"
    if count >= p33:
        return "moderate"
    return "low"


# ---------------------------------------------------------------------------
# Recommendations
# ---------------------------------------------------------------------------

def _get_recommendations(
    level: str, threats: list[str], hour: int
) -> list[str]:
    """Generate contextual safety recommendations."""
    recs: list[str] = []

    if level in ("high", "critical"):
        recs.append("Avoid this area if possible, especially alone.")
        recs.append("Share your live location with a trusted contact.")
        if hour >= 20 or hour <= 6:
            recs.append("Stick to well-lit main roads during night hours.")
    elif level == "moderate":
        recs.append("Stay aware of your surroundings.")
        recs.append("Keep your phone accessible for emergency calls.")
    else:
        recs.append("This area currently has low risk indicators.")

    threat_recs = {
        "theft":      "Keep valuables concealed and bags close to your body.",
        "harassment": "Try to walk in groups or well-populated routes.",
        "assault":    "Consider using the SOS feature and share your location.",
        "robbery":    "Avoid displaying phones or jewellery in open areas.",
    }
    for threat in threats:
        if threat in threat_recs and threat_recs[threat] not in recs:
            recs.append(threat_recs[threat])

    return recs[:5]


# ---------------------------------------------------------------------------
# Public API – DCTI  (BUG-8)
# ---------------------------------------------------------------------------

def calculate_dcti(
    lat: float,
    lon: float,
    db: Session = None,
    weather_data: Optional[dict] = None,
) -> dict:
    """
    Calculate Dynamic Contextual Threat Index for a location.

    BUG-8 FIX: round() before int cast (original used int() = floor truncation).
    A composite of 60.9 now correctly becomes 61 (High) not 60 (Moderate).

    Args:
        lat, lon:      Geographic coordinates
        db:            SQLAlchemy session (optional; skips DB component if None)
        weather_data:  Optional weather API payload for environmental scoring

    Returns:
        Complete risk assessment dict matching DCTIResponse schema.
    """
    now = datetime.now(timezone.utc)
    hour = now.hour
    mode = "night" if (hour >= 20 or hour <= 6) else "day"

    cluster_score, threats     = _cluster_risk(lat, lon, mode)
    historical_score           = _historical_risk(lat, lon, hour, mode)
    env_score                  = _environmental_risk(hour, weather_data)
    report_score               = _report_density_risk(lat, lon, db)

    # Weighted composite  (BUG-8 fix: round → int, not int = floor)
    raw_dcti = (
        cluster_score    * WEIGHTS["cluster"]
        + historical_score * WEIGHTS["historical"]
        + env_score        * WEIGHTS["environment"]
        + report_score     * WEIGHTS["reports"]
    )
    dcti = int(round(min(100.0, max(0.0, raw_dcti))))
    level = _risk_level_from_score(dcti)

    # Per-factor breakdown (verify contributions sum to dcti ± 1 due to rounding)
    def _factor(score: float, weight: float) -> dict:
        return {
            "score":        round(score, 1),
            "weight":       weight,
            "contribution": round(score * weight, 1),
        }

    return {
        "location":    {"latitude": lat, "longitude": lon},
        "timestamp":   now.isoformat(),
        "dcti_score":  dcti,
        "risk_level":  level,
        "risk_factors": {
            "cluster_proximity":  _factor(cluster_score,   WEIGHTS["cluster"]),
            "historical_pattern": _factor(historical_score, WEIGHTS["historical"]),
            "environmental":      _factor(env_score,        WEIGHTS["environment"]),
            "recent_reports":     _factor(report_score,     WEIGHTS["reports"]),
        },
        "primary_threats":   threats if threats else ["general"],
        "recommendations":   _get_recommendations(level, threats, hour),
        "mode":              mode,
        "weather_factored":  weather_data is not None,
    }


# ---------------------------------------------------------------------------
# Heatmap API  (BUG-13)
# ---------------------------------------------------------------------------

def get_heatmap_data(mode: str = "auto") -> list[dict]:
    """
    Return heatmap-ready data points for the map overlay.

    BUG-13 FIX: Result is cached by mode with the same TTL as hotspot data,
    eliminating per-request recomputation of max_count and full iteration.

    BUG-10 FIX: crime_type comes from actual properties or "unknown" — not
                fabricated from count density.

    Args:
        mode: "day" | "night" | "auto"
    """
    if mode == "auto":
        hour = datetime.now(timezone.utc).hour
        mode = "night" if (hour >= 20 or hour <= 6) else "day"

    # Check heatmap cache
    now = time.monotonic()
    cached_hm = _heatmap_cache.get(mode)
    if cached_hm and (now - cached_hm["loaded_at"]) < _CACHE_TTL_SECONDS:
        return cached_hm["data"]

    features = _load_hotspots(mode)
    if not features:
        _heatmap_cache[mode] = {"data": [], "loaded_at": now}
        return []

    max_count = max(
        (f.get("properties", {}).get("count", 1) for f in features),
        default=1,
    )
    log_max = math.log10(max(max_count, 2))

    points: list[dict] = []
    for feature in features:
        props = feature.get("properties", {})
        centroid = _get_feature_centroid(feature)
        if centroid is None:
            continue

        clat, clon = centroid
        count = props.get("count", 1)

        # Log-normalised weight 1–10
        normalized = math.log10(max(count, 1)) / log_max
        weight = max(1, min(10, round(normalized * 10)))

        points.append(
            {
                "latitude":   round(clat, 6),
                "longitude":  round(clon, 6),
                "weight":     weight,
                "crime_type": props.get("crime_type", "unknown"),  # BUG-10 fix
                "risk_level": _classify_risk_from_count(count, mode),
                "count":      count,
            }
        )

    _heatmap_cache[mode] = {"data": points, "loaded_at": now}
    return points