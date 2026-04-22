"""
test_quiz_personality.py  —  backend/
Tests for the quiz / personality endpoints.

  POST /personality   → save quiz result
  GET  /personality   → get stored OCEAN + personality_type

Run with:  pytest test_quiz_personality.py -v
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
    """Register a unique user and return their JWT token."""
    unique = uuid.uuid4().hex[:8]
    client.post("/register", json={
        "username": f"quizuser_{unique}",
        "email":    f"quizuser_{unique}@test.com",
        "password": "testpass123",
    })
    res = client.post("/login", json={
        "username": f"quizuser_{unique}",
        "password": "testpass123",
    })
    return res.get_json().get("access_token")


def auth(token):
    return {"Authorization": f"Bearer {token}"}


VALID_QUIZ = {
    "openness_score":          7.5,
    "conscientiousness_score": 6.0,
    "extraversion_score":      8.0,
    "agreeableness_score":     5.5,
    "neuroticism_score":       3.0,
    "personality_type":        "adventurous explorer",
    "duration":                "Medium (6-10 days)",
}


# ── Auth guards ───────────────────────────────────────────────────────────────

def test_save_personality_requires_auth(client):
    """POST /personality without token should return 401."""
    res = client.post("/personality", json=VALID_QUIZ)
    assert res.status_code == 401


def test_get_personality_requires_auth(client):
    """GET /personality without token should return 401."""
    res = client.get("/personality")
    assert res.status_code == 401


# ── GET before quiz ───────────────────────────────────────────────────────────

def test_get_personality_before_quiz(client):
    """New user who hasn't taken quiz should get 404."""
    token = register_and_login(client)
    res   = client.get("/personality", headers=auth(token))
    assert res.status_code == 404


# ── Save personality ──────────────────────────────────────────────────────────

def test_save_personality_success(client):
    """Valid quiz submission should return 201."""
    token = register_and_login(client)
    res   = client.post("/personality", json=VALID_QUIZ, headers=auth(token))
    assert res.status_code == 201
    data = res.get_json()
    assert data["personality_type"] == "adventurous explorer"
    assert "cluster_label" in data


def test_save_personality_missing_field(client):
    """Missing any required field should return 422."""
    token = register_and_login(client)
    for field in ["openness_score", "conscientiousness_score",
                  "extraversion_score", "agreeableness_score",
                  "neuroticism_score", "personality_type"]:
        bad = {k: v for k, v in VALID_QUIZ.items() if k != field}
        res = client.post("/personality", json=bad, headers=auth(token))
        assert res.status_code == 422, f"Expected 422 when '{field}' is missing"


def test_save_personality_score_out_of_range_high(client):
    """Score above 10 should return 422."""
    token = register_and_login(client)
    bad   = {**VALID_QUIZ, "openness_score": 11.0}
    res   = client.post("/personality", json=bad, headers=auth(token))
    assert res.status_code == 422


def test_save_personality_score_out_of_range_low(client):
    """Score below 0 should return 422."""
    token = register_and_login(client)
    bad   = {**VALID_QUIZ, "neuroticism_score": -1.0}
    res   = client.post("/personality", json=bad, headers=auth(token))
    assert res.status_code == 422


def test_save_personality_score_not_a_number(client):
    """Non-numeric score should return 422."""
    token = register_and_login(client)
    bad   = {**VALID_QUIZ, "extraversion_score": "high"}
    res   = client.post("/personality", json=bad, headers=auth(token))
    assert res.status_code == 422


def test_save_personality_empty_personality_type(client):
    """Empty personality_type string should return 422."""
    token = register_and_login(client)
    bad   = {**VALID_QUIZ, "personality_type": ""}
    res   = client.post("/personality", json=bad, headers=auth(token))
    assert res.status_code == 422


def test_save_personality_without_duration(client):
    """Duration is optional — submission without it should still return 201."""
    token    = register_and_login(client)
    no_dur   = {k: v for k, v in VALID_QUIZ.items() if k != "duration"}
    res      = client.post("/personality", json=no_dur, headers=auth(token))
    assert res.status_code == 201


# ── GET after quiz ────────────────────────────────────────────────────────────

def test_get_personality_after_quiz(client):
    """After saving, GET /personality should return OCEAN scores and type."""
    token = register_and_login(client)
    client.post("/personality", json=VALID_QUIZ, headers=auth(token))
    res  = client.get("/personality", headers=auth(token))
    assert res.status_code == 200
    data = res.get_json()
    assert "ocean"            in data
    assert "personality_type" in data
    assert "cluster_label"    in data


def test_get_personality_ocean_keys(client):
    """OCEAN dict should contain all five trait keys."""
    token = register_and_login(client)
    client.post("/personality", json=VALID_QUIZ, headers=auth(token))
    res   = client.get("/personality", headers=auth(token))
    ocean = res.get_json()["ocean"]
    for trait in ["openness", "conscientiousness", "extraversion",
                  "agreeableness", "neuroticism"]:
        assert trait in ocean, f"Missing OCEAN trait: {trait}"


def test_personality_type_stored_correctly(client):
    """Stored personality_type should match what was submitted."""
    token = register_and_login(client)
    client.post("/personality", json=VALID_QUIZ, headers=auth(token))
    res  = client.get("/personality", headers=auth(token))
    assert res.get_json()["personality_type"] == "adventurous explorer"


def test_retaking_quiz_updates_result(client):
    """Submitting quiz twice should keep the latest result accessible."""
    token = register_and_login(client)
    client.post("/personality", json=VALID_QUIZ, headers=auth(token))

    updated = {**VALID_QUIZ, "personality_type": "calm & relaxed",
               "neuroticism_score": 2.0, "extraversion_score": 3.0}
    client.post("/personality", json=updated, headers=auth(token))

    res = client.get("/personality", headers=auth(token))
    assert res.status_code == 200
    # Latest result should be returned
    assert res.get_json()["personality_type"] == "calm & relaxed"


def test_login_quiz_completed_flag(client):
    """After quiz, login response should show quiz_completed=True."""
    unique = uuid.uuid4().hex[:8]
    client.post("/register", json={
        "username": f"quizflag_{unique}",
        "email":    f"quizflag_{unique}@test.com",
        "password": "pass123",
    })
    login_res = client.post("/login", json={
        "username": f"quizflag_{unique}", "password": "pass123"
    })
    token = login_res.get_json()["access_token"]
    assert login_res.get_json()["quiz_completed"] is False

    client.post("/personality", json=VALID_QUIZ, headers=auth(token))

    login_res2 = client.post("/login", json={
        "username": f"quizflag_{unique}", "password": "pass123"
    })
    assert login_res2.get_json()["quiz_completed"] is True
