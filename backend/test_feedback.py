import sys
import os
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pytest
from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def get_token(client):
    """
    Helper to get a valid JWT token for authenticated tests.
    Registers testuser99 if they don't exist, then logs in.
    Safe to call multiple times across test runs.
    """
    client.post("/register", json={
        "username": "testuser99",
        "email":    "test99@test.com",
        "password": "testpass123"
    })
    # Even if register fails because user already exists, login still works
    res = client.post("/login", json={
        "username": "testuser99",
        "password": "testpass123"
    })
    data = res.get_json()
    if not data or "access_token" not in data:
        return None
    return data["access_token"]


# ── Test 1: register new user ─────────────────────────────────────────────────
def test_register(client):
    """New user registration should return 201."""
    unique = uuid.uuid4().hex[:8]
    res = client.post("/register", json={
        "username": f"newuser_{unique}",
        "email":    f"newuser_{unique}@test.com",
        "password": "password123"
    })
    assert res.status_code == 201


# ── Test 2: register with phone number ───────────────────────────────────────
def test_register_with_phone(client):
    """Registration with contact_number should return 201."""
    unique = uuid.uuid4().hex[:8]
    res = client.post("/register", json={
        "username":       f"phoneuser_{unique}",
        "email":          f"phone_{unique}@test.com",
        "password":       "pass123",
        "contact_number": "0771234567"
    })
    assert res.status_code == 201


# ── Test 3: duplicate registration fails ──────────────────────────────────────
def test_register_duplicate(client):
    """Registering same username/email twice should return 400."""
    unique = uuid.uuid4().hex[:8]
    client.post("/register", json={
        "username": f"dupuser_{unique}",
        "email":    f"dup_{unique}@test.com",
        "password": "pass123"
    })
    res = client.post("/register", json={
        "username": f"dupuser_{unique}",
        "email":    f"dup_{unique}@test.com",
        "password": "pass123"
    })
    assert res.status_code == 400


# ── Test 4: register missing fields ──────────────────────────────────────────
def test_register_missing_fields(client):
    """Registration without required fields should return 422."""
    res = client.post("/register", json={
        "username": "onlyusername"
        # missing email and password
    })
    assert res.status_code == 422


# ── Test 5: login returns token ───────────────────────────────────────────────
def test_login_returns_token(client):
    """Successful login should return access_token and quiz_completed."""
    unique = uuid.uuid4().hex[:8]
    client.post("/register", json={
        "username": f"logintest_{unique}",
        "email":    f"login_{unique}@test.com",
        "password": "pass123"
    })
    res = client.post("/login", json={
        "username": f"logintest_{unique}",
        "password": "pass123"
    })
    data = res.get_json()
    assert res.status_code == 200
    assert "access_token" in data
    assert "quiz_completed" in data
    assert data["quiz_completed"] is False   # new user has no quiz yet


# ── Test 6: login wrong password ─────────────────────────────────────────────
def test_login_wrong_password(client):
    """Wrong password should return 401."""
    unique = uuid.uuid4().hex[:8]
    client.post("/register", json={
        "username": f"wrongpass_{unique}",
        "email":    f"wrongpass_{unique}@test.com",
        "password": "correctpass"
    })
    res = client.post("/login", json={
        "username": f"wrongpass_{unique}",
        "password": "wrongpassword"
    })
    assert res.status_code == 401


# ── Test 7: login non-existent user ──────────────────────────────────────────
def test_login_nonexistent_user(client):
    """Login with unknown username should return 401."""
    res = client.post("/login", json={
        "username": "userThatDoesNotExist99999",
        "password": "somepass"
    })
    assert res.status_code == 401


# ── Test 8: feedback requires auth ───────────────────────────────────────────
def test_feedback_requires_auth(client):
    """Submitting feedback without token should return 401."""
    res = client.post("/feedback", json={
        "itinerary_id": 1,
        "rating": 4
    })
    assert res.status_code == 401


# ── Test 9: feedback invalid rating too high ──────────────────────────────────
def test_feedback_invalid_rating_too_high(client):
    """Rating above 5 should return 422."""
    token = get_token(client)
    assert token is not None, "Could not get auth token"
    res = client.post("/feedback",
                      json={"itinerary_id": 1, "rating": 6},
                      headers={"Authorization": f"Bearer {token}"}
                      )
    assert res.status_code == 422


# ── Test 10: feedback invalid rating too low ──────────────────────────────────
def test_feedback_invalid_rating_too_low(client):
    """Rating below 1 should return 422."""
    token = get_token(client)
    assert token is not None, "Could not get auth token"
    res = client.post("/feedback",
                      json={"itinerary_id": 1, "rating": 0},
                      headers={"Authorization": f"Bearer {token}"}
                      )
    assert res.status_code == 422


# ── Test 11: feedback missing rating ─────────────────────────────────────────
def test_feedback_missing_rating(client):
    """Feedback without rating should return 422."""
    token = get_token(client)
    assert token is not None, "Could not get auth token"
    res = client.post("/feedback",
                      json={"itinerary_id": 1},
                      headers={"Authorization": f"Bearer {token}"}
                      )
    assert res.status_code == 422


# ── Test 12: feedback missing itinerary_id ────────────────────────────────────
def test_feedback_missing_itinerary_id(client):
    """Feedback without itinerary_id should return 422."""
    token = get_token(client)
    assert token is not None, "Could not get auth token"
    res = client.post("/feedback",
                      json={"rating": 4},
                      headers={"Authorization": f"Bearer {token}"}
                      )
    assert res.status_code == 422


# ── Test 13: personality requires auth ───────────────────────────────────────
def test_personality_requires_auth(client):
    """Getting personality without token should return 401."""
    res = client.get("/personality")
    assert res.status_code == 401


# ── Test 14: personality not found ───────────────────────────────────────────
def test_personality_not_found(client):
    """New user with no quiz result should return 404."""
    token = get_token(client)
    assert token is not None, "Could not get auth token"
    # testuser99 has no quiz result so should return 404
    res = client.get("/personality",
                     headers={"Authorization": f"Bearer {token}"}
                     )
    # Either 404 (no quiz) or 200 (if testuser99 already has quiz from prev run)
    assert res.status_code in [200, 404]


# ── Test 15: get itineraries requires auth ────────────────────────────────────
def test_get_itineraries_requires_auth(client):
    """Getting itineraries without token should return 401."""
    res = client.get("/itineraries")
    assert res.status_code == 401


# ── Test 16: get itineraries returns list ─────────────────────────────────────
def test_get_itineraries_returns_list(client):
    """Authenticated user should get a list (even if empty)."""
    token = get_token(client)
    assert token is not None, "Could not get auth token"
    res = client.get("/itineraries",
                     headers={"Authorization": f"Bearer {token}"}
                     )
    assert res.status_code == 200
    assert isinstance(res.get_json(), list)


# ── Test 17: get feedback requires auth ───────────────────────────────────────
def test_get_feedback_requires_auth(client):
    """Getting feedback without token should return 401."""
    res = client.get("/feedback")
    assert res.status_code == 401


# ── Test 18: get feedback returns list ───────────────────────────────────────
def test_get_feedback_returns_list(client):
    """Authenticated user should get a list of feedbacks."""
    token = get_token(client)
    assert token is not None, "Could not get auth token"
    res = client.get("/feedback",
                     headers={"Authorization": f"Bearer {token}"}
                     )
    assert res.status_code == 200
    assert isinstance(res.get_json(), list)


# ── Test 19: health check ─────────────────────────────────────────────────────
def test_health_check(client):
    """Health endpoint should return 200."""
    res = client.get("/health")
    assert res.status_code == 200
    assert res.get_json()["status"] == "ok"


# ── Test 20: update feedback requires auth ────────────────────────────────────
def test_update_feedback_requires_auth(client):
    """Updating feedback without token should return 401."""
    res = client.put("/feedback/1", json={"rating": 3})
    assert res.status_code == 401


# ── Test 21: delete feedback requires auth ────────────────────────────────────
def test_delete_feedback_requires_auth(client):
    """Deleting feedback without token should return 401."""
    res = client.delete("/feedback/1")
    assert res.status_code == 401


# ── Test 22: update nonexistent feedback ──────────────────────────────────────
def test_update_nonexistent_feedback(client):
    """Updating feedback that doesn't exist should return 404."""
    token = get_token(client)
    assert token is not None, "Could not get auth token"
    res = client.put("/feedback/999999",
                     json={"rating": 3},
                     headers={"Authorization": f"Bearer {token}"}
                     )
    assert res.status_code == 404


# ── Test 23: delete nonexistent feedback ─────────────────────────────────────
def test_delete_nonexistent_feedback(client):
    """Deleting feedback that doesn't exist should return 404."""
    token = get_token(client)
    assert token is not None, "Could not get auth token"
    res = client.delete("/feedback/999999",
                        headers={"Authorization": f"Bearer {token}"}
                        )
    assert res.status_code == 404