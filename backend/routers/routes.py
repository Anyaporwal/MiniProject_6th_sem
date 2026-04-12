"""
Route Calculation Router.
"""
from fastapi import APIRouter

from schemas import RouteRequest
from routing_service import calculate_all_routes

router = APIRouter(prefix="/api/v1/routes", tags=["Routing"])


@router.post("/calculate")
def calculate_routes(req: RouteRequest):
    """Calculate safest, fastest, and balanced routes."""
    origin = {"lat": req.origin.lat, "lon": req.origin.lon}
    destination = {"lat": req.destination.lat, "lon": req.destination.lon}
    time_mode = req.preferences.get("time_mode", "auto")
    return calculate_all_routes(origin, destination, time_mode)
