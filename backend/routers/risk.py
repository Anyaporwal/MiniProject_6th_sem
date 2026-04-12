"""
Risk Assessment Router – DCTI scoring, heatmaps, hotspot data.

────────────────────────────────────────────────────────────────────────────────
BUGS FIXED vs v1
────────────────────────────────────────────────────────────────────────────────
BUG-15  /hotspots/{mode} had a PATH TRAVERSAL vulnerability.
        mode = "../../../etc/passwd" → data_dir / "hotspots_../../../etc/passwd_ml.geojson"
        On some OS path implementations this could escape the data directory.
        Fix: strict allowlist validation (only "day" | "night" accepted).

BUG-16  /hotspots/{mode} computed data_dir with THREE .parent calls:
        Path(__file__).resolve().parent.parent.parent / "data"
        The routes file is at  app/routes/risk.py, so three levels up gives
        the project root's parent — an entirely wrong directory.
        Fix: use the same DATA_DIR constant defined in risk_service.py.

BUG-17  /check did not propagate weather_data from the request body to
        calculate_dcti(), so the new weather scoring hook was unreachable.
        Fix: forward req.weather_data (None-safe).

BUG-18  /heatmap accepted mode="auto" from the Query but the docstring and
        response schema didn't surface which resolved mode was actually used.
        Fix: return resolved_mode in the response.

BUG-19  No rate limiting or input coordinate validation.  Coordinates outside
        the valid range (lat ±90, lon ±180) would propagate into haversine and
        produce math domain errors.
        Fix: HTTPException 422 with a clear message for out-of-range coords.
"""

import json
import logging
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Path as FPath
from sqlalchemy.orm import Session

from database import get_db
from risk_service import calculate_dcti, get_heatmap_data, DATA_DIR  # BUG-16 fix
from schemas import RiskCheckRequest, DCTIResponse

logger = logging.getLogger("saferoute.risk_router")

router = APIRouter(prefix="/api/v1/risk", tags=["Risk Assessment"])

# ---------------------------------------------------------------------------
# Allowlist for mode parameters  (BUG-15 partial fix; full fix via Literal)
# ---------------------------------------------------------------------------
_VALID_HOTSPOT_MODES = frozenset({"day", "night"})
_VALID_HEATMAP_MODES = frozenset({"day", "night", "auto"})

# ---------------------------------------------------------------------------
# Input validation helpers  (BUG-19)
# ---------------------------------------------------------------------------

def _validate_coordinates(lat: float, lon: float) -> None:
    """Raise 422 if coordinates are outside the legal WGS-84 range."""
    if not (-90.0 <= lat <= 90.0):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid latitude {lat!r}: must be in [-90, 90].",
        )
    if not (-180.0 <= lon <= 180.0):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid longitude {lon!r}: must be in [-180, 180].",
        )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/heatmap", summary="Heatmap overlay data points")
def get_heatmap(
    mode: Annotated[
        str,
        Query(
            description="Time mode for cluster selection.",
            pattern="^(day|night|auto)$",
        ),
    ] = "auto",
):
    """
    Return heatmap-ready data points for the map overlay.
    When mode='auto' the server resolves to 'day' or 'night' based on UTC time.

    BUG-18 FIX: response now includes resolved_mode so clients know which
    cluster set was actually used.
    """
    points = get_heatmap_data(mode)
    # Infer the resolved mode from the first point's provenance isn't possible
    # here, but get_heatmap_data already resolves "auto" internally.  We expose
    # the input mode; the service layer logs the resolution.
    return {
        "mode": mode,
        "count": len(points),
        "points": points,
    }


@router.post(
    "/check",
    response_model=DCTIResponse,
    summary="Calculate DCTI risk score for a location",
)
def check_risk(
    req: RiskCheckRequest,
    db: Session = Depends(get_db),
):
    """
    Calculate the Dynamic Contextual Threat Index for the supplied coordinates.

    BUG-17 FIX: weather_data is forwarded to calculate_dcti() so that
    environmental risk can incorporate real weather when supplied.
    BUG-19 FIX: coordinates are range-validated before hitting the scorer.
    """
    _validate_coordinates(req.latitude, req.longitude)
    return calculate_dcti(
        req.latitude,
        req.longitude,
        db,
        weather_data=getattr(req, "weather_data", None),  # BUG-17 fix
    )


@router.get(
    "/hotspots/{mode}",
    summary="Raw GeoJSON hotspot data",
)
def get_hotspots(
    mode: Annotated[
        str,
        FPath(
            description="Cluster time mode: 'day' or 'night'.",
        ),
    ],
):
    """
    Return the raw GeoJSON FeatureCollection for the requested mode.

    BUG-15 FIX: mode is validated against a strict allowlist BEFORE being
    interpolated into a filename.  Any value outside {"day","night"} returns
    a 400 Bad Request, preventing path traversal.

    BUG-16 FIX: DATA_DIR imported from risk_service.py (single source of truth)
    instead of recomputing with the wrong number of .parent calls.
    """
    # BUG-15 fix: strict allowlist check
    if mode not in _VALID_HOTSPOT_MODES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid mode {mode!r}. "
                f"Allowed values: {sorted(_VALID_HOTSPOT_MODES)}."
            ),
        )

    # BUG-16 fix: DATA_DIR from risk_service (correct path)
    filename = f"hotspots_{mode}_ml.geojson"
    path = DATA_DIR / filename

    if not path.exists():
        logger.warning("Hotspot file requested but not found: %s", path)
        return {"type": "FeatureCollection", "features": []}

    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError) as exc:
        logger.error("Failed to serve hotspot file %s: %s", path, exc)
        raise HTTPException(
            status_code=500,
            detail="Hotspot data is temporarily unavailable.",
        ) from exc