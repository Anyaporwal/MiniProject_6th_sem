"""Test all API endpoints via HTTP."""
import requests
import json

BASE = "http://localhost:8000"

def test_health():
    print("=" * 60)
    print("TEST: Health Check")
    r = requests.get(f"{BASE}/health")
    print(f"  Status: {r.status_code}, Body: {r.json()}")

def test_heatmap():
    print("\n" + "=" * 60)
    print("TEST: Heatmap Endpoint")
    for mode in ["night", "day", "auto"]:
        r = requests.get(f"{BASE}/api/v1/risk/heatmap?mode={mode}")
        d = r.json()
        levels = {}
        for p in d["points"]:
            rl = p["risk_level"]
            levels[rl] = levels.get(rl, 0) + 1
        print(f"  [{mode}] Status: {r.status_code}, Count: {d['count']}, Distribution: {levels}")

def test_risk_check():
    print("\n" + "=" * 60)
    print("TEST: DCTI Risk Check")
    locations = [
        ("Sitabuldi (high-crime)", 21.1487, 79.0948),
        ("Dharampeth", 21.12, 79.0787),
        ("Outskirts", 21.2, 79.15),
        ("Residential", 21.14, 79.11),
    ]
    for name, lat, lon in locations:
        r = requests.post(f"{BASE}/api/v1/risk/check", json={"latitude": lat, "longitude": lon})
        d = r.json()
        print(f"  {name}: score={d['dcti_score']}, level={d['risk_level']}, threats={d['primary_threats']}")

def test_routes():
    print("\n" + "=" * 60)
    print("TEST: Route Calculation")
    r = requests.post(f"{BASE}/api/v1/routes/calculate", json={
        "origin": {"lat": 21.145, "lon": 79.088},
        "destination": {"lat": 21.12, "lon": 79.05},
        "preferences": {}
    })
    d = r.json()
    print(f"  Status: {r.status_code}, Routes found: {len(d.get('routes', []))}")
    for rt in d.get("routes", []):
        print(f"    {rt['label']}: {rt['distance_km']}km, {rt['duration_min']}min, risk={rt['risk_score']}, safety={rt['safety_label']}")

def test_auth_register_login():
    print("\n" + "=" * 60)
    print("TEST: Auth (Register + Login)")
    
    # Register
    r = requests.post(f"{BASE}/api/v1/auth/register", json={
        "username": "testuser_diag",
        "email": "test_diag@example.com",
        "password": "Test@1234"
    })
    print(f"  Register: {r.status_code} - {r.json().get('username', r.json().get('detail', 'ok'))}")
    
    # Login
    r = requests.post(f"{BASE}/api/v1/auth/login", data={
        "username": "testuser_diag",
        "password": "Test@1234"
    })
    d = r.json()
    print(f"  Login: {r.status_code} - token={'present' if 'access_token' in d else 'MISSING'}")
    return d.get("access_token")

def test_incidents(token):
    print("\n" + "=" * 60)
    print("TEST: Incident Reporting")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create incident
    r = requests.post(f"{BASE}/api/v1/incidents/", json={
        "crime_type": "theft",
        "latitude": 21.1487,
        "longitude": 79.0948,
        "description": "Test incident from diagnostic script",
        "severity": "moderate",
        "location_name": "Sitabuldi, Nagpur"
    }, headers=headers)
    d = r.json()
    print(f"  Create: {r.status_code} - ref={d.get('reference_number', 'FAIL: ' + str(d))}")
    
    inc_id = d.get("id")
    
    # Get my incidents
    r = requests.get(f"{BASE}/api/v1/incidents/me", headers=headers)
    print(f"  My incidents: {r.status_code} - count={len(r.json())}")
    
    # Get nearby
    r = requests.get(f"{BASE}/api/v1/incidents/nearby?latitude=21.1487&longitude=79.0948&radius_km=1.0")
    print(f"  Nearby: {r.status_code} - count={len(r.json())}")
    
    return inc_id

def test_safety(token):
    print("\n" + "=" * 60)
    print("TEST: Safety Features (SOS, Contacts, Check-in)")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Add contact
    r = requests.post(f"{BASE}/api/v1/safety/contacts", json={
        "name": "Test Mom",
        "phone": "+919876543210",
        "relation": "Mother"
    }, headers=headers)
    print(f"  Add contact: {r.status_code} - {r.json().get('name', r.json().get('detail', 'ok'))}")
    
    # List contacts
    r = requests.get(f"{BASE}/api/v1/safety/contacts", headers=headers)
    contacts = r.json()
    print(f"  List contacts: {r.status_code} - count={len(contacts)}")
    
    # SOS
    r = requests.post(f"{BASE}/api/v1/safety/sos", json={
        "latitude": 21.1487,
        "longitude": 79.0948
    }, headers=headers)
    d = r.json()
    print(f"  SOS: {r.status_code} - notified={d.get('contacts_notified', d.get('detail', 'FAIL'))}")
    
    # Check-in
    r = requests.post(f"{BASE}/api/v1/safety/checkin", json={
        "latitude": 21.1487,
        "longitude": 79.0948,
        "message": "I'm safe - test"
    }, headers=headers)
    print(f"  Check-in: {r.status_code} - {r.json().get('message', 'ok')}")

def test_hotspots_raw():
    print("\n" + "=" * 60)
    print("TEST: Raw Hotspot GeoJSON")
    for mode in ["night", "day"]:
        r = requests.get(f"{BASE}/api/v1/risk/hotspots/{mode}")
        d = r.json()
        print(f"  [{mode}] Status: {r.status_code}, Features: {len(d.get('features', []))}")


if __name__ == "__main__":
    test_health()
    test_heatmap()
    test_risk_check()
    test_routes()
    token = test_auth_register_login()
    if token:
        test_incidents(token)
        test_safety(token)
    test_hotspots_raw()
    
    print("\n" + "=" * 60)
    print("ALL ENDPOINT TESTS COMPLETE")
    print("=" * 60)
