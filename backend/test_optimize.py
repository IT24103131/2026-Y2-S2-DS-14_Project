"""
test_optimize.py  —  backend/
Tests for the itinerary route optimizer.

Run with:  pytest test_optimize.py -v
Requires the backend app.py (port 8000) to be importable.
All tests use the Flask test client — no live server needed.
"""

import sys
import os
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pytest
# Import the backend app (the one that runs on port 8000)
# which has routes, location_routes, hotel_routes, itinerary_routes registered
from app import app   # backend/app.py


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def get_token(client):
    """Register + login a unique test user, return JWT token."""
    unique = uuid.uuid4().hex[:8]
    client.post("/register", json={
        "username": f"optuser_{unique}",
        "email":    f"optuser_{unique}@test.com",
        "password": "testpass123",
    })
    res = client.post("/login", json={
        "username": f"optuser_{unique}",
        "password": "testpass123",
    })
    data = res.get_json()
    return data.get("access_token"), f"optuser_{unique}"


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def setup_user_with_quiz_and_locations(client):
    """
    Helper: creates a user, saves quiz result (needed for planner-data),
    saves locations (needed for optimize), and returns the token.
    """
    token, _ = get_token(client)
    headers  = auth(token)

    # Save personality/quiz result
    client.post("/personality", json={
        "openness_score":          7.0,
        "conscientiousness_score": 6.0,
        "extraversion_score":      8.0,
        "agreeableness_score":     5.0,
        "neuroticism_score":       3.0,
        "personality_type":        "adventurous explorer",
        "duration":                "Medium (6-10 days)",
    }, headers=headers)

    # Save locations as a list (correct format)
    client.post("/locations/save-selection", json={
        "selected_destinations": ["Sigiriya", "Ella", "Kandy"]
    }, headers=headers)

    return token


# ── Optimizer tests ────────────────────────────────────────────────────────────

def test_optimize_requires_auth(client):
    """Optimize without token should return 401."""
    res = client.post("/itineraries/optimize", json={
        "n_days": 3, "budget_usd": 500, "starting_point": "colombo"
    })
    assert res.status_code == 401


def test_planner_data_requires_auth(client):
    """Planner data without token should return 401."""
    res = client.get("/itineraries/planner-data")
    assert res.status_code == 401


def test_planner_data_returns_structure(client):
    """Planner data endpoint returns expected keys."""
    token = setup_user_with_quiz_and_locations(client)
    res   = client.get("/itineraries/planner-data", headers=auth(token))
    assert res.status_code == 200
    data = res.get_json()
    assert "locations"      in data
    assert "default_days"   in data
    assert "location_count" in data


def test_optimize_success(client):
    """Optimize with valid saved locations should return 200 and route data."""
    token = setup_user_with_quiz_and_locations(client)
    res   = client.post("/itineraries/optimize", json={
        "n_days"        : 3,
        "budget_usd"    : 500,
        "starting_point": "colombo",
    }, headers=auth(token))
    assert res.status_code == 200
    data = res.get_json()
    assert data.get("success") is True
    assert "ordered_clusters"  in data
    assert "total_distance_km" in data
    assert "n_days"            in data


def test_optimize_saves_itinerary(client):
    """Optimized itinerary should be saved and appear in /itineraries."""
    token = setup_user_with_quiz_and_locations(client)
    client.post("/itineraries/optimize", json={
        "n_days": 2, "budget_usd": 300, "starting_point": "colombo"
    }, headers=auth(token))

    res = client.get("/itineraries", headers=auth(token))
    assert res.status_code == 200
    assert len(res.get_json()) >= 1


def test_optimize_bad_n_days(client):
    """n_days less than 1 should return 400."""
    token = setup_user_with_quiz_and_locations(client)
    res   = client.post("/itineraries/optimize", json={
        "n_days": 0, "budget_usd": 500, "starting_point": "colombo"
    }, headers=auth(token))
    assert res.status_code == 400


def test_optimize_no_locations(client):
    """Optimize without any saved locations should return 400."""
    token, _ = get_token(client)
    # Save quiz but NO locations
    client.post("/personality", json={
        "openness_score": 5.0, "conscientiousness_score": 5.0,
        "extraversion_score": 5.0, "agreeableness_score": 5.0,
        "neuroticism_score": 5.0, "personality_type": "balanced traveler",
        "duration": "Short (1-5 days)",
    }, headers=auth(token))

    res = client.post("/itineraries/optimize", json={
        "n_days": 3, "budget_usd": 500, "starting_point": "colombo"
    }, headers=auth(token))
    assert res.status_code == 400


def test_optimize_budget_breakdown_present(client):
    """Budget breakdown should be included in optimize response."""
    token = setup_user_with_quiz_and_locations(client)
    res   = client.post("/itineraries/optimize", json={
        "n_days": 3, "budget_usd": 600, "starting_point": "colombo"
    }, headers=auth(token))
    assert res.status_code == 200
    data = res.get_json()
    assert "budget_breakdown" in data
    bd = data["budget_breakdown"]
    assert "total_estimate_usd"  in bd
    assert "budget_provided_usd" in bd
    assert "within_budget"       in bd


def test_optimize_different_starting_points(client):
    """Optimizer should accept different starting points."""
    token = setup_user_with_quiz_and_locations(client)
    for start in ["colombo", "negombo", "kandy"]:
        res = client.post("/itineraries/optimize", json={
            "n_days": 2, "budget_usd": 400, "starting_point": start
        }, headers=auth(token))
        assert res.status_code == 200, f"Failed for starting_point={start}"
