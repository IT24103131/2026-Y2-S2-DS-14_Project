"""
guide_routes.py  —  backend/
Guide recommender and booking endpoints as a Flask Blueprint.

SELECT queries now include all 9 new guide columns so guide_recommender.py
gets real data instead of defaults.
"""

import re
from flask import Blueprint, request, jsonify
from sqlalchemy import text

from models import SessionLocal
from utils import login_required
from guide_recommender import get_top_guides

guides_router = Blueprint("guides_router", __name__)

# All guide columns the RF model needs — keeps SELECT lists DRY
_GUIDE_COLS = """
    guide_id, name, language_spoken, status, daily_rate, base_location, rating,
    openness_score, conscientiousness_score, extraversion_score,
    agreeableness_score, neuroticism_score,
    years_of_experience, repeat_client_rate, avg_tour_duration,
    locations_covered, number_of_languages, certified,
    award_or_recognition, specialization, tourist_type_preference
"""

def _parse_duration(raw) -> int:
    if raw is None:
        return 3
    try:
        return int(raw)
    except (ValueError, TypeError):
        nums = re.findall(r"\d+", str(raw))
        return int(nums[0]) if nums else 3


def _row_to_guide_dict(r) -> dict:
    """Maps a DB row (from the full _GUIDE_COLS select) to a dict."""
    return {
        "guide_id":                r[0],
        "name":                    r[1],
        "language_spoken":         r[2],
        "status":                  r[3],
        "daily_rate":              float(r[4])  if r[4]  else 0,
        "base_location":           r[5],
        "rating":                  float(r[6])  if r[6]  else 0,
        "openness_score":          float(r[7])  if r[7]  else 5,
        "conscientiousness_score": float(r[8])  if r[8]  else 5,
        "extraversion_score":      float(r[9])  if r[9]  else 5,
        "agreeableness_score":     float(r[10]) if r[10] else 5,
        "neuroticism_score":       float(r[11]) if r[11] else 5,
        # New columns
        "years_of_experience":     float(r[12]) if r[12] is not None else 5,
        "repeat_client_rate":      float(r[13]) if r[13] is not None else 60.0,
        "avg_tour_duration":       float(r[14]) if r[14] is not None else 3.0,
        "locations_covered":       int(r[15])   if r[15] is not None else 3,
        "number_of_languages":     int(r[16])   if r[16] is not None else 1,
        "certified":               int(r[17])   if r[17] is not None else 0,
        "award_or_recognition":    int(r[18])   if r[18] is not None else 0,
        "specialization":          r[19] or "Cultural",
        "tourist_type_preference": r[20] or "All",
    }


# ── GET /guides ────────────────────────────────────────────────────────────────
@guides_router.get("/guides")
@login_required
def get_all_guides(current_user, db):
    """Admin view — returns all guides."""
    rows = db.execute(text(f"SELECT {_GUIDE_COLS} FROM guide ORDER BY name")).fetchall()
    return jsonify([_row_to_guide_dict(r) for r in rows]), 200


# ── GET /guides/recommend ──────────────────────────────────────────────────────
@guides_router.get("/guides/recommend")
@login_required
def recommend_guides(current_user, db):
    """
    AI-recommended guides for the logged-in user.
    Query param: ?language=Sinhala|Tamil|English|All  (default: All)

    Flow:
      1. Read OCEAN from quiz_result
      2. Read saved locations from selected_locations
      3. Query guide table (filtered by location + language)
      4. Rank with RF model + OCEAN similarity + vibe bonus
      5. Write top 3 to recommended_guides table
      6. Return results
    """
    language = request.args.get("language", "All")

    # ── 1. OCEAN scores ──────────────────────────────────────────────────────
    qr = db.execute(text("""
                         SELECT openness_score, conscientiousness_score, extraversion_score,
                                agreeableness_score, neuroticism_score, duration
                         FROM quiz_result
                         WHERE user_id = :uid
                         ORDER BY result_id DESC LIMIT 1
                         """), {"uid": current_user.user_id}).fetchone()

    if not qr:
        return jsonify({"detail": "Complete the personality quiz first"}), 400

    user_ocean = {
        "openness":          float(qr[0] or 5),
        "conscientiousness": float(qr[1] or 5),
        "extraversion":      float(qr[2] or 5),
        "agreeableness":     float(qr[3] or 5),
        "neuroticism":       float(qr[4] or 5),
    }
    duration = _parse_duration(qr[5])

    # ── 2. Saved locations ───────────────────────────────────────────────────
    loc_rows = db.execute(text("""
                               SELECT selected_destination FROM selected_locations WHERE user_id = :uid
                               """), {"uid": current_user.user_id}).fetchall()

    location_list = []
    for row in loc_rows:
        if row[0]:
            location_list.extend([p.strip() for p in row[0].split("|") if p.strip()])

    lang_filter = f"%{language}%" if language != "All" else "%"

    # ── 3. Query guides ──────────────────────────────────────────────────────
    if location_list:
        loc_clauses = " OR ".join([f"base_location ILIKE :loc{i}" for i in range(len(location_list))])
        params = {"lang": lang_filter}
        for i, loc in enumerate(location_list):
            params[f"loc{i}"] = f"%{loc}%"
        guide_rows = db.execute(text(f"""
            SELECT {_GUIDE_COLS} FROM guide
            WHERE status = 'available'
              AND language_spoken ILIKE :lang
              AND ({loc_clauses})
        """), params).fetchall()
    else:
        guide_rows = []

    # Fallback: no saved locations → all available guides for language
    if not guide_rows:
        guide_rows = db.execute(text(f"""
            SELECT {_GUIDE_COLS} FROM guide
            WHERE status = 'available'
              AND language_spoken ILIKE :lang
        """), {"lang": lang_filter}).fetchall()

    if not guide_rows:
        return jsonify({"guides": [], "message": "No available guides found for the selected language."}), 200

    guides_list = [_row_to_guide_dict(r) for r in guide_rows]

    # ── 4. RF ranking ────────────────────────────────────────────────────────
    top_guides = get_top_guides(guides_list, user_ocean, duration=duration, top_n=3)

    # ── 5. Write to recommended_guides ───────────────────────────────────────
    try:
        db.execute(text("DELETE FROM recommended_guides WHERE user_id = :uid"),
                   {"uid": current_user.user_id})
        for g in top_guides:
            db.execute(text("""
                            INSERT INTO recommended_guides
                            (user_id, guide_id, name, status, language, personality_type, estimated_budget)
                            VALUES (:uid, :gid, :name, :status, :lang, :ptype, :budget)
                            """), {
                           "uid":    current_user.user_id,
                           "gid":    g["guide_id"],
                           "name":   g["name"],
                           "status": g["status"],
                           "lang":   g["language_spoken"],
                           "ptype":  g.get("vibe_label", ""),
                           "budget": g["estimated_budget"],
                       })
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[guide_routes] recommended_guides write failed: {e}")

    return jsonify({
        "guides":  top_guides,
        "message": f"Top {len(top_guides)} guides recommended based on your personality",
    }), 200


# ── POST /guides/book ──────────────────────────────────────────────────────────
@guides_router.post("/guides/book")
@login_required
def book_guide(current_user, db):
    """
    Book a guide.
    Body: { guide_id, name, language, estimated_budget }
    user_id always from JWT.
    """
    data             = request.get_json(silent=True) or {}
    guide_id         = data.get("guide_id")
    name             = data.get("name", "")
    language         = data.get("language", "")
    estimated_budget = data.get("estimated_budget", 0)

    if not guide_id:
        return jsonify({"detail": "guide_id is required"}), 422

    # Block if already has a confirmed booking
    existing = db.execute(text("""
                               SELECT id, name FROM selected_guides
                               WHERE user_id = :uid AND current_status = 'confirmed' LIMIT 1
                               """), {"uid": current_user.user_id}).fetchone()

    if existing:
        return jsonify({"detail": f"You already have an active booking for '{existing[1]}'. Cancel it first."}), 400

    # Check guide exists and is available
    guide = db.execute(text("SELECT guide_id, status FROM guide WHERE guide_id = :gid"),
                       {"gid": guide_id}).fetchone()
    if not guide:
        return jsonify({"detail": "Guide not found"}), 404
    if guide[1] != "available":
        return jsonify({"detail": "This guide is no longer available"}), 400

    try:
        db.execute(text("""
                        INSERT INTO selected_guides (guide_id, user_id, name, language, current_status, estimated_budget)
                        VALUES (:gid, :uid, :name, :lang, 'confirmed', :budget)
                        """), {"gid": guide_id, "uid": current_user.user_id,
                               "name": name, "lang": language, "budget": float(estimated_budget)})
        db.execute(text("UPDATE guide SET status = 'booked' WHERE guide_id = :gid"),
                   {"gid": guide_id})
        db.commit()
    except Exception as e:
        db.rollback()
        return jsonify({"detail": f"Database error: {str(e)}"}), 500

    return jsonify({
        "message":  f"{name} successfully booked!",
        "guide_id": guide_id,
        "user_id":  current_user.user_id,
    }), 200


# ── GET /guides/booking ───────────────────────────────────────────────────────
@guides_router.get("/guides/booking")
@login_required
def get_my_booking(current_user, db):
    """Returns the logged-in user's current guide booking."""
    row = db.execute(text("""
                          SELECT sg.id, sg.name, sg.language, sg.current_status,
                                 sg.estimated_budget, g.base_location, g.rating, g.daily_rate
                          FROM selected_guides sg
                                   JOIN guide g ON g.guide_id = sg.guide_id
                          WHERE sg.user_id = :uid
                          ORDER BY
                              CASE WHEN sg.current_status = 'confirmed' THEN 0 ELSE 1 END,
                              sg.id DESC
                              LIMIT 1
                          """), {"uid": current_user.user_id}).fetchone()

    if not row:
        return jsonify({"detail": "No guide booking found"}), 404

    return jsonify({
        "id":               row[0],
        "name":             row[1],
        "language":         row[2],
        "current_status":   row[3],
        "estimated_budget": float(row[4]) if row[4] else 0,
        "base_location":    row[5],
        "rating":           float(row[6]) if row[6] else 0,
        "daily_rate":       float(row[7]) if row[7] else 0,
    }), 200


# ── PUT /guides/booking/<id>/cancel ───────────────────────────────────────────
@guides_router.put("/guides/booking/<int:selection_id>/cancel")
@login_required
def cancel_booking(current_user, db, selection_id):
    """Cancel booking and make guide available again."""
    row = db.execute(text("""
                          SELECT id, guide_id, current_status FROM selected_guides
                          WHERE id = :sid AND user_id = :uid
                          """), {"sid": selection_id, "uid": current_user.user_id}).fetchone()

    if not row:
        return jsonify({"detail": "Booking not found"}), 404
    if row[2] == "cancelled":
        return jsonify({"detail": "Already cancelled"}), 400

    try:
        db.execute(text("UPDATE selected_guides SET current_status = 'cancelled' WHERE id = :sid"),
                   {"sid": selection_id})
        db.execute(text("UPDATE guide SET status = 'available' WHERE guide_id = :gid"),
                   {"gid": row[1]})
        db.commit()
    except Exception as e:
        db.rollback()
        return jsonify({"detail": str(e)}), 500

    return jsonify({"message": "Booking cancelled"}), 200


# ── PUT /guides/<id>/availability ─────────────────────────────────────────────
@guides_router.put("/guides/<int:guide_id>/availability")
@login_required
def update_guide_availability(current_user, db, guide_id):
    """Admin: toggle guide availability."""
    data   = request.get_json(silent=True) or {}
    status = request.args.get("status") or data.get("status", "available")
    if status not in ("available", "booked"):
        return jsonify({"detail": "status must be 'available' or 'booked'"}), 422
    try:
        result = db.execute(text("UPDATE guide SET status = :s WHERE guide_id = :gid"),
                            {"s": status, "gid": guide_id})
        db.commit()
        if result.rowcount == 0:
            return jsonify({"detail": "Guide not found"}), 404
    except Exception as e:
        db.rollback()
        return jsonify({"detail": str(e)}), 500
    return jsonify({"message": f"Guide {guide_id} updated to {status}"}), 200