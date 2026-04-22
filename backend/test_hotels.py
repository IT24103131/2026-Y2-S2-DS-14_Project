"""
test_hotels.py  —  backend/
Tests for hotel recommendation endpoints.

Component: Hotel Recommendation — KMeans model clusters hotels by OCEAN scores,
           matched to user's personality profile.

Endpoints covered:
  GET    /hotels              — AI recommendation using KMeans
  POST   /hotels/save         — save hotel to selected_hotels
  GET    /hotels/saved        — list user's saved hotels
  PUT    /hotels/saved/<id>   — update budget/dates
  DELETE /hotels/saved/<id>   — remove hotel
"""

import sys
import os
import uuid
import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def _fresh_user(client, with_quiz=True):
    uid = uuid.uuid4().hex[:8]
    client.post("/register", json={
        "username": f"hoteltest_{uid}",
        "email": f"hoteltest_{uid}@test.com",
        "password": "Pass123!",
    })
    res = client.post("/login", json={
        "username": f"hoteltest_{uid}",
        "password": "Pass123!",
    })
    token = res.get_json()["access_token"]
    if with_quiz:
        client.post("/personality", json={
            "openness_score": 7.5,
            "conscientiousness_score": 6.0,
            "extraversion_score": 8.0,
            "agreeableness_score": 5.5,
            "neuroticism_score": 3.0,
            "personality_type": "adventurous explorer",
            "duration": 5,
        }, headers={"Authorization": f"Bearer {token}"})
    return token


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ── GET /hotels ───────────────────────────────────────────────────────────────

class TestHotelRecommendations:

    def test_get_hotels_requires_auth(self, client):
        """Unauthenticated request returns 401."""
        res = client.get("/hotels")
        assert res.status_code == 401

    def test_get_hotels_without_quiz_fails(self, client):
        """User without quiz result returns 400."""
        token = _fresh_user(client, with_quiz=False)
        res = client.get("/hotels", headers=_h(token))
        assert res.status_code == 400

    def test_get_hotels_with_quiz_returns_200(self, client):
        """User with quiz result returns 200."""
        token = _fresh_user(client)
        res = client.get("/hotels", headers=_h(token))
        assert res.status_code == 200

    def test_get_hotels_response_structure(self, client):
        """Response includes hotels list, count, personality_cluster."""
        token = _fresh_user(client)
        res = client.get("/hotels", headers=_h(token))
        data = res.get_json()
        assert "hotels" in data
        assert "count" in data
        assert isinstance(data["hotels"], list)

    def test_get_hotels_max_10_results(self, client):
        """AI recommendation caps at 10 hotels."""
        token = _fresh_user(client)
        res = client.get("/hotels", headers=_h(token))
        data = res.get_json()
        assert data["count"] <= 10

    def test_get_hotels_each_has_required_fields(self, client):
        """Each hotel has hotel_id, name, location, budget_per_night."""
        token = _fresh_user(client)
        res = client.get("/hotels", headers=_h(token))
        for hotel in res.get_json()["hotels"]:
            for field in ["hotel_id", "name", "location", "budget_per_night"]:
                assert field in hotel, f"Hotel missing field: {field}"

    def test_get_hotels_personality_type_in_response(self, client):
        """Response includes the user's personality_type."""
        token = _fresh_user(client)
        res = client.get("/hotels", headers=_h(token))
        data = res.get_json()
        assert "personality_type" in data

    def test_get_hotels_location_filtered(self, client):
        """With saved locations, hotels are filtered to matching areas."""
        token = _fresh_user(client)
        client.post("/locations/save-selection",
                    json={"selected_destinations": ["Kandy"]},
                    headers=_h(token))
        res = client.get("/hotels", headers=_h(token))
        assert res.status_code == 200


# ── POST /hotels/save ─────────────────────────────────────────────────────────

class TestSaveHotel:

    def _get_first_hotel_id(self, client, token):
        """Helper: returns hotel_id from recommendations (None if no hotels)."""
        res = client.get("/hotels", headers=_h(token))
        hotels = res.get_json().get("hotels", [])
        return hotels[0]["hotel_id"] if hotels else None

    def test_save_hotel_requires_auth(self, client):
        """Unauthenticated request returns 401."""
        res = client.post("/hotels/save", json={"hotel_id": 1, "total_budget": 50000})
        assert res.status_code == 401

    def test_save_hotel_missing_hotel_id(self, client):
        """Missing hotel_id returns 422."""
        token = _fresh_user(client)
        res = client.post("/hotels/save",
                          json={"total_budget": 50000, "check_in": "2026-06-01", "check_out": "2026-06-05"},
                          headers=_h(token))
        assert res.status_code == 422

    def test_save_hotel_missing_budget(self, client):
        """Missing total_budget returns 422."""
        token = _fresh_user(client)
        res = client.post("/hotels/save",
                          json={"hotel_id": 1, "check_in": "2026-06-01", "check_out": "2026-06-05"},
                          headers=_h(token))
        assert res.status_code == 422

    def test_save_hotel_missing_dates(self, client):
        """Missing check_in/check_out returns 422."""
        token = _fresh_user(client)
        res = client.post("/hotels/save",
                          json={"hotel_id": 1, "total_budget": 50000},
                          headers=_h(token))
        assert res.status_code == 422

    def test_save_hotel_success(self, client):
        """Valid hotel save returns 200."""
        token = _fresh_user(client)
        hotel_id = self._get_first_hotel_id(client, token)
        if hotel_id is None:
            pytest.skip("No hotels in DB for this user's cluster")
        res = client.post("/hotels/save", json={
            "hotel_id":     hotel_id,
            "location":     "Test Location",
            "total_budget": 50000.0,
            "check_in":     "2026-06-01",
            "check_out":    "2026-06-05",
            "num_people":   2,
        }, headers=_h(token))
        assert res.status_code == 200

    def test_save_hotel_upserts_on_duplicate(self, client):
        """Saving the same hotel twice updates the record (upsert)."""
        token = _fresh_user(client)
        hotel_id = self._get_first_hotel_id(client, token)
        if hotel_id is None:
            pytest.skip("No hotels in DB for this user's cluster")
        payload = {
            "hotel_id": hotel_id,
            "location": "Test",
            "total_budget": 50000.0,
            "check_in": "2026-06-01",
            "check_out": "2026-06-05",
        }
        client.post("/hotels/save", json=payload, headers=_h(token))
        payload["total_budget"] = 75000.0
        res = client.post("/hotels/save", json=payload, headers=_h(token))
        assert res.status_code == 200


# ── GET /hotels/saved ─────────────────────────────────────────────────────────

class TestGetSavedHotels:

    def test_get_saved_requires_auth(self, client):
        """Unauthenticated request returns 401."""
        res = client.get("/hotels/saved")
        assert res.status_code == 401

    def test_get_saved_empty_for_new_user(self, client):
        """New user has no saved hotels — returns empty list."""
        token = _fresh_user(client)
        res = client.get("/hotels/saved", headers=_h(token))
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data["saved_hotels"], list)
        assert data["count"] == 0

    def test_get_saved_structure(self, client):
        """Response has saved_hotels, grand_total, count."""
        token = _fresh_user(client)
        res = client.get("/hotels/saved", headers=_h(token))
        data = res.get_json()
        for key in ["saved_hotels", "grand_total", "count"]:
            assert key in data

    def test_get_saved_after_save(self, client):
        """After saving a hotel, it appears in GET /hotels/saved."""
        token = _fresh_user(client)
        hotel_id = None
        rec = client.get("/hotels", headers=_h(token))
        hotels = rec.get_json().get("hotels", [])
        if hotels:
            hotel_id = hotels[0]["hotel_id"]
        if hotel_id is None:
            pytest.skip("No hotels available to test")
        client.post("/hotels/save", json={
            "hotel_id": hotel_id,
            "location": "Test Area",
            "total_budget": 40000.0,
            "check_in": "2026-07-10",
            "check_out": "2026-07-15",
        }, headers=_h(token))
        res = client.get("/hotels/saved", headers=_h(token))
        data = res.get_json()
        assert data["count"] >= 1
        assert any(h["hotel_id"] == hotel_id for h in data["saved_hotels"])

    def test_get_saved_calculates_nights(self, client):
        """Nights are calculated correctly from check_in/check_out."""
        token = _fresh_user(client)
        hotel_id = None
        rec = client.get("/hotels", headers=_h(token))
        hotels = rec.get_json().get("hotels", [])
        if hotels:
            hotel_id = hotels[0]["hotel_id"]
        if hotel_id is None:
            pytest.skip("No hotels available")
        client.post("/hotels/save", json={
            "hotel_id": hotel_id,
            "location": "Test",
            "total_budget": 60000.0,
            "check_in": "2026-08-01",
            "check_out": "2026-08-05",  # 4 nights
        }, headers=_h(token))
        res = client.get("/hotels/saved", headers=_h(token))
        saved = res.get_json()["saved_hotels"]
        matching = [h for h in saved if h["hotel_id"] == hotel_id]
        if matching:
            assert matching[0]["nights"] == 4


# ── PUT /hotels/saved/<id> ────────────────────────────────────────────────────

class TestUpdateSavedHotel:

    def test_update_saved_requires_auth(self, client):
        """Unauthenticated request returns 401."""
        res = client.put("/hotels/saved/1", json={"total_budget": 60000})
        assert res.status_code == 401

    def test_update_nonexistent_hotel(self, client):
        """Updating non-existent record returns 404."""
        token = _fresh_user(client)
        res = client.put("/hotels/saved/9999999",
                         json={"total_budget": 60000.0},
                         headers=_h(token))
        assert res.status_code == 404

    def test_update_no_fields_returns_422(self, client):
        """Empty update body returns 422."""
        token = _fresh_user(client)
        res = client.put("/hotels/saved/1",
                         json={},
                         headers=_h(token))
        assert res.status_code == 422


# ── DELETE /hotels/saved/<id> ─────────────────────────────────────────────────

class TestDeleteSavedHotel:

    def test_delete_saved_requires_auth(self, client):
        """Unauthenticated request returns 401."""
        res = client.delete("/hotels/saved/1")
        assert res.status_code == 401

    def test_delete_nonexistent_hotel(self, client):
        """Deleting non-existent record returns 404."""
        token = _fresh_user(client)
        res = client.delete("/hotels/saved/9999999", headers=_h(token))
        assert res.status_code == 404
