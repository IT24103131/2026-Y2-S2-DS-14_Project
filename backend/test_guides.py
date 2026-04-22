"""
test_guides.py  —  backend/
Tests for the guide recommender and booking endpoints.

Run with:  pytest test_guides.py -v
All tests use the Flask test client — no live server needed.
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


def get_token(client):
    """Register + login a unique test user, return JWT token."""
    unique = uuid.uuid4().hex[:8]
    client.post("/register", json={
        "username": f"guidetest_{unique}",
        "email":    f"guidetest_{unique}@test.com",
        "password": "testpass123",
    })
    res = client.post("/login", json={
        "username": f"guidetest_{unique}",
        "password": "testpass123",
    })
    return res.get_json().get("access_token")


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def setup_user_ready_for_guides(client):
    """
    Full setup: register → quiz → save locations.
    This is the minimum required before /guides/recommend works.
    """
    token = get_token(client)
    headers = auth(token)

    # Quiz must be completed first
    client.post("/personality", json={
        "openness_score":          7.5,
        "conscientiousness_score": 6.0,
        "extraversion_score":      8.0,
        "agreeableness_score":     6.5,
        "neuroticism_score":       3.0,
        "personality_type":        "adventurous explorer",
        "duration":                "Medium (6-10 days)",
    }, headers=headers)

    # Locations must be saved
    client.post("/locations/save-selection", json={
        "selected_destinations": ["Sigiriya", "Ella", "Yala National Park"]
    }, headers=headers)

    return token


# ── Auth guard tests ───────────────────────────────────────────────────────────

def test_recommend_requires_auth(client):
    """Guide recommend without token should return 401."""
    res = client.get("/guides/recommend?language=English")
    assert res.status_code == 401


def test_booking_requires_auth(client):
    """Get booking without token should return 401."""
    res = client.get("/guides/booking")
    assert res.status_code == 401


def test_book_guide_requires_auth(client):
    """POST /guides/book without token should return 401."""
    res = client.post("/guides/book", json={
        "guide_id": 1, "name": "Test", "language": "English", "estimated_budget": 5000
    })
    assert res.status_code == 401


def test_cancel_booking_requires_auth(client):
    """Cancel booking without token should return 401."""
    res = client.put("/guides/booking/1/cancel")
    assert res.status_code == 401


# ── No quiz / no locations guards ─────────────────────────────────────────────

def test_recommend_without_quiz(client):
    """Recommend guides before quiz is completed should return 400."""
    token = get_token(client)
    res   = client.get("/guides/recommend?language=English", headers=auth(token))
    assert res.status_code == 400
    assert "quiz" in res.get_json().get("detail", "").lower()


# ── Recommend endpoint ────────────────────────────────────────────────────────

def test_recommend_returns_structure(client):
    """Recommend endpoint should return guides list and message."""
    token = setup_user_ready_for_guides(client)
    res   = client.get("/guides/recommend?language=All", headers=auth(token))
    # 200 with guides, or 200 with empty list if no guides in DB
    assert res.status_code == 200
    data = res.get_json()
    assert "guides"  in data
    assert "message" in data


def test_recommend_guides_is_list(client):
    """Guides field in response should always be a list."""
    token = setup_user_ready_for_guides(client)
    res   = client.get("/guides/recommend?language=English", headers=auth(token))
    assert res.status_code == 200
    assert isinstance(res.get_json()["guides"], list)


def test_recommend_language_filter_applied(client):
    """Language filter param is accepted without error."""
    token = setup_user_ready_for_guides(client)
    for lang in ["English", "Sinhala", "Tamil", "All"]:
        res = client.get(f"/guides/recommend?language={lang}", headers=auth(token))
        assert res.status_code == 200, f"Failed for language={lang}"


def test_recommend_guide_fields(client):
    """Each guide in results should have the required fields."""
    token = setup_user_ready_for_guides(client)
    res   = client.get("/guides/recommend?language=All", headers=auth(token))
    assert res.status_code == 200
    guides = res.get_json()["guides"]
    if guides:   # only check if DB has guides
        g = guides[0]
        for field in ["guide_id", "name", "rating", "daily_rate",
                      "language_spoken", "status", "final_score"]:
            assert field in g, f"Missing field: {field}"


# ── Booking endpoint ──────────────────────────────────────────────────────────

def test_no_booking_returns_404(client):
    """New user with no booking should get 404."""
    token = get_token(client)
    res   = client.get("/guides/booking", headers=auth(token))
    assert res.status_code == 404


def test_book_guide_missing_guide_id(client):
    """Booking without guide_id should return 422."""
    token = get_token(client)
    res   = client.post("/guides/book", json={
        "name": "Test Guide", "language": "English", "estimated_budget": 5000
    }, headers=auth(token))
    assert res.status_code == 422


def test_book_nonexistent_guide(client):
    """Booking a guide_id that doesn't exist should return 404."""
    token = get_token(client)
    res   = client.post("/guides/book", json={
        "guide_id": 999999, "name": "Ghost", "language": "English", "estimated_budget": 0
    }, headers=auth(token))
    assert res.status_code == 404


def test_cancel_nonexistent_booking(client):
    """Cancelling a booking that doesn't exist should return 404."""
    token = get_token(client)
    res   = client.put("/guides/booking/999999/cancel", headers=auth(token))
    assert res.status_code == 404


def test_double_booking_blocked(client):
    """
    If a user has an active booking, a second booking attempt should return 400.
    Skipped if no real guides in DB (guide_id 1 may not exist).
    """
    token   = get_token(client)
    headers = auth(token)

    # Attempt first booking
    r1 = client.post("/guides/book", json={
        "guide_id": 1, "name": "Guide A", "language": "English", "estimated_budget": 3000
    }, headers=headers)

    if r1.status_code != 200:
        pytest.skip("Guide ID 1 not available in test DB — skipping double-booking test")

    # Second booking should be blocked
    r2 = client.post("/guides/book", json={
        "guide_id": 2, "name": "Guide B", "language": "English", "estimated_budget": 3000
    }, headers=headers)
    assert r2.status_code == 400
    assert "already" in r2.get_json().get("detail", "").lower()
