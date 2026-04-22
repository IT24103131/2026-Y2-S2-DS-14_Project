"""
test_personality.py  —  backend/
Tests for:
  - POST /personality  (save quiz result + personality type assignment)
  - GET  /personality  (retrieve OCEAN scores for logged-in user)

Component: Personality Prediction (OCEAN quiz → KNN classifier → type label)
"""

import sys
import os
import uuid
import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def _register_and_login(client):
    uid = uuid.uuid4().hex[:8]
    client.post("/register", json={
        "username": f"ptest_{uid}",
        "email": f"ptest_{uid}@test.com",
        "password": "Pass123!",
    })
    res = client.post("/login", json={
        "username": f"ptest_{uid}",
        "password": "Pass123!",
    })
    return res.get_json()["access_token"]


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


VALID_PAYLOAD = {
    "openness_score":          7.5,
    "conscientiousness_score": 6.0,
    "extraversion_score":      8.0,
    "agreeableness_score":     5.5,
    "neuroticism_score":       3.0,
    "personality_type":        "adventurous explorer",
    "duration":                5,
}


# ── POST /personality ─────────────────────────────────────────────────────────

class TestSavePersonality:

    def test_save_personality_success(self, client):
        """Valid OCEAN payload returns 201 with personality_type."""
        token = _register_and_login(client)
        res = client.post("/personality", json=VALID_PAYLOAD, headers=_headers(token))
        assert res.status_code == 201
        data = res.get_json()
        assert "personality_type" in data
        assert "cluster_label" in data

    def test_save_personality_requires_auth(self, client):
        """Unauthenticated request returns 401."""
        res = client.post("/personality", json=VALID_PAYLOAD)
        assert res.status_code == 401

    def test_save_personality_missing_openness(self, client):
        """Missing openness_score returns 422."""
        token = _register_and_login(client)
        payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "openness_score"}
        res = client.post("/personality", json=payload, headers=_headers(token))
        assert res.status_code == 422

    def test_save_personality_missing_personality_type(self, client):
        """Missing personality_type returns 422."""
        token = _register_and_login(client)
        payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "personality_type"}
        res = client.post("/personality", json=payload, headers=_headers(token))
        assert res.status_code == 422

    def test_save_personality_score_out_of_range_high(self, client):
        """Score > 10 returns 422."""
        token = _register_and_login(client)
        payload = {**VALID_PAYLOAD, "openness_score": 11.0}
        res = client.post("/personality", json=payload, headers=_headers(token))
        assert res.status_code == 422

    def test_save_personality_score_out_of_range_low(self, client):
        """Score < 0 returns 422."""
        token = _register_and_login(client)
        payload = {**VALID_PAYLOAD, "neuroticism_score": -1.0}
        res = client.post("/personality", json=payload, headers=_headers(token))
        assert res.status_code == 422

    def test_save_personality_non_numeric_score(self, client):
        """Non-numeric score returns 422."""
        token = _register_and_login(client)
        payload = {**VALID_PAYLOAD, "extraversion_score": "high"}
        res = client.post("/personality", json=payload, headers=_headers(token))
        assert res.status_code == 422

    def test_save_personality_cluster_label_set(self, client):
        """After saving, cluster_label matches personality_type (lowercased)."""
        token = _register_and_login(client)
        res = client.post("/personality", json=VALID_PAYLOAD, headers=_headers(token))
        assert res.status_code == 201
        data = res.get_json()
        assert data["cluster_label"] == VALID_PAYLOAD["personality_type"].lower()

    def test_save_personality_all_types(self, client):
        """Each valid personality type saves correctly."""
        types = [
            "adventurous explorer",
            "balanced traveler",
            "friendly cultural",
            "organized sightseer",
            "calm & relaxed",
        ]
        for ptype in types:
            token = _register_and_login(client)
            payload = {**VALID_PAYLOAD, "personality_type": ptype}
            res = client.post("/personality", json=payload, headers=_headers(token))
            assert res.status_code == 201, f"Failed for type: {ptype}"

    def test_save_personality_zero_scores_valid(self, client):
        """Boundary: all zeros (0.0) are valid scores."""
        token = _register_and_login(client)
        payload = {
            "openness_score": 0.0,
            "conscientiousness_score": 0.0,
            "extraversion_score": 0.0,
            "agreeableness_score": 0.0,
            "neuroticism_score": 0.0,
            "personality_type": "calm & relaxed",
        }
        res = client.post("/personality", json=payload, headers=_headers(token))
        assert res.status_code == 201

    def test_save_personality_max_scores_valid(self, client):
        """Boundary: all 10.0 are valid scores."""
        token = _register_and_login(client)
        payload = {
            "openness_score": 10.0,
            "conscientiousness_score": 10.0,
            "extraversion_score": 10.0,
            "agreeableness_score": 10.0,
            "neuroticism_score": 10.0,
            "personality_type": "adventurous explorer",
        }
        res = client.post("/personality", json=payload, headers=_headers(token))
        assert res.status_code == 201

    def test_save_personality_returns_explanation(self, client):
        """Response body contains personality_type."""
        token = _register_and_login(client)
        res = client.post("/personality", json=VALID_PAYLOAD, headers=_headers(token))
        data = res.get_json()
        assert data["personality_type"] == VALID_PAYLOAD["personality_type"]


# ── GET /personality ──────────────────────────────────────────────────────────

class TestGetPersonality:

    def test_get_personality_requires_auth(self, client):
        """Unauthenticated request returns 401."""
        res = client.get("/personality")
        assert res.status_code == 401

    def test_get_personality_no_quiz(self, client):
        """New user with no quiz result returns 404."""
        token = _register_and_login(client)
        res = client.get("/personality", headers=_headers(token))
        assert res.status_code == 404

    def test_get_personality_after_quiz(self, client):
        """After completing quiz, GET returns OCEAN scores and personality_type."""
        token = _register_and_login(client)
        client.post("/personality", json=VALID_PAYLOAD, headers=_headers(token))
        res = client.get("/personality", headers=_headers(token))
        assert res.status_code == 200
        data = res.get_json()
        assert "ocean" in data
        assert "personality_type" in data
        assert "cluster_label" in data

    def test_get_personality_ocean_structure(self, client):
        """OCEAN object has all five trait keys."""
        token = _register_and_login(client)
        client.post("/personality", json=VALID_PAYLOAD, headers=_headers(token))
        res = client.get("/personality", headers=_headers(token))
        ocean = res.get_json()["ocean"]
        for trait in ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"]:
            assert trait in ocean, f"Missing trait: {trait}"

    def test_get_personality_scores_match_saved(self, client):
        """Retrieved OCEAN scores match the values that were submitted."""
        token = _register_and_login(client)
        client.post("/personality", json=VALID_PAYLOAD, headers=_headers(token))
        res = client.get("/personality", headers=_headers(token))
        ocean = res.get_json()["ocean"]
        assert abs(ocean["openness"] - VALID_PAYLOAD["openness_score"]) < 0.01
        assert abs(ocean["extraversion"] - VALID_PAYLOAD["extraversion_score"]) < 0.01

    def test_get_personality_returns_latest(self, client):
        """Multiple quiz submissions: GET returns the most recent one."""
        token = _register_and_login(client)
        client.post("/personality", json=VALID_PAYLOAD, headers=_headers(token))
        updated = {**VALID_PAYLOAD, "personality_type": "calm & relaxed", "openness_score": 2.0}
        client.post("/personality", json=updated, headers=_headers(token))
        res = client.get("/personality", headers=_headers(token))
        data = res.get_json()
        assert data["personality_type"] == "calm & relaxed"
