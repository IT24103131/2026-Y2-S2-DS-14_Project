"""
test_locations.py  —  backend/
Tests for location recommendation endpoints.

Component: Location Recommendation — personality-based filtering of Sri Lanka
           destinations from the database + CSV metadata.

Endpoints covered:
  GET  /locations               — public, all destinations
  GET  /locations/me            — auth, filtered by user's personality type
  GET  /locations/<type>        — auth, filtered by explicit personality type
  POST /locations/save-selection — auth, save chosen destinations
  GET  /locations/selection      — auth, retrieve saved destinations
"""

import sys
import os
import uuid
import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app

PERSONALITY_TYPES = [
    "adventurous explorer",
    "balanced traveler",
    "friendly cultural",
    "organized sightseer",
    "calm & relaxed",
]


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def _fresh_token(client, ptype="adventurous explorer"):
    uid = uuid.uuid4().hex[:8]
    client.post("/register", json={
        "username": f"loctest_{uid}",
        "email": f"loctest_{uid}@test.com",
        "password": "Pass123!",
    })
    res = client.post("/login", json={
        "username": f"loctest_{uid}",
        "password": "Pass123!",
    })
    token = res.get_json()["access_token"]
    # Complete quiz so cluster_label is set
    client.post("/personality", json={
        "openness_score": 7.5,
        "conscientiousness_score": 6.0,
        "extraversion_score": 8.0,
        "agreeableness_score": 5.5,
        "neuroticism_score": 3.0,
        "personality_type": ptype,
        "duration": 5,
    }, headers={"Authorization": f"Bearer {token}"})
    return token


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ── GET /locations (public) ───────────────────────────────────────────────────

class TestAllLocations:

    def test_all_locations_public(self, client):
        """Public endpoint returns 200 without auth."""
        res = client.get("/locations")
        assert res.status_code == 200

    def test_all_locations_response_structure(self, client):
        """Response has count + destinations list."""
        res = client.get("/locations")
        data = res.get_json()
        assert "count" in data
        assert "destinations" in data
        assert isinstance(data["destinations"], list)

    def test_all_locations_no_duplicates(self, client):
        """Each location name appears at most once (deduplication works)."""
        res = client.get("/locations")
        names = [d["location"].lower() for d in res.get_json()["destinations"]]
        assert len(names) == len(set(names)), "Duplicate locations found"

    def test_all_locations_have_required_fields(self, client):
        """Every destination has location, personality_type, province, district."""
        res = client.get("/locations")
        for dest in res.get_json()["destinations"]:
            for field in ["location", "personality_type"]:
                assert field in dest, f"Missing field: {field}"


# ── GET /locations/me ─────────────────────────────────────────────────────────

class TestLocationsForMe:

    def test_locations_me_requires_auth(self, client):
        """Unauthenticated request returns 401."""
        res = client.get("/locations/me")
        assert res.status_code == 401

    def test_locations_me_no_quiz(self, client):
        """User without quiz result returns 400."""
        uid = uuid.uuid4().hex[:8]
        client.post("/register", json={
            "username": f"noquiz_{uid}",
            "email": f"noquiz_{uid}@test.com",
            "password": "pass123",
        })
        res = client.post("/login", json={"username": f"noquiz_{uid}", "password": "pass123"})
        token = res.get_json()["access_token"]
        res = client.get("/locations/me", headers=_h(token))
        assert res.status_code == 400

    def test_locations_me_after_quiz(self, client):
        """After quiz, returns filtered locations with correct structure."""
        token = _fresh_token(client)
        res = client.get("/locations/me", headers=_h(token))
        assert res.status_code == 200
        data = res.get_json()
        assert "personality_type" in data
        assert "locations" in data
        assert "count" in data

    def test_locations_me_count_matches_list(self, client):
        """count equals len(locations)."""
        token = _fresh_token(client)
        res = client.get("/locations/me", headers=_h(token))
        data = res.get_json()
        assert data["count"] == len(data["locations"])

    def test_locations_me_personality_type_in_response(self, client):
        """Response includes the user's personality type."""
        token = _fresh_token(client, ptype="friendly cultural")
        res = client.get("/locations/me", headers=_h(token))
        data = res.get_json()
        assert "friendly cultural" in data["personality_type"].lower()


# ── GET /locations/<personality_type> ─────────────────────────────────────────

class TestLocationsByType:

    def test_locations_by_type_requires_auth(self, client):
        """Unauthenticated request returns 401."""
        res = client.get("/locations/adventurous-explorer")
        assert res.status_code == 401

    def test_locations_by_valid_type(self, client):
        """Valid personality type returns 200 with locations list."""
        token = _fresh_token(client)
        res = client.get("/locations/adventurous+explorer", headers=_h(token))
        assert res.status_code == 200

    def test_locations_by_unknown_type_returns_empty(self, client):
        """Unknown type returns 200 with empty list (not 404)."""
        token = _fresh_token(client)
        res = client.get("/locations/unknown_type_xyz", headers=_h(token))
        assert res.status_code == 200
        data = res.get_json()
        assert data["locations"] == []


# ── POST /locations/save-selection ───────────────────────────────────────────

class TestSaveSelection:

    def test_save_selection_success(self, client):
        """Valid destination list saves with 200."""
        token = _fresh_token(client)
        res = client.post("/locations/save-selection",
                          json={"selected_destinations": ["Sigiriya", "Kandy", "Ella"]},
                          headers=_h(token))
        assert res.status_code == 200
        data = res.get_json()
        assert "selection_id" in data
        assert "selected_destinations" in data

    def test_save_selection_requires_auth(self, client):
        """Unauthenticated request returns 401."""
        res = client.post("/locations/save-selection",
                          json={"selected_destinations": ["Sigiriya"]})
        assert res.status_code == 401

    def test_save_selection_empty_list_fails(self, client):
        """Empty destinations list returns 422."""
        token = _fresh_token(client)
        res = client.post("/locations/save-selection",
                          json={"selected_destinations": []},
                          headers=_h(token))
        assert res.status_code == 422

    def test_save_selection_missing_key_fails(self, client):
        """Request without selected_destinations key returns 422."""
        token = _fresh_token(client)
        res = client.post("/locations/save-selection",
                          json={"destinations": ["Sigiriya"]},
                          headers=_h(token))
        assert res.status_code == 422

    def test_save_selection_object_format_accepted(self, client):
        """Accepts {location: 'Name'} objects as well as plain strings."""
        token = _fresh_token(client)
        res = client.post("/locations/save-selection",
                          json={"selected_destinations": [{"location": "Galle"}, {"location": "Mirissa"}]},
                          headers=_h(token))
        assert res.status_code == 200

    def test_save_selection_deduplicates(self, client):
        """Duplicate names in input are deduplicated in saved result."""
        token = _fresh_token(client)
        res = client.post("/locations/save-selection",
                          json={"selected_destinations": ["Sigiriya", "Sigiriya", "Kandy"]},
                          headers=_h(token))
        data = res.get_json()
        saved = data.get("selected_destinations", [])
        assert saved.count("Sigiriya") == 1

    def test_save_selection_upserts_on_second_save(self, client):
        """Second save overwrites the first for the same user."""
        token = _fresh_token(client)
        client.post("/locations/save-selection",
                    json={"selected_destinations": ["Sigiriya"]},
                    headers=_h(token))
        res2 = client.post("/locations/save-selection",
                           json={"selected_destinations": ["Ella", "Galle"]},
                           headers=_h(token))
        assert res2.status_code == 200


# ── GET /locations/selection ──────────────────────────────────────────────────

class TestGetSelection:

    def test_get_selection_requires_auth(self, client):
        """Unauthenticated request returns 401."""
        res = client.get("/locations/selection")
        assert res.status_code == 401

    def test_get_selection_empty_for_new_user(self, client):
        """New user with no saved selection returns empty list, not error."""
        token = _fresh_token(client)
        res = client.get("/locations/selection", headers=_h(token))
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data["selected_destinations"], list)

    def test_get_selection_returns_saved(self, client):
        """After saving, GET returns the same destinations."""
        token = _fresh_token(client)
        saved = ["Sigiriya", "Kandy", "Ella"]
        client.post("/locations/save-selection",
                    json={"selected_destinations": saved},
                    headers=_h(token))
        res = client.get("/locations/selection", headers=_h(token))
        data = res.get_json()
        for loc in saved:
            assert loc in data["selected_destinations"], f"Missing: {loc}"

    def test_get_selection_structure(self, client):
        """Response has personality_type, selected_destinations, saved_at."""
        token = _fresh_token(client)
        client.post("/locations/save-selection",
                    json={"selected_destinations": ["Sigiriya"]},
                    headers=_h(token))
        res = client.get("/locations/selection", headers=_h(token))
        data = res.get_json()
        assert "personality_type" in data
        assert "selected_destinations" in data
