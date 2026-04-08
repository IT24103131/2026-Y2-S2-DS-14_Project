"""
hotel_routes.py  —  backend/
Member 4's hotel recommender endpoints, integrated into the main Flask backend.

Integration changes from member 4's original:
  • Flask Blueprint instead of FastAPI — runs on the SAME port 8000 server
  • JWT auth via @login_required — user_id comes from token, never hardcoded
  • OCEAN scores read from quiz_result table — user doesn't re-enter them
  • Hotel filtering uses the user's saved locations from selected_locations
  • hotel_model.joblib must be in backend/ (place it there alongside this file)
  • Model input scale: divide 0-10 stored scores by 10 → 0-1 scale the model expects

Endpoints added:
  GET  /hotels              → recommended hotels for the logged-in user
  POST /hotels/save         → save a hotel to selected_hotels
  GET  /hotels/saved        → get user's saved hotels
  PUT  /hotels/saved/<id>   → update budget for a saved hotel
  DELETE /hotels/saved/<id> → remove a saved hotel
"""

import os
import warnings

import joblib
import pandas as pd
from flask import Blueprint, jsonify, request
from sqlalchemy import text

from models import SessionLocal
from utils import login_required

warnings.filterwarnings("ignore")

hotels_router = Blueprint("hotels_router", __name__)

# ── Load hotel KMeans model ────────────────────────────────────────────────────
_MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hotel_model.joblib")
_hotel_model = None

def _get_model():
    global _hotel_model
    if _hotel_model is None:
        if os.path.exists(_MODEL_PATH):
            try:
                _hotel_model = joblib.load(_MODEL_PATH)
                print(f"[hotel_routes] Hotel model loaded from {_MODEL_PATH}")
            except Exception as e:
                print(f"[hotel_routes] Could not load hotel model: {e}")
        else:
            print(f"[hotel_routes] WARNING: hotel_model.joblib not found at {_MODEL_PATH}")
    return _hotel_model


def _predict_cluster(o: float, c: float, e: float, a: float, n: float) -> int:
    """
    Predict the hotel cluster for a user's OCEAN scores.
    Scores stored in DB are 0-10 scale; model expects 0-1 scale.
    Returns cluster int 0-4, or None if model unavailable.
    """
    model = _get_model()
    if model is None:
        return None
    df = pd.DataFrame([{
        "openness_score":          o / 10.0,
        "conscientiousness_score": c / 10.0,
        "extraversion_score":      e / 10.0,
        "agreeableness_score":     a / 10.0,
        "neuroticism_score":       n / 10.0,
    }])
    return int(model.predict(df)[0])


# ── GET /hotels ────────────────────────────────────────────────────────────────
@hotels_router.get("/hotels")
@login_required
def get_hotel_recommendations(current_user, db):
    """
    Returns recommended hotels for the logged-in user.

    Logic:
    1. Read user's OCEAN scores from their latest quiz_result
    2. Predict hotel cluster using the KMeans model
    3. Fetch matching hotels from the hotel table
    4. Filter by user's saved locations (from selected_locations) if they exist
    5. Return top 10 results

    If no quiz result exists → 400.
    If model unavailable → returns hotels filtered by location only.
    """
    # Step 1: Get OCEAN scores from quiz_result
    qr = db.execute(
        text("""
             SELECT openness_score, conscientiousness_score, extraversion_score,
                    agreeableness_score, neuroticism_score
             FROM quiz_result
             WHERE user_id = :uid
             ORDER BY result_id DESC LIMIT 1
             """),
        {"uid": current_user.user_id}
    ).fetchone()

    if not qr:
        return jsonify({"detail": "Complete the personality quiz first to get hotel recommendations"}), 400

    o, c, e, a, n = [float(x) for x in qr]

    # Step 2: Predict cluster
    cluster = _predict_cluster(o, c, e, a, n)

    # Step 3: Get hotels from DB — filter by cluster if model worked
    if cluster is not None:
        hotels = db.execute(
            text("""
                 SELECT hotel_id, name, location, budget_per_night,
                        openness_score, conscientiousness_score,
                        extraversion_score, agreeableness_score, neuroticism_score
                 FROM hotel
                 WHERE cluster_id = :cluster
                 ORDER BY name
                 """),
            {"cluster": cluster}
        ).fetchall()
    else:
        # Model unavailable — return all hotels
        hotels = db.execute(
            text("""
                 SELECT hotel_id, name, location, budget_per_night,
                        openness_score, conscientiousness_score,
                        extraversion_score, agreeableness_score, neuroticism_score
                 FROM hotel
                 ORDER BY name
                 """)
        ).fetchall()

    # Step 4: Get user's saved locations to filter hotels
    saved_row = db.execute(
        text("""
             SELECT selected_destination FROM selected_locations
             WHERE user_id = :uid
             ORDER BY created_at DESC LIMIT 1
             """),
        {"uid": current_user.user_id}
    ).fetchone()

    saved_locations = []
    if saved_row and saved_row[0]:
        # selected_destination is pipe-separated e.g. "Kandy|Ella|Galle"
        saved_locations = [loc.strip().lower() for loc in saved_row[0].split("|") if loc.strip()]

    # Step 5: Filter hotels by saved locations (if any selected)
    results = []
    for h in hotels:
        hotel_dict = {
            "hotel_id":              h[0],
            "name":                  h[1],
            "location":              h[2],
            "budget_per_night":      float(h[3]) if h[3] else 0,
            "openness_score":        float(h[4]) if h[4] else 0,
            "conscientiousness_score": float(h[5]) if h[5] else 0,
            "extraversion_score":    float(h[6]) if h[6] else 0,
            "agreeableness_score":   float(h[7]) if h[7] else 0,
            "neuroticism_score":     float(h[8]) if h[8] else 0,
        }
        if saved_locations:
            hotel_loc_lower = (h[2] or "").lower()
            # Match if any saved location name appears in the hotel's location string
            if any(loc in hotel_loc_lower or hotel_loc_lower in loc for loc in saved_locations):
                results.append(hotel_dict)
        else:
            results.append(hotel_dict)

    # Cap at 10 results
    results = results[:10]

    return jsonify({
        "personality_cluster":  cluster,
        "locations_used":       saved_locations,
        "count":                len(results),
        "hotels":               results,
    }), 200


# ── POST /hotels/save ──────────────────────────────────────────────────────────
@hotels_router.post("/hotels/save")
@login_required
def save_hotel(current_user, db):
    """
    Save a hotel to the user's selected_hotels.
    Body: { hotel_id, location, total_budget }
    """
    data         = request.get_json(silent=True) or {}
    hotel_id     = data.get("hotel_id")
    location     = data.get("location", "")
    total_budget = data.get("total_budget")

    if not hotel_id or total_budget is None:
        return jsonify({"detail": "hotel_id and total_budget are required"}), 422

    try:
        db.execute(
            text("""
                 INSERT INTO selected_hotels (user_id, hotel_id, location, total_budget)
                 VALUES (:uid, :hid, :loc, :budget)
                     ON CONFLICT (user_id, hotel_id) DO UPDATE
                                                            SET total_budget = :budget,
                                                            location     = :loc,
                                                            created_at   = CURRENT_TIMESTAMP
                 """),
            {
                "uid":    current_user.user_id,
                "hid":    hotel_id,
                "loc":    location,
                "budget": float(total_budget),
            }
        )
        db.commit()
    except Exception as e:
        db.rollback()
        return jsonify({"detail": f"Database error: {str(e)}"}), 500

    return jsonify({"message": "Hotel saved successfully"}), 200


# ── GET /hotels/saved ─────────────────────────────────────────────────────────
@hotels_router.get("/hotels/saved")
@login_required
def get_saved_hotels(current_user, db):
    """Returns all hotels the user has saved."""
    rows = db.execute(
        text("""
             SELECT sh.id, sh.hotel_id, h.name, sh.location, sh.total_budget, sh.created_at
             FROM selected_hotels sh
                      JOIN hotel h ON sh.hotel_id = h.hotel_id
             WHERE sh.user_id = :uid
             ORDER BY sh.created_at DESC
             """),
        {"uid": current_user.user_id}
    ).fetchall()

    saved = []
    for r in rows:
        saved.append({
            "id":           r[0],
            "hotel_id":     r[1],
            "name":         r[2],
            "location":     r[3],
            "total_budget": float(r[4]) if r[4] else 0,
            "saved_at":     r[5].isoformat() if r[5] else None,
        })

    grand_total = sum(h["total_budget"] for h in saved)

    return jsonify({
        "saved_hotels": saved,
        "grand_total":  grand_total,
        "count":        len(saved),
    }), 200


# ── PUT /hotels/saved/<id> ────────────────────────────────────────────────────
@hotels_router.put("/hotels/saved/<int:row_id>")
@login_required
def update_hotel_budget(current_user, db, row_id):
    """Update the planned budget for a saved hotel."""
    data = request.get_json(silent=True) or {}
    new_budget = data.get("total_budget")
    if new_budget is None:
        return jsonify({"detail": "total_budget is required"}), 422

    try:
        result = db.execute(
            text("""
                 UPDATE selected_hotels
                 SET total_budget = :budget
                 WHERE id = :rid AND user_id = :uid
                 """),
            {"budget": float(new_budget), "rid": row_id, "uid": current_user.user_id}
        )
        db.commit()
        if result.rowcount == 0:
            return jsonify({"detail": "Hotel not found or not yours"}), 404
    except Exception as e:
        db.rollback()
        return jsonify({"detail": str(e)}), 500

    return jsonify({"message": "Budget updated"}), 200


# ── DELETE /hotels/saved/<id> ─────────────────────────────────────────────────
@hotels_router.delete("/hotels/saved/<int:row_id>")
@login_required
def delete_saved_hotel(current_user, db, row_id):
    """Remove a hotel from the user's saved list."""
    try:
        result = db.execute(
            text("""
                 DELETE FROM selected_hotels
                 WHERE id = :rid AND user_id = :uid
                 """),
            {"rid": row_id, "uid": current_user.user_id}
        )
        db.commit()
        if result.rowcount == 0:
            return jsonify({"detail": "Hotel not found or not yours"}), 404
    except Exception as e:
        db.rollback()
        return jsonify({"detail": str(e)}), 500

    return jsonify({"message": "Hotel removed"}), 200