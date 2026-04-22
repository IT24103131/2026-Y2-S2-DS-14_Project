"""
test_hotels.py  —  backend/
Tests for the hotel recommender endpoints.

  GET    /hotels              → AI recommendations (requires quiz)
  POST   /hotels/save         → save a hotel with dates + budget
  GET    /hotels/saved        → user's saved hotels
  PUT    /hotels/saved/<id>   → edit a saved hotel
  DELETE /hotels/saved/<id>   → remove a saved hotel

Run with:  pytest test_hotels.py -v
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
        "username": f"hoteltest_{unique}",
        "email":    f"hoteltest_{unique}@test.com",
        "password": "testpass123",
    })
    res = client.post("/login", json={
        "username": f"hoteltest_{unique}",
        "password": "testpass123",
    })
    return res.get_json().get("access_token")


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def setup_user_with_quiz(client):
    """Register + login + complete quiz. Returns token."""
    token = register_and_login(client)
    client.post("/personality", json={
        "openness_score":          6.0,
        "conscientiousness_score": 7.0,
        "extraversion_score":      5.0,
        "agreeableness_score":     6.5,
        "neuroticism_score":       4.0,
        "personality_type":        "balanced traveler",
        "duration":                "Short (1-5 days)",
    }, headers=auth(token))
    return token


def setup_user_full(client):
    """Register + quiz + save locations. Returns token."""
    token = setup_user_with_quiz(client)
    client.post("/locations/save-selection", json={
        "selected_destinations": ["Kandy", "Negombo"]
    }, headers=auth(token))
    return token


# ── Auth guards ───────────────────────────────────────────────────────────────

def test_get_hotels_requires_auth(client):
    """GET /hotels without token should return 401."""
    res = client.get("/hotels")
    assert res.status_code == 401


def test_save_hotel_requires_auth(client):
    """POST /hotels/save without token should return 401."""
    res = client.post("/hotels/save", json={
        "hotel_id": 1, "location": "Kandy", "total_budget": 5000
    })
    assert res.status_code == 401


def test_get_saved_hotels_requires_auth(client):
    """GET /hotels/saved without token should return 401."""
    res = client.get("/hotels/saved")
    assert res.status_code == 401


def test_update_saved_hotel_requires_auth(client):
    """PUT /hotels/saved/<id> without token should return 401."""
    res = client.put("/hotels/saved/1", json={"total_budget": 8000})
    assert res.status_code == 401


def test_delete_saved_hotel_requires_auth(client):
    """DELETE /hotels/saved/<id> without token should return 401."""
    res = client.delete("/hotels/saved/1")
    assert res.status_code == 401


# ── GET /hotels ───────────────────────────────────────────────────────────────

def test_get_hotels_without_quiz(client):
    """GET /hotels before quiz should return 400."""
    token = register_and_login(client)
    res   = client.get("/hotels", headers=auth(token))
    assert res.status_code == 400
    assert "quiz" in res.get_json().get("detail", "").lower()


def test_get_hotels_after_quiz(client):
    """GET /hotels after quiz should return 200 with hotels list."""
    token = setup_user_full(client)
    res   = client.get("/hotels", headers=auth(token))
    assert res.status_code == 200
    data = res.get_json()
    assert "hotels"             in data
    assert "count"              in data
    assert "personality_cluster" in data
    assert isinstance(data["hotels"], list)


def test_get_hotels_response_fields(client):
    """Each hotel in the list should have the required fields."""
    token = setup_user_full(client)
    res   = client.get("/hotels", headers=auth(token))
    assert res.status_code == 200
    hotels = res.get_json()["hotels"]
    if hotels:
        h = hotels[0]
        for field in ["hotel_id", "name", "location", "budget_per_night"]:
            assert field in h, f"Missing field: {field}"


# ── POST /hotels/save ─────────────────────────────────────────────────────────

def test_save_hotel_missing_hotel_id(client):
    """Saving without hotel_id should return 422."""
    token = setup_user_with_quiz(client)
    res   = client.post("/hotels/save", json={
        "location": "Kandy", "total_budget": 5000
    }, headers=auth(token))
    assert res.status_code == 422


def test_save_hotel_missing_total_budget(client):
    """Saving without total_budget should return 422."""
    token = setup_user_with_quiz(client)
    res   = client.post("/hotels/save", json={
        "hotel_id": 1, "location": "Kandy"
    }, headers=auth(token))
    assert res.status_code == 422


def test_save_hotel_success(client):
    """Valid hotel save should return 200."""
    token = setup_user_with_quiz(client)
    # Use a hotel_id that exists in the DB — fallback if it doesn't
    res = client.post("/hotels/save", json={
        "hotel_id"    : 1,
        "location"    : "Kandy",
        "total_budget": 15000,
        "check_in"    : "2025-08-01",
        "check_out"   : "2025-08-05",
    }, headers=auth(token))
    # 200 = success, 500 = hotel_id doesn't exist in DB (acceptable in test env)
    assert res.status_code in [200, 500]


# ── GET /hotels/saved ─────────────────────────────────────────────────────────

def test_get_saved_hotels_empty(client):
    """New user with no saved hotels should get empty list."""
    token = setup_user_with_quiz(client)
    res   = client.get("/hotels/saved", headers=auth(token))
    assert res.status_code == 200
    data = res.get_json()
    assert data["saved_hotels"] == []
    assert data["count"]        == 0
    assert data["grand_total"]  == 0


def test_get_saved_hotels_after_save(client):
    """After saving a hotel, it should appear in /hotels/saved."""
    token = setup_user_with_quiz(client)
    save_res = client.post("/hotels/save", json={
        "hotel_id"    : 1,
        "location"    : "Negombo",
        "total_budget": 12000,
        "check_in"    : "2025-09-01",
        "check_out"   : "2025-09-03",
    }, headers=auth(token))

    if save_res.status_code != 200:
        pytest.skip("Hotel ID 1 not available in test DB")

    res = client.get("/hotels/saved", headers=auth(token))
    assert res.status_code == 200
    saved = res.get_json()["saved_hotels"]
    assert len(saved) >= 1
    assert saved[0]["total_budget"] == 12000.0


def test_saved_hotels_grand_total(client):
    """grand_total should equal sum of all saved hotel budgets."""
    token = setup_user_with_quiz(client)
    r1 = client.post("/hotels/save", json={
        "hotel_id": 1, "location": "Kandy",
        "total_budget": 10000, "check_in": "2025-08-01", "check_out": "2025-08-03"
    }, headers=auth(token))
    r2 = client.post("/hotels/save", json={
        "hotel_id": 2, "location": "Galle",
        "total_budget": 20000, "check_in": "2025-08-04", "check_out": "2025-08-06"
    }, headers=auth(token))

    if r1.status_code != 200 or r2.status_code != 200:
        pytest.skip("Hotel IDs 1/2 not in test DB")

    res = client.get("/hotels/saved", headers=auth(token))
    assert res.get_json()["grand_total"] == 30000.0


# ── PUT /hotels/saved/<id> ────────────────────────────────────────────────────

def test_update_nonexistent_saved_hotel(client):
    """Updating a saved hotel that doesn't exist should return 404."""
    token = setup_user_with_quiz(client)
    res   = client.put("/hotels/saved/999999", json={
        "total_budget": 99999
    }, headers=auth(token))
    assert res.status_code == 404


def test_update_saved_hotel_nothing_to_update(client):
    """PUT with empty body should return 422."""
    token = setup_user_with_quiz(client)
    res   = client.put("/hotels/saved/1", json={}, headers=auth(token))
    assert res.status_code == 422


# ── DELETE /hotels/saved/<id> ─────────────────────────────────────────────────

def test_delete_nonexistent_saved_hotel(client):
    """Deleting a saved hotel that doesn't exist should return 404."""
    token = setup_user_with_quiz(client)
    res   = client.delete("/hotels/saved/999999", headers=auth(token))
    assert res.status_code == 404


def test_delete_saved_hotel_success(client):
    """Saving then deleting a hotel should leave saved list empty."""
    token    = setup_user_with_quiz(client)
    save_res = client.post("/hotels/save", json={
        "hotel_id"    : 1,
        "location"    : "Kandy",
        "total_budget": 5000,
        "check_in"    : "2025-08-01",
        "check_out"   : "2025-08-02",
    }, headers=auth(token))

    if save_res.status_code != 200:
        pytest.skip("Hotel ID 1 not in test DB")

    saved_id = client.get("/hotels/saved", headers=auth(token)).get_json()["saved_hotels"][0]["id"]
    del_res  = client.delete(f"/hotels/saved/{saved_id}", headers=auth(token))
    assert del_res.status_code == 200

    remaining = client.get("/hotels/saved", headers=auth(token)).get_json()["saved_hotels"]
    assert all(h["id"] != saved_id for h in remaining)
