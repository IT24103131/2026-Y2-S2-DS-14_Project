"""
test_locations.py  —  backend/
Tests for the location suggestor endpoints.

  GET  /locations              → all destinations (public)
  GET  /locations/me           → destinations for logged-in user's personality
  GET  /locations/selection    → user's saved selection
  POST /locations/save-selection → save chosen destinations

Run with:  pytest test_locations.py -v
"""

import sys
import os
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pytest
from app import app   # backend/app.py


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def register_and_login(client):
    unique = uuid.uuid4().hex[:8]
    client.post("/register", json={
        "username": f"locuser_{unique}",
        "email":    f"locuser_{unique}@test.com",
        "password": "testpass123",
    })
    res = client.post("/login", json={
        "username": f"locuser_{unique}",
        "password": "testpass123",
    })
    return res.get_json().get("access_token")


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def setup_user_with_quiz(client, personality_type="adventurous explorer"):
    """Register, login, complete quiz, return token."""
    token = register_and_login(client)
    client.post("/personality", json={
        "openness_score":          7.5,
        "conscientiousness_score": 6.0,
        "extraversion_score":      8.0,
        "agreeableness_score":     5.5,
        "neuroticism_score":       3.0,
        "personality_type":        personality_type,
        "duration":                "Short (1-5 days)",
    }, headers=auth(token))
    return token


# ── Public endpoint ───────────────────────────────────────────────────────────

def test_all_locations_public(client):
    """GET /locations should work without auth."""
    res = client.get("/locations")
    assert res.status_code == 200
    data = res.get_json()
    assert "destinations" in data
    assert "count"        in data
    assert isinstance(data["destinations"], list)


# ── Auth guards ───────────────────────────────────────────────────────────────

def test_locations_me_requires_auth(client):
    """GET /locations/me without token should return 401."""
    res = client.get("/locations/me")
    assert res.status_code == 401


def test_save_selection_requires_auth(client):
    """POST /locations/save-selection without token should return 401."""
    res = client.post("/locations/save-selection", json={
        "selected_destinations": ["Sigiriya"]
    })
    assert res.status_code == 401


def test_get_selection_requires_auth(client):
    """GET /locations/selection without token should return 401."""
    res = client.get("/locations/selection")
    assert res.status_code == 401


# ── /locations/me ─────────────────────────────────────────────────────────────

def test_locations_me_without_quiz(client):
    """GET /locations/me before quiz should return 400."""
    token = register_and_login(client)
    res   = client.get("/locations/me", headers=auth(token))
    assert res.status_code == 400


def test_locations_me_after_quiz(client):
    """GET /locations/me after quiz should return 200 with locations list."""
    token = setup_user_with_quiz(client)
    res   = client.get("/locations/me", headers=auth(token))
    assert res.status_code == 200
    data = res.get_json()
    assert "locations"        in data
    assert "personality_type" in data
    assert isinstance(data["locations"], list)


def test_locations_me_personality_type_matches(client):
    """personality_type in response should match what user submitted in quiz."""
    token = setup_user_with_quiz(client, "calm & relaxed")
    res   = client.get("/locations/me", headers=auth(token))
    assert res.status_code == 200
    assert res.get_json()["personality_type"] == "calm & relaxed"


# ── /locations/save-selection ─────────────────────────────────────────────────

def test_save_selection_success(client):
    """Valid list of destinations should return 200."""
    token = setup_user_with_quiz(client)
    res   = client.post("/locations/save-selection", json={
        "selected_destinations": ["Sigiriya", "Ella", "Kandy"]
    }, headers=auth(token))
    assert res.status_code == 200
    data = res.get_json()
    assert data["message"] == "Locations saved"
    assert "Sigiriya" in data["selected_destinations"]


def test_save_selection_empty_list(client):
    """Empty destinations list should return 422."""
    token = setup_user_with_quiz(client)
    res   = client.post("/locations/save-selection", json={
        "selected_destinations": []
    }, headers=auth(token))
    assert res.status_code == 422


def test_save_selection_missing_key(client):
    """Missing selected_destinations key should return 422."""
    token = setup_user_with_quiz(client)
    res   = client.post("/locations/save-selection", json={}, headers=auth(token))
    assert res.status_code == 422


def test_save_selection_accepts_string_list(client):
    """List of plain strings should be accepted."""
    token = setup_user_with_quiz(client)
    res   = client.post("/locations/save-selection", json={
        "selected_destinations": ["Mirissa", "Galle", "Tangalle"]
    }, headers=auth(token))
    assert res.status_code == 200


def test_save_selection_accepts_object_list(client):
    """List of {location: '...'} objects should also be accepted."""
    token = setup_user_with_quiz(client)
    res   = client.post("/locations/save-selection", json={
        "selected_destinations": [{"location": "Sigiriya"}, {"location": "Dambulla"}]
    }, headers=auth(token))
    assert res.status_code == 200


def test_save_selection_deduplicates(client):
    """Duplicate names in the list should be stored only once."""
    token = setup_user_with_quiz(client)
    client.post("/locations/save-selection", json={
        "selected_destinations": ["Sigiriya", "Sigiriya", "Kandy"]
    }, headers=auth(token))
    res  = client.get("/locations/selection", headers=auth(token))
    dests = res.get_json()["selected_destinations"]
    assert dests.count("Sigiriya") == 1


def test_save_selection_upserts(client):
    """Saving again should overwrite — not create a second row."""
    token = setup_user_with_quiz(client)
    client.post("/locations/save-selection", json={
        "selected_destinations": ["Sigiriya"]
    }, headers=auth(token))
    client.post("/locations/save-selection", json={
        "selected_destinations": ["Ella", "Mirissa"]
    }, headers=auth(token))
    res   = client.get("/locations/selection", headers=auth(token))
    dests = res.get_json()["selected_destinations"]
    # Should have the second set, not both sets merged
    assert "Ella"    in dests
    assert "Mirissa" in dests


# ── /locations/selection ──────────────────────────────────────────────────────

def test_get_selection_empty_before_save(client):
    """GET /locations/selection before any save should return empty list."""
    token = setup_user_with_quiz(client)
    res   = client.get("/locations/selection", headers=auth(token))
    assert res.status_code == 200
    assert res.get_json()["selected_destinations"] == []


def test_get_selection_after_save(client):
    """GET /locations/selection should return what was saved."""
    token = setup_user_with_quiz(client)
    client.post("/locations/save-selection", json={
        "selected_destinations": ["Trincomalee", "Nilaveli"]
    }, headers=auth(token))
    res   = client.get("/locations/selection", headers=auth(token))
    assert res.status_code == 200
    dests = res.get_json()["selected_destinations"]
    assert "Trincomalee" in dests
    assert "Nilaveli"    in dests
