"""Verify the routing fix: hotspots load and risk scores are non-zero."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from routing_service import _load_hotspot_areas, _calculate_route_risk, _count_high_risk_zones, _hotspot_cache

# Force fresh reload
_hotspot_cache.clear()

print("=" * 60)
print("VERIFY: _load_hotspot_areas()")
print("=" * 60)
areas = _load_hotspot_areas()
print(f"  Areas loaded: {len(areas)}")
for a in areas[:5]:
    print(f"    {a['name']}: lat={a['lat']:.4f}, lon={a['lon']:.4f}, radius={a['radius_km']}km, risk={a['risk_score']}")

# User's route coords (sampled from the response)
route_coords = [
    [79.039786, 21.179716], [79.045568, 21.178616], [79.050771, 21.176351],
    [79.055974, 21.174652], [79.061229, 21.173122], [79.064486, 21.171715],
    [79.069085, 21.170971], [79.070621, 21.174236], [79.075688, 21.174799],
    [79.080451, 21.17583], [79.083556, 21.173943], [79.08544, 21.171911],
    [79.088967, 21.170098], [79.091024, 21.163149], [79.090808, 21.156836],
    [79.092753, 21.156695],
]

print(f"\n{'=' * 60}")
print("VERIFY: Route risk scoring")
print("=" * 60)
risk = _calculate_route_risk(route_coords, areas)
zones = _count_high_risk_zones(route_coords, areas)
print(f"  Risk score: {risk:.1f}")
print(f"  High risk zones: {zones}")

# Also test the full calculate_all_routes function
from routing_service import calculate_all_routes
origin = {"lat": 21.1797, "lon": 79.0398}
dest = {"lat": 21.156, "lon": 79.0941}

print(f"\n{'=' * 60}")
print("VERIFY: Full route calculation")
print("=" * 60)
result = calculate_all_routes(origin, dest)
for rt in result.get("routes", []):
    print(f"  {rt['label']}: {rt['distance_km']}km, risk={rt['risk_score']}, safety={rt['safety_label']}, zones={rt['high_risk_zones']}")

if all(rt['risk_score'] == 0 for rt in result.get('routes', [])):
    print("\n  *** STILL BROKEN: All risk scores are 0 ***")
else:
    print("\n  SUCCESS: Routes now have varied risk scores!")
