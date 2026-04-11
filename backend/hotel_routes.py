"""
hotel_routes.py  —  backend/
Member 4's hotel recommender, integrated into the main Flask backend.

Correct two-table flow (matches schema design):
  hotel table
    → [KMeans model predicts cluster]
    → recommended_hotels  (AI staging table — cleared + re-filled each visit)
    → [user clicks Save + picks dates]
    → selected_hotels  (user's confirmed choices with check_in/check_out)

Place hotel_model.joblib in backend/ alongside this file.

Endpoints:
  GET    /hotels              → run AI, save to recommended_hotels, return list
  POST   /hotels/save         → move hotel from recommended → selected_hotels
  GET    /hotels/saved        → user's selected hotels
  PUT    /hotels/saved/<id>   → edit budget / dates
  DELETE /hotels/saved/<id>   → remove from selected
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

# ── Load KMeans model ──────────────────────────────────────────────────────────
_MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hotel_model.joblib")
_hotel_model = None

def _get_model():
    global _hotel_model
    if _hotel_model is None and os.path.exists(_MODEL_PATH):
        try:
            _hotel_model = joblib.load(_MODEL_PATH)
            print(f"[hotel_routes] Hotel KMeans model loaded")
        except Exception as e:
            print(f"[hotel_routes] Could not load model: {e}")
    return _hotel_model


def _predict_cluster(o, c, e, a, n) -> int | None:
    """
    Predict hotel cluster from OCEAN scores (0-10 scale from DB).
    Model was trained on 0-1 scale → divide by 10.
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
    Full two-table flow:
      1. Read user OCEAN scores from quiz_result
      2. Predict hotel cluster (KMeans)
      3. Query hotel table filtered by cluster + saved locations
      4. Write results to recommended_hotels (clears old rows first)
      5. Return enriched list to frontend

    If the model is unavailable, returns hotels filtered by location only.
    If no quiz result → 400.
    """
    # ── 1. OCEAN scores ──────────────────────────────────────────────────────
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

    # ── 2. Predict cluster ───────────────────────────────────────────────────
    cluster = _predict_cluster(o, c, e, a, n)

    # ── 3. Get hotels from hotel table ───────────────────────────────────────
    if cluster is not None:
        hotels_rows = db.execute(
            text("""
                 SELECT hotel_id, name, location, budget_per_night
                 FROM hotel
                 WHERE cluster_id = :cl
                 ORDER BY name
                 """),
            {"cl": cluster}
        ).fetchall()
    else:
        hotels_rows = db.execute(
            text("SELECT hotel_id, name, location, budget_per_night FROM hotel ORDER BY name")
        ).fetchall()

    # ── 4. Filter by saved locations ─────────────────────────────────────────
    saved_loc_row = db.execute(
        text("""
             SELECT selected_destination FROM selected_locations
             WHERE user_id = :uid
             ORDER BY created_at DESC LIMIT 1
             """),
        {"uid": current_user.user_id}
    ).fetchone()

    saved_locations = []
    if saved_loc_row and saved_loc_row[0]:
        saved_locations = [loc.strip().lower() for loc in saved_loc_row[0].split("|") if loc.strip()]

    results = []
    for h in hotels_rows:
        hotel_loc_lower = (h[2] or "").lower()
        if saved_locations:
            if not any(loc in hotel_loc_lower or hotel_loc_lower in loc for loc in saved_locations):
                continue
        results.append({
            "hotel_id":         h[0],
            "name":             h[1],
            "location":         h[2],
            "budget_per_night": float(h[3]) if h[3] else 0,
        })

    results = results[:10]

    # ── 5. Write to recommended_hotels (clear + re-fill) ────────────────────
    # This is what the recommended_hotels table is designed for:
    # it stores the AI's current recommendation set for this user.
    try:
        db.execute(
            text("DELETE FROM recommended_hotels WHERE user_id = :uid"),
            {"uid": current_user.user_id}
        )
        for hotel in results:
            db.execute(
                text("""
                     INSERT INTO recommended_hotels (user_id, hotel_id, location)
                     VALUES (:uid, :hid, :loc)
                     """),
                {
                    "uid": current_user.user_id,
                    "hid": hotel["hotel_id"],
                    "loc": hotel["location"],
                }
            )
        db.commit()
    except Exception as e:
        # Non-fatal — recommendations still returned even if staging write fails
        db.rollback()
        print(f"[hotel_routes] WARNING: could not write to recommended_hotels: {e}")

    return jsonify({
        "personality_cluster": cluster,
        "locations_used":      saved_locations,
        "count":               len(results),
        "hotels":              results,
    }), 200


# ── POST /hotels/save ──────────────────────────────────────────────────────────
@hotels_router.post("/hotels/save")
@login_required
def save_hotel(current_user, db):
    """
    Save a hotel to selected_hotels with check-in/check-out dates and budget.
    Body: { hotel_id, location, total_budget, check_in, check_out }
    check_in / check_out are stored as strings e.g. "2025-08-01"
    """
    data         = request.get_json(silent=True) or {}
    hotel_id     = data.get("hotel_id")
    location     = data.get("location", "")
    total_budget = data.get("total_budget")
    check_in     = data.get("check_in", "")
    check_out    = data.get("check_out", "")

    if not hotel_id or total_budget is None:
        return jsonify({"detail": "hotel_id and total_budget are required"}), 422

    try:
        # ON CONFLICT: if same user already saved same hotel, update it
        db.execute(
            text("""
                 INSERT INTO selected_hotels
                     (user_id, hotel_id, location, total_budget, check_in, check_out)
                 VALUES (:uid, :hid, :loc, :budget, :ci, :co)
                     ON CONFLICT (user_id, hotel_id) DO UPDATE
                                                            SET total_budget = :budget,
                                                            location     = :loc,
                                                            check_in     = :ci,
                                                            check_out    = :co,
                                                            created_at   = CURRENT_TIMESTAMP
                 """),
            {
                "uid":    current_user.user_id,
                "hid":    hotel_id,
                "loc":    location,
                "budget": float(total_budget),
                "ci":     check_in,
                "co":     check_out,
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
    """Returns all hotels the user has saved, including check-in/check-out dates."""
    rows = db.execute(
        text("""
             SELECT sh.id, sh.hotel_id, h.name, sh.location,
                    sh.total_budget, sh.check_in, sh.check_out, sh.created_at
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
            "check_in":     r[5] or "",
            "check_out":    r[6] or "",
            "saved_at":     r[7].isoformat() if r[7] else None,
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
def update_saved_hotel(current_user, db, row_id):
    """Update budget and/or check-in/check-out dates for a saved hotel."""
    data = request.get_json(silent=True) or {}

    fields = []
    params = {"rid": row_id, "uid": current_user.user_id}

    if "total_budget" in data:
        fields.append("total_budget = :budget")
        params["budget"] = float(data["total_budget"])
    if "check_in" in data:
        fields.append("check_in = :ci")
        params["ci"] = data["check_in"]
    if "check_out" in data:
        fields.append("check_out = :co")
        params["co"] = data["check_out"]

    if not fields:
        return jsonify({"detail": "Nothing to update"}), 422

    try:
        result = db.execute(
            text(f"""
                UPDATE selected_hotels
                SET {', '.join(fields)}
                WHERE id = :rid AND user_id = :uid
            """),
            params
        )
        db.commit()
        if result.rowcount == 0:
            return jsonify({"detail": "Hotel not found or not yours"}), 404
    except Exception as e:
        db.rollback()
        return jsonify({"detail": str(e)}), 500

    return jsonify({"message": "Hotel updated"}), 200


# ── DELETE /hotels/saved/<id> ─────────────────────────────────────────────────
@hotels_router.delete("/hotels/saved/<int:row_id>")
@login_required
def delete_saved_hotel(current_user, db, row_id):
    """Remove a hotel from the user's saved list."""
    try:
        result = db.execute(
            text("DELETE FROM selected_hotels WHERE id = :rid AND user_id = :uid"),
            {"rid": row_id, "uid": current_user.user_id}
        )
        db.commit()
        if result.rowcount == 0:
            return jsonify({"detail": "Hotel not found or not yours"}), 404
    except Exception as e:
        db.rollback()
        return jsonify({"detail": str(e)}), 500

    return jsonify({"message": "Hotel removed"}), 200