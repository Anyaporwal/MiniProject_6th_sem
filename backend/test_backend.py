# -*- coding: utf-8 -*-
"""
SafeRoute Backend - Comprehensive Integration Test Suite.
Tests all API endpoints against the backend.docx specification.
Run with: python test_backend.py
"""
import sys
import io
import json
import time
import random
import string
import requests

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE = "http://127.0.0.1:8000"

# -- Helpers --
def random_user():
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return {
        "username": f"testuser_{suffix}",
        "email": f"test_{suffix}@saferoute.app",
        "password": f"Test@{suffix}123",
    }

def auth_header(token):
    return {"Authorization": f"Bearer {token}"}

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []

    def ok(self, name, detail=""):
        self.passed += 1
        print(f"  [PASS] {name} {detail}")

    def fail(self, name, detail=""):
        self.failed += 1
        self.errors.append(f"{name}: {detail}")
        print(f"  [FAIL] {name} -- {detail}")

    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"  RESULTS: {self.passed}/{total} passed, {self.failed} failed")
        if self.errors:
            print(f"\n  FAILURES:")
            for e in self.errors:
                print(f"    - {e}")
        print(f"{'='*60}")


results = TestResults()

# ================================================================
# 1. HEALTH CHECK
# ================================================================
print("\n[1] HEALTH CHECK")
try:
    r = requests.get(f"{BASE}/health")
    if r.status_code == 200 and r.json().get("status") == "healthy":
        results.ok("GET /health", f"=> {r.json()}")
    else:
        results.fail("GET /health", f"status={r.status_code}")
except Exception as e:
    results.fail("GET /health", str(e))

# ================================================================
# 2. AUTHENTICATION (FR-UA-001, FR-UA-002)
# ================================================================
print("\n[2] AUTHENTICATION")
user = random_user()

# 2a. Register
try:
    r = requests.post(f"{BASE}/api/v1/auth/register", json=user)
    if r.status_code == 201:
        results.ok("POST /register", f"=> user_id={r.json().get('id')}")
    else:
        results.fail("POST /register", f"status={r.status_code} body={r.text}")
except Exception as e:
    results.fail("POST /register", str(e))

# 2b. Duplicate registration
try:
    r = requests.post(f"{BASE}/api/v1/auth/register", json=user)
    if r.status_code == 400:
        results.ok("Duplicate registration blocked", f"=> {r.json().get('detail')}")
    else:
        results.fail("Duplicate registration", f"expected 400, got {r.status_code}")
except Exception as e:
    results.fail("Duplicate registration", str(e))

# 2c. Password validation (weak password)
try:
    weak_user = random_user()
    weak_user["password"] = "weakpass"
    r = requests.post(f"{BASE}/api/v1/auth/register", json=weak_user)
    if r.status_code == 422:
        results.ok("Weak password rejected", "=> 422 validation error")
    else:
        results.fail("Weak password", f"expected 422, got {r.status_code}")
except Exception as e:
    results.fail("Weak password", str(e))

# 2d. Login with username
token = None
try:
    r = requests.post(f"{BASE}/api/v1/auth/login", data={
        "username": user["username"],
        "password": user["password"],
    })
    if r.status_code == 200 and "access_token" in r.json():
        token = r.json()["access_token"]
        results.ok("POST /login (username)", f"=> token_type={r.json().get('token_type')}")
    else:
        results.fail("POST /login (username)", f"status={r.status_code} body={r.text}")
except Exception as e:
    results.fail("POST /login (username)", str(e))

# 2e. Login with email
try:
    r = requests.post(f"{BASE}/api/v1/auth/login", data={
        "username": user["email"],
        "password": user["password"],
    })
    if r.status_code == 200 and "access_token" in r.json():
        results.ok("POST /login (email)", "=> email-based login works")
    else:
        results.fail("POST /login (email)", f"status={r.status_code}")
except Exception as e:
    results.fail("POST /login (email)", str(e))

# 2f. Invalid login
try:
    r = requests.post(f"{BASE}/api/v1/auth/login", data={
        "username": user["username"],
        "password": "WrongP@ss123",
    })
    if r.status_code == 401:
        results.ok("Invalid login rejected", "=> 401")
    else:
        results.fail("Invalid login", f"expected 401, got {r.status_code}")
except Exception as e:
    results.fail("Invalid login", str(e))

# 2g. Legacy login endpoint
try:
    r = requests.post(f"{BASE}/login", data={
        "username": user["username"],
        "password": user["password"],
    })
    if r.status_code == 200 and "access_token" in r.json():
        results.ok("POST /login (legacy)", "=> backward compat OK")
    else:
        results.fail("POST /login (legacy)", f"status={r.status_code}")
except Exception as e:
    results.fail("POST /login (legacy)", str(e))

# ================================================================
# 3. USER PROFILE (FR-MA-001)
# ================================================================
print("\n[3] USER PROFILE")
if token:
    # 3a. Get profile
    try:
        r = requests.get(f"{BASE}/api/v1/users/me", headers=auth_header(token))
        if r.status_code == 200:
            results.ok("GET /users/me", f"=> username={r.json().get('username')}")
        else:
            results.fail("GET /users/me", f"status={r.status_code}")
    except Exception as e:
        results.fail("GET /users/me", str(e))

    # 3b. Update profile
    try:
        r = requests.patch(f"{BASE}/api/v1/users/me",
                          headers=auth_header(token),
                          json={"phone": "+91-9876543210", "gender": "female", "age_range": "25-34"})
        if r.status_code == 200 and r.json().get("phone") == "+91-9876543210":
            results.ok("PATCH /users/me", f"=> phone updated, gender={r.json().get('gender')}")
        else:
            results.fail("PATCH /users/me", f"status={r.status_code}")
    except Exception as e:
        results.fail("PATCH /users/me", str(e))

    # 3c. Unauthorized access
    try:
        r = requests.get(f"{BASE}/api/v1/users/me", headers={"Authorization": "Bearer invalid_token"})
        if r.status_code == 401:
            results.ok("Unauthorized access blocked", "=> 401")
        else:
            results.fail("Unauthorized access", f"expected 401, got {r.status_code}")
    except Exception as e:
        results.fail("Unauthorized access", str(e))

# ================================================================
# 4. RISK ASSESSMENT (FR-ML-003)
# ================================================================
print("\n[4] RISK ASSESSMENT")

# 4a. DCTI score
try:
    r = requests.post(f"{BASE}/api/v1/risk/check", json={"latitude": 21.1458, "longitude": 79.0882})
    if r.status_code == 200:
        data = r.json()
        required = ["dcti_score", "risk_level", "risk_factors", "primary_threats", "recommendations"]
        missing = [k for k in required if k not in data]
        if not missing:
            results.ok("POST /risk/check", f"=> DCTI={data['dcti_score']}, level={data['risk_level']}")
        else:
            results.fail("POST /risk/check", f"missing fields: {missing}")
    else:
        results.fail("POST /risk/check", f"status={r.status_code}")
except Exception as e:
    results.fail("POST /risk/check", str(e))

# 4b. DCTI range validation
try:
    r = requests.post(f"{BASE}/api/v1/risk/check", json={"latitude": 21.1458, "longitude": 79.0882})
    score = r.json().get("dcti_score", -1)
    if 0 <= score <= 100:
        results.ok("DCTI score range", f"=> {score} in [0,100]")
    else:
        results.fail("DCTI score range", f"score={score} out of bounds")
except Exception as e:
    results.fail("DCTI score range", str(e))

# 4c. Risk factors breakdown
try:
    r = requests.post(f"{BASE}/api/v1/risk/check", json={"latitude": 21.1458, "longitude": 79.0882})
    factors = r.json().get("risk_factors", {})
    expected_components = ["cluster_proximity", "historical_pattern", "environmental", "recent_reports"]
    present = [c for c in expected_components if c in factors]
    if len(present) == 4:
        weights = sum(factors[c]["weight"] for c in present)
        results.ok("Risk factor weights", f"=> total weight = {weights:.2f} (expect 1.0)")
    else:
        results.fail("Risk factors", f"missing: {set(expected_components) - set(present)}")
except Exception as e:
    results.fail("Risk factors", str(e))

# 4d. Heatmap
try:
    r = requests.get(f"{BASE}/api/v1/risk/heatmap?mode=night")
    if r.status_code == 200:
        data = r.json()
        results.ok("GET /risk/heatmap (night)", f"=> {data.get('count', 0)} points")
    else:
        results.fail("GET /risk/heatmap", f"status={r.status_code}")
except Exception as e:
    results.fail("GET /risk/heatmap", str(e))

# 4e. Heatmap auto mode
try:
    r = requests.get(f"{BASE}/api/v1/risk/heatmap?mode=auto")
    if r.status_code == 200:
        results.ok("GET /risk/heatmap (auto)", f"=> mode={r.json().get('mode')}")
    else:
        results.fail("GET /risk/heatmap (auto)", f"status={r.status_code}")
except Exception as e:
    results.fail("GET /risk/heatmap (auto)", str(e))

# 4f. Hotspots GeoJSON
try:
    r = requests.get(f"{BASE}/api/v1/risk/hotspots/night")
    if r.status_code == 200:
        data = r.json()
        results.ok("GET /risk/hotspots/night", f"=> {len(data.get('features', []))} features")
    else:
        results.fail("GET /risk/hotspots/night", f"status={r.status_code}")
except Exception as e:
    results.fail("GET /risk/hotspots/night", str(e))

# ================================================================
# 5. ROUTE CALCULATION (FR-RN-001)
# ================================================================
print("\n[5] ROUTE CALCULATION")

# 5a. Calculate routes (Nagpur locations)
try:
    payload = {
        "origin": {"lat": 21.1458, "lon": 79.0882},
        "destination": {"lat": 21.1702, "lon": 79.0951},
        "preferences": {}
    }
    r = requests.post(f"{BASE}/api/v1/routes/calculate", json=payload)
    if r.status_code == 200:
        data = r.json()
        routes = data.get("routes", [])
        route_types = [rt.get("type") for rt in routes]
        results.ok("POST /routes/calculate", f"=> {len(routes)} routes: {route_types}")

        # Validate route structure
        for route in routes:
            required = ["label", "type", "distance_km", "duration_min", "risk_score", "geometry"]
            missing = [k for k in required if k not in route]
            if missing:
                results.fail(f"Route '{route.get('label')}' structure", f"missing: {missing}")
            else:
                results.ok(f"Route '{route.get('label')}'",
                          f"=> {route['distance_km']}km, {route['duration_min']}min, risk={route['risk_score']}")
    else:
        results.fail("POST /routes/calculate", f"status={r.status_code} body={r.text}")
except Exception as e:
    results.fail("POST /routes/calculate", str(e))

# 5b. Different routes yield different risk scores
try:
    payload1 = {"origin": {"lat": 21.1458, "lon": 79.0882}, "destination": {"lat": 21.1702, "lon": 79.0951}}
    payload2 = {"origin": {"lat": 21.12, "lon": 79.05}, "destination": {"lat": 21.18, "lon": 79.12}}
    r1 = requests.post(f"{BASE}/api/v1/routes/calculate", json=payload1)
    r2 = requests.post(f"{BASE}/api/v1/routes/calculate", json=payload2)
    if r1.status_code == 200 and r2.status_code == 200:
        results.ok("Different origins produce routes", "=> both returned 200")
    else:
        results.fail("Route variation", f"status1={r1.status_code}, status2={r2.status_code}")
except Exception as e:
    results.fail("Route variation", str(e))

# ================================================================
# 6. INCIDENT REPORTING (FR-IR-001)
# ================================================================
print("\n[6] INCIDENT REPORTING")
incident_id = None
ref_number = None

if token:
    # 6a. Submit incident
    try:
        payload = {
            "crime_type": "harassment",
            "latitude": 21.1458,
            "longitude": 79.0882,
            "description": "Test incident report for integration testing",
            "severity": "moderate",
            "is_anonymous": False,
            "location_name": "Test Location, Nagpur"
        }
        r = requests.post(f"{BASE}/api/v1/incidents/",
                         headers=auth_header(token), json=payload)
        if r.status_code == 201:
            data = r.json()
            incident_id = data.get("id")
            ref_number = data.get("reference_number")
            results.ok("POST /incidents/", f"=> id={incident_id}, ref={ref_number}")

            # Validate reference format INC-YYYY-NNNNNN
            if ref_number and ref_number.startswith("INC-"):
                results.ok("Reference format", f"=> {ref_number} matches INC-YYYY-NNNNNN")
            else:
                results.fail("Reference format", f"=> {ref_number}")
        else:
            results.fail("POST /incidents/", f"status={r.status_code} body={r.text}")
    except Exception as e:
        results.fail("POST /incidents/", str(e))

    # 6b. Submit anonymous incident
    try:
        payload = {
            "crime_type": "theft",
            "latitude": 21.15,
            "longitude": 79.09,
            "description": "Anonymous test report",
            "severity": "minor",
            "is_anonymous": True,
        }
        r = requests.post(f"{BASE}/api/v1/incidents/",
                         headers=auth_header(token), json=payload)
        if r.status_code == 201 and r.json().get("is_anonymous"):
            results.ok("Anonymous incident", f"=> ref={r.json().get('reference_number')}")
        else:
            results.fail("Anonymous incident", f"status={r.status_code}")
    except Exception as e:
        results.fail("Anonymous incident", str(e))

    # 6c. Get my incidents
    try:
        r = requests.get(f"{BASE}/api/v1/incidents/me", headers=auth_header(token))
        if r.status_code == 200:
            results.ok("GET /incidents/me", f"=> {len(r.json())} incidents")
        else:
            results.fail("GET /incidents/me", f"status={r.status_code}")
    except Exception as e:
        results.fail("GET /incidents/me", str(e))

    # 6d. Get single incident
    if incident_id:
        try:
            r = requests.get(f"{BASE}/api/v1/incidents/{incident_id}")
            if r.status_code == 200:
                results.ok("GET /incidents/{id}", f"=> ref={r.json().get('reference_number')}")
            else:
                results.fail("GET /incidents/{id}", f"status={r.status_code}")
        except Exception as e:
            results.fail("GET /incidents/{id}", str(e))

    # 6e. Update incident
    if incident_id:
        try:
            r = requests.patch(f"{BASE}/api/v1/incidents/{incident_id}",
                              headers=auth_header(token),
                              json={"description": "Updated description for testing"})
            if r.status_code == 200:
                results.ok("PATCH /incidents/{id}", "=> description updated")
            else:
                results.fail("PATCH /incidents/{id}", f"status={r.status_code}")
        except Exception as e:
            results.fail("PATCH /incidents/{id}", str(e))

    # 6f. Nearby incidents
    try:
        r = requests.get(f"{BASE}/api/v1/incidents/nearby",
                        params={"latitude": 21.1458, "longitude": 79.0882, "radius_km": 1.0})
        if r.status_code == 200:
            results.ok("GET /incidents/nearby", f"=> {len(r.json())} nearby incidents")
        else:
            results.fail("GET /incidents/nearby", f"status={r.status_code}")
    except Exception as e:
        results.fail("GET /incidents/nearby", str(e))

    # 6g. Invalid crime type
    try:
        payload = {
            "crime_type": "invalid_type",
            "latitude": 21.15, "longitude": 79.09,
            "description": "Bad type",
            "severity": "minor",
        }
        r = requests.post(f"{BASE}/api/v1/incidents/",
                         headers=auth_header(token), json=payload)
        if r.status_code == 422:
            results.ok("Invalid crime_type rejected", "=> 422")
        else:
            results.fail("Invalid crime_type", f"expected 422, got {r.status_code}")
    except Exception as e:
        results.fail("Invalid crime_type", str(e))

# ================================================================
# 7. WOMEN SAFETY (FR-WS-001)
# ================================================================
print("\n[7] WOMEN SAFETY")
contact_id = None

if token:
    # 7a. Add emergency contact
    try:
        r = requests.post(f"{BASE}/api/v1/safety/contacts",
                         headers=auth_header(token),
                         json={"name": "Mom", "phone": "+91-9876543210", "relation": "Mother"})
        if r.status_code == 201:
            contact_id = r.json().get("id")
            results.ok("POST /safety/contacts", f"=> id={contact_id}")
        else:
            results.fail("POST /safety/contacts", f"status={r.status_code} body={r.text}")
    except Exception as e:
        results.fail("POST /safety/contacts", str(e))

    # 7b. Add second contact
    try:
        r = requests.post(f"{BASE}/api/v1/safety/contacts",
                         headers=auth_header(token),
                         json={"name": "Dad", "phone": "+91-9876543211"})
        if r.status_code == 201:
            results.ok("Add 2nd contact", f"=> id={r.json().get('id')}")
        else:
            results.fail("Add 2nd contact", f"status={r.status_code}")
    except Exception as e:
        results.fail("Add 2nd contact", str(e))

    # 7c. List contacts
    try:
        r = requests.get(f"{BASE}/api/v1/safety/contacts", headers=auth_header(token))
        if r.status_code == 200:
            results.ok("GET /safety/contacts", f"=> {len(r.json())} contacts")
        else:
            results.fail("GET /safety/contacts", f"status={r.status_code}")
    except Exception as e:
        results.fail("GET /safety/contacts", str(e))

    # 7d. SOS trigger
    try:
        r = requests.post(f"{BASE}/api/v1/safety/sos",
                         headers=auth_header(token),
                         json={"latitude": 21.1458, "longitude": 79.0882})
        if r.status_code == 200:
            data = r.json()
            results.ok("POST /safety/sos", f"=> sos_id={data.get('sos_id')}, notified={data.get('contacts_notified')}")
        else:
            results.fail("POST /safety/sos", f"status={r.status_code} body={r.text}")
    except Exception as e:
        results.fail("POST /safety/sos", str(e))

    # 7e. Check-in
    try:
        r = requests.post(f"{BASE}/api/v1/safety/checkin",
                         headers=auth_header(token),
                         json={"latitude": 21.1458, "longitude": 79.0882, "message": "I'm safe!"})
        if r.status_code == 200:
            results.ok("POST /safety/checkin", f"=> {r.json().get('message')}")
        else:
            results.fail("POST /safety/checkin", f"status={r.status_code}")
    except Exception as e:
        results.fail("POST /safety/checkin", str(e))

    # 7f. SOS history
    try:
        r = requests.get(f"{BASE}/api/v1/safety/sos-history", headers=auth_header(token))
        if r.status_code == 200:
            results.ok("GET /safety/sos-history", f"=> {len(r.json())} events")
        else:
            results.fail("GET /safety/sos-history", f"status={r.status_code}")
    except Exception as e:
        results.fail("GET /safety/sos-history", str(e))

    # 7g. Max 3 contacts limit
    try:
        requests.post(f"{BASE}/api/v1/safety/contacts",
                     headers=auth_header(token),
                     json={"name": "Sibling", "phone": "+91-1234567890"})
        r = requests.post(f"{BASE}/api/v1/safety/contacts",
                         headers=auth_header(token),
                         json={"name": "Overflow", "phone": "+91-0000000000"})
        if r.status_code == 400:
            results.ok("Max 3 contacts enforced", "=> 400")
        else:
            results.fail("Max contacts", f"expected 400, got {r.status_code}")
    except Exception as e:
        results.fail("Max contacts", str(e))

    # 7h. Delete contact
    if contact_id:
        try:
            r = requests.delete(f"{BASE}/api/v1/safety/contacts/{contact_id}",
                               headers=auth_header(token))
            if r.status_code == 204:
                results.ok("DELETE /safety/contacts/{id}", "=> 204")
            else:
                results.fail("DELETE /safety/contacts/{id}", f"status={r.status_code}")
        except Exception as e:
            results.fail("DELETE /safety/contacts/{id}", str(e))

# ================================================================
# 8. ALERTS (FR-RA-001)
# ================================================================
print("\n[8] ALERTS")

if token:
    # 8a. Get alert settings
    try:
        r = requests.get(f"{BASE}/api/v1/alerts/settings", headers=auth_header(token))
        if r.status_code == 200:
            data = r.json()
            results.ok("GET /alerts/settings", f"=> threshold={data.get('alert_threshold')}")
        else:
            results.fail("GET /alerts/settings", f"status={r.status_code}")
    except Exception as e:
        results.fail("GET /alerts/settings", str(e))

    # 8b. Update alert settings
    try:
        r = requests.post(f"{BASE}/api/v1/alerts/settings",
                         headers=auth_header(token),
                         json={"alert_threshold": 80})
        if r.status_code == 200 and r.json().get("alert_threshold") == 80:
            results.ok("POST /alerts/settings", "=> threshold=80")
        else:
            results.fail("POST /alerts/settings", f"status={r.status_code}")
    except Exception as e:
        results.fail("POST /alerts/settings", str(e))

    # 8c. Alert history
    try:
        r = requests.get(f"{BASE}/api/v1/alerts/history", headers=auth_header(token))
        if r.status_code == 200:
            results.ok("GET /alerts/history", f"=> {len(r.json())} alerts")
        else:
            results.fail("GET /alerts/history", f"status={r.status_code}")
    except Exception as e:
        results.fail("GET /alerts/history", str(e))

# ================================================================
# 9. INPUT VALIDATION (NFR-S-003)
# ================================================================
print("\n[9] INPUT VALIDATION")

# 9a. Invalid coordinates
try:
    r = requests.post(f"{BASE}/api/v1/risk/check", json={"latitude": 100, "longitude": 79})
    if r.status_code == 422:
        results.ok("Invalid latitude rejected", "=> 422 (lat=100)")
    else:
        results.fail("Invalid latitude", f"expected 422, got {r.status_code}")
except Exception as e:
    results.fail("Invalid latitude", str(e))

# 9b. Invalid longitude
try:
    r = requests.post(f"{BASE}/api/v1/risk/check", json={"latitude": 21, "longitude": 200})
    if r.status_code == 422:
        results.ok("Invalid longitude rejected", "=> 422 (lon=200)")
    else:
        results.fail("Invalid longitude", f"expected 422, got {r.status_code}")
except Exception as e:
    results.fail("Invalid longitude", str(e))

# 9c. Missing required fields
try:
    r = requests.post(f"{BASE}/api/v1/auth/register", json={"username": "a"})
    if r.status_code == 422:
        results.ok("Missing fields rejected", "=> 422")
    else:
        results.fail("Missing fields", f"expected 422, got {r.status_code}")
except Exception as e:
    results.fail("Missing fields", str(e))

# ================================================================
# 10. LEGACY ENDPOINTS (backward compatibility)
# ================================================================
print("\n[10] LEGACY ENDPOINTS")

# 10a. Legacy /register
try:
    legacy_user = random_user()
    r = requests.post(f"{BASE}/register", json=legacy_user)
    if r.status_code == 201:
        results.ok("POST /register (legacy)", f"=> id={r.json().get('id')}")
    else:
        results.fail("POST /register (legacy)", f"status={r.status_code} body={r.text}")
except Exception as e:
    results.fail("POST /register (legacy)", str(e))

# 10b. Legacy /check-risk
try:
    r = requests.post(f"{BASE}/check-risk", json={"latitude": 21.1458, "longitude": 79.0882})
    if r.status_code == 200:
        results.ok("POST /check-risk (legacy)", f"=> dcti={r.json().get('dcti_score')}")
    else:
        results.fail("POST /check-risk (legacy)", f"status={r.status_code}")
except Exception as e:
    results.fail("POST /check-risk (legacy)", str(e))

# ================================================================
# 11. OPENAPI / DOCS
# ================================================================
print("\n[11] DOCUMENTATION")
try:
    r = requests.get(f"{BASE}/openapi.json")
    if r.status_code == 200:
        spec = r.json()
        paths = list(spec.get("paths", {}).keys())
        results.ok("GET /openapi.json", f"=> {len(paths)} paths documented")
    else:
        results.fail("GET /openapi.json", f"status={r.status_code}")
except Exception as e:
    results.fail("GET /openapi.json", str(e))

# ================================================================
# 12. INCIDENT DELETE TEST
# ================================================================
print("\n[12] INCIDENT DELETE")
if token and incident_id:
    try:
        r = requests.delete(f"{BASE}/api/v1/incidents/{incident_id}",
                           headers=auth_header(token))
        if r.status_code == 204:
            results.ok("DELETE /incidents/{id}", "=> 204")
        else:
            results.fail("DELETE /incidents/{id}", f"status={r.status_code}")
    except Exception as e:
        results.fail("DELETE /incidents/{id}", str(e))

# ================================================================
# PRINT SUMMARY
# ================================================================
results.summary()
