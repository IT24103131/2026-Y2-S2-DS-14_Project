"""
conftest.py  —  backend/
Shared pytest fixtures for all backend test modules.
"""

import sys
import os
import uuid
import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app as flask_app


@pytest.fixture(scope="session")
def app():
    flask_app.config["TESTING"] = True
    yield flask_app


@pytest.fixture
def client(app):
    with app.test_client() as c:
        yield c


# ── Auth helpers ───────────────────────────────────────────────────────────────

def make_user(client):
    """Register a fresh user and return (username, password, token)."""
    uid = uuid.uuid4().hex[:8]
    username = f"tuser_{uid}"
    email = f"tuser_{uid}@vibelanka.test"
    password = "TestPass!99"
    client.post("/register", json={
        "username": username,
        "email": email,
        "password": password,
    })
    res = client.post("/login", json={"username": username, "password": password})
    token = res.get_json().get("access_token", "")
    return username, password, token


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


VALID_OCEAN = {
    "openness_score": 7.5,
    "conscientiousness_score": 6.0,
    "extraversion_score": 8.0,
    "agreeableness_score": 5.5,
    "neuroticism_score": 3.0,
    "personality_type": "adventurous explorer",
    "duration": 5,
}


@pytest.fixture
def new_user(client):
    """Returns (username, password, token) for a fresh user with no quiz."""
    return make_user(client)


@pytest.fixture
def quiz_user(client):
    """Returns (username, password, token) for a user who completed the quiz."""
    username, password, token = make_user(client)
    client.post("/personality", json=VALID_OCEAN,
                headers=auth_headers(token))
    return username, password, token


@pytest.fixture
def located_user(client):
    """Returns token for a user with quiz + saved locations."""
    _, _, token = quiz_user.__wrapped__(client) if hasattr(quiz_user, '__wrapped__') else make_user(client)
    # Complete quiz
    _, _, token_fresh = make_user(client)
    client.post("/personality", json=VALID_OCEAN,
                headers=auth_headers(token_fresh))
    # Save locations
    client.post("/locations/save-selection",
                json={"selected_destinations": ["Sigiriya", "Kandy", "Ella"]},
                headers=auth_headers(token_fresh))
    return token_fresh
