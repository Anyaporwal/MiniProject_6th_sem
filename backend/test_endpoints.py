"""
Diagnostic test script for SafeRoute backend endpoints.
Tests logic correctness of risk, routing, and other endpoints.
"""
import json
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

def test_heatmap_logic():
    """Test the heatmap endpoint data generation logic."""
    print("\n" + "="*60)
    print("TEST 1: Heatmap Data Logic")
    print("="*60)
    
    from risk_service import get_heatmap_data
    
    # Test night mode
    points_night = get_heatmap_data("night")
    print(f"\n[Night Mode] Total points: {len(points_night)}")
    
    # Analyze the distribution
    risk_levels = {}
    crime_types = {}
    weights = []
    
    for p in points_night:
        rl = p.get("risk_level", "unknown")
        ct = p.get("crime_type", "unknown")
        w = p.get("weight", 0)
        risk_levels[rl] = risk_levels.get(rl, 0) + 1
        crime_types[ct] = crime_types.get(ct, 0) + 1
        weights.append(w)
    
    print(f"  Risk level distribution: {risk_levels}")
    print(f"  Crime type distribution: {crime_types}")
    print(f"  Weight range: {min(weights)} - {max(weights)}")
    print(f"  Average weight: {sum(weights)/len(weights):.1f}")
    
    # BUG ANALYSIS: Check if all are "high" and "unknown"
    if len(risk_levels) == 1 and "high" in risk_levels:
        print("  *** BUG: ALL points are 'high' risk - no variation! ***")
    if len(crime_types) == 1 and "unknown" in crime_types:
        print("  *** BUG: ALL crime types are 'unknown' - missing data! ***")
    if len(set(weights)) == 1:
        print(f"  *** BUG: ALL weights are identical ({weights[0]}) - no variation! ***")
    
    # Test day mode
    points_day = get_heatmap_data("day")
    print(f"\n[Day Mode] Total points: {len(points_day)}")
    risk_levels_day = {}
    for p in points_day:
        rl = p.get("risk_level", "unknown")
        risk_levels_day[rl] = risk_levels_day.get(rl, 0) + 1
    print(f"  Risk level distribution: {risk_levels_day}")
    
    # Show first 3 for inspection
    print(f"\n  First 3 points (night):")
    for p in points_night[:3]:
        print(f"    {p}")

    return points_night


def test_dcti_scoring():
    """Test the DCTI risk scoring logic."""
    print("\n" + "="*60)
    print("TEST 2: DCTI Risk Scoring Logic")
    print("="*60)
    
    from risk_service import calculate_dcti
    
    # Test various locations
    test_points = [
        {"name": "Near major cluster (Sitabuldi)", "lat": 21.1487, "lon": 79.0948},
        {"name": "Moderate area (Dharampeth)", "lat": 21.1200, "lon": 79.0787},
        {"name": "Far from clusters (outskirts)", "lat": 21.2000, "lon": 79.1500},
        {"name": "Near minor cluster", "lat": 21.0687, "lon": 79.0204},
        {"name": "Residential zone", "lat": 21.1400, "lon": 79.1100},
    ]
    
    for tp in test_points:
        result = calculate_dcti(tp["lat"], tp["lon"])
        print(f"\n  {tp['name']} ({tp['lat']}, {tp['lon']}):")
        print(f"    DCTI Score: {result['dcti_score']}, Level: {result['risk_level']}")
        print(f"    Cluster proximity: {result['risk_factors']['cluster_proximity']['score']}")
        print(f"    Historical: {result['risk_factors']['historical_pattern']['score']}")
        print(f"    Environmental: {result['risk_factors']['environmental']['score']}")
        print(f"    Recent reports: {result['risk_factors']['recent_reports']['score']}")
        print(f"    Threats: {result['primary_threats']}")


def test_geojson_properties():
    """Check what properties the GeoJSON Features actually have."""
    print("\n" + "="*60)
    print("TEST 3: GeoJSON Feature Properties Inspection")
    print("="*60)
    
    from pathlib import Path
    DATA_DIR = Path(__file__).resolve().parent.parent / "data"
    
    for mode in ["night", "day"]:
        path = DATA_DIR / f"hotspots_{mode}_ml.geojson"
        if not path.exists():
            print(f"  {mode}: File not found")
            continue
            
        with open(path) as f:
            data = json.load(f)
        
        features = data.get("features", [])
        print(f"\n  [{mode}] Total features: {len(features)}")
        
        if features:
            # Show all property keys from first feature
            first_props = features[0].get("properties", {})
            print(f"  Available property keys: {list(first_props.keys())}")
            print(f"  First feature properties: {first_props}")
            
            # Check all features for crime_type, risk_level, dominant_type
            has_crime_type = sum(1 for f in features if "crime_type" in f.get("properties", {}))
            has_risk_level = sum(1 for f in features if "risk_level" in f.get("properties", {}))
            has_dominant = sum(1 for f in features if "dominant_type" in f.get("properties", {}))
            has_weight = sum(1 for f in features if "weight" in f.get("properties", {}))
            has_count = sum(1 for f in features if "count" in f.get("properties", {}))
            
            print(f"  Features with 'crime_type': {has_crime_type}/{len(features)}")
            print(f"  Features with 'risk_level': {has_risk_level}/{len(features)}")
            print(f"  Features with 'dominant_type': {has_dominant}/{len(features)}")
            print(f"  Features with 'weight': {has_weight}/{len(features)}")
            print(f"  Features with 'count': {has_count}/{len(features)}")
            
            # Show all unique counts
            counts = [f.get("properties", {}).get("count", 0) for f in features]
            print(f"  Count range: {min(counts)} - {max(counts)}")
            print(f"  Geometry types: {set(f.get('geometry', {}).get('type') for f in features)}")


def test_hotspot_areas_csv():
    """Check the hotspot_areas.csv used by routing."""
    print("\n" + "="*60)
    print("TEST 4: Hotspot Areas CSV (for Routing)")
    print("="*60)
    
    import csv
    from pathlib import Path
    DATA_DIR = Path(__file__).resolve().parent.parent / "data"
    path = DATA_DIR / "hotspot_areas.csv"
    
    if not path.exists():
        print("  File not found!")
        return
        
    with open(path) as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    print(f"  Total areas: {len(rows)}")
    if rows:
        print(f"  Column names: {list(rows[0].keys())}")
        for r in rows[:3]:
            print(f"    {r}")


if __name__ == "__main__":
    test_geojson_properties()
    test_heatmap_logic()
    test_dcti_scoring()
    test_hotspot_areas_csv()
    print("\n" + "="*60)
    print("DIAGNOSTIC COMPLETE")
    print("="*60)
