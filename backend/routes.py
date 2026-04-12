from flask import Blueprint, request, jsonify
from sqlalchemy import func
from datetime import datetime, timedelta
import requests
import json
import os

from models import (
    SessionLocal, User, QuizResult, Itinerary, Feedback, RLFeedbackLog,
    Destination, DailyPlan, ScheduledActivity, OptimizedRoute
)
from utils import (
    hash_password, verify_password, create_access_token, login_required
)
from config import Config

router = Blueprint("router", __name__)

# ── Personality type → itinerary_type mapping ─────────────────────────────────
PERSONALITY_TO_ITINERARY_TYPE = {
    "adventurous explorer": "adventure",
    "balanced traveler":    "peaceful",
    "friendly cultural":    "cultural",
    "organized sightseer":  "cultural",
    "calm & relaxed":       "beach",
}

PERSONALITY_EXPLANATIONS = {
    "adventurous explorer": "High energy destinations — wildlife, surf towns, and dramatic landscapes.",
    "balanced traveler":    "A mix of calm coasts and cultural depth, perfectly paced.",
    "friendly cultural":    "Sacred sites, local communities, and rich traditions.",
    "organized sightseer":  "Well-structured city visits and heritage sites.",
    "calm & relaxed":       "Quiet beaches and laid-back coastal towns to recharge.",
}

ACTIVITY_SLOTS = ["09:00", "12:00", "15:00"]


# ── Helper — trigger AI retraining ────────────────────────────────────────────

def trigger_retrain():
    """
    Call the AI service /train endpoint to retrain the RL policy.
    Called after every feedback create, update, and delete.
    Non-fatal — if AI service is down, backend still works fine.
    """
    try:
        requests.post(f"{Config.AI_BASE_URL}/train", timeout=30)
    except Exception:
        pass


# ── Auth ──────────────────────────────────────────────────────────────────────

@router.post("/register")
def register():
    data           = request.get_json() or {}
    username       = data.get("username", "").strip()
    email          = data.get("email", "").strip()
    password       = data.get("password", "").strip()
    contact_number = data.get("contact_number", "").strip()

    if not username or not email or not password:
        return jsonify({"detail": "username, email and password are required"}), 422

    db = SessionLocal()
    try:
        existing = db.query(User).filter(
            (User.username == username) | (User.email == email)
        ).first()
        if existing:
            return jsonify({"detail": "Username or email already registered"}), 400

        new_user = User(
            username       = username,
            email          = email,
            password_hash  = hash_password(password),
            contact_number = contact_number if contact_number else None
        )
        db.add(new_user)
        db.commit()
        return jsonify({"message": "Registered"}), 201
    finally:
        db.close()


@router.post("/login")
def login():
    if request.content_type and "application/x-www-form-urlencoded" in request.content_type:
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()
    else:
        data     = request.get_json() or {}
        username = data.get("username", "").strip()
        password = data.get("password", "").strip()

    if not username or not password:
        return jsonify({"detail": "username and password are required"}), 422

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user or not verify_password(password, user.password_hash):
            return jsonify({"detail": "Invalid credentials"}), 401

        access_token = create_access_token(
            data={"sub": str(user.user_id)},
            expires_delta=timedelta(minutes=30)
        )

        quiz_completed = db.query(QuizResult).filter(
            QuizResult.user_id == user.user_id
        ).first() is not None

        return jsonify({
            "access_token":   access_token,
            "token_type":     "bearer",
            "quiz_completed": quiz_completed
        }), 200
    finally:
        db.close()


# ── Personality / Quiz ────────────────────────────────────────────────────────

@router.post("/personality")
@login_required
def save_personality(current_user, db):
    data = request.get_json() or {}

    required_fields = [
        "openness_score", "conscientiousness_score", "extraversion_score",
        "agreeableness_score", "neuroticism_score", "personality_type"
    ]
    for field in required_fields:
        if field not in data:
            return jsonify({"detail": f"'{field}' is required"}), 422

    score_fields = [
        "openness_score", "conscientiousness_score", "extraversion_score",
        "agreeableness_score", "neuroticism_score"
    ]
    for field in score_fields:
        val = data.get(field)
        try:
            val = float(val)
        except (TypeError, ValueError):
            return jsonify({"detail": f"'{field}' must be a number"}), 422
        if not (0 <= val <= 10):
            return jsonify({"detail": f"'{field}' must be between 0 and 10"}), 422

    personality_type = str(data.get("personality_type", "")).strip()
    if not personality_type:
        return jsonify({"detail": "'personality_type' is required"}), 422

    qr = QuizResult(
        user_id                 = current_user.user_id,
        openness_score          = data["openness_score"],
        conscientiousness_score = data["conscientiousness_score"],
        extraversion_score      = data["extraversion_score"],
        agreeableness_score     = data["agreeableness_score"],
        neuroticism_score       = data["neuroticism_score"],
        personality_type        = personality_type,
        duration                = data.get("duration"),
    )
    db.add(qr)

    # Only update cluster_label when the user completes the quiz
    current_user.cluster_label = personality_type.lower()
    db.commit()
    db.refresh(qr)
    db.refresh(current_user)

    return jsonify({
        "message":          "Personality saved",
        "personality_type": qr.personality_type,
        "cluster_label":    current_user.cluster_label
    }), 201


@router.get("/personality")
@login_required
def get_personality(current_user, db):
    result = db.query(QuizResult).filter(
        QuizResult.user_id == current_user.user_id
    ).order_by(QuizResult.result_id.desc()).first()

    if not result:
        return jsonify({"detail": "No personality data"}), 404

    return jsonify({
        "ocean": {
            "openness":          float(result.openness_score)          if result.openness_score          is not None else None,
            "conscientiousness": float(result.conscientiousness_score) if result.conscientiousness_score is not None else None,
            "extraversion":      float(result.extraversion_score)      if result.extraversion_score      is not None else None,
            "agreeableness":     float(result.agreeableness_score)     if result.agreeableness_score     is not None else None,
            "neuroticism":       float(result.neuroticism_score)       if result.neuroticism_score       is not None else None,
        },
        "personality_type": result.personality_type,
        "cluster_label":    current_user.cluster_label
    }), 200


# ── Itinerary generation ──────────────────────────────────────────────────────

@router.post("/itineraries/generate")
@login_required
def generate_itinerary(current_user, db):
    qr = db.query(QuizResult).filter(
        QuizResult.user_id == current_user.user_id
    ).order_by(QuizResult.result_id.desc()).first()

    if not qr:
        return jsonify({"detail": "Complete the personality quiz first"}), 400

    personality_type = (qr.personality_type or "Balanced Traveler").strip()
    vibe_key         = personality_type.lower()

    itinerary_type = PERSONALITY_TO_ITINERARY_TYPE.get(vibe_key, "peaceful")
    try:
        r = requests.post(
            f"{Config.AI_BASE_URL}/recommend",
            json={"user_id": current_user.user_id},
            timeout=15
        )
        if r.ok:
            itinerary_type = r.json().get("itinerary_type", itinerary_type)
    except Exception:
        pass

    # Safely parse duration in case it's stored as a string
    def parse_duration(val):
        if val is None:
            return 3
        try:
            return int(val)
        except (ValueError, TypeError):
            val_str = str(val).lower()
            if "medium" in val_str:
                return 7
            if "long" in val_str:
                return 14
            return 3  # default for short or unknown

    num_days = parse_duration(qr.duration)
    per_day  = 3
    needed   = num_days * per_day

    destinations = db.query(Destination).filter(
        func.lower(Destination.personality_type) == vibe_key
    ).limit(needed).all()

    if len(destinations) < needed:
        destinations = db.query(Destination).limit(needed).all()

    location_names = [d.location for d in destinations]
    explanation    = PERSONALITY_EXPLANATIONS.get(vibe_key, "Personalised based on your personality profile.")
    title          = f"{personality_type} — {itinerary_type.title()} Trip"

    new_it = Itinerary(
        user_id        = current_user.user_id,
        result_id      = qr.result_id,
        title          = title,
        itinerary_type = itinerary_type,
        itinerary_plan = json.dumps({
            "personality_type": personality_type,
            "final_vibe":       personality_type,
            "explanation":      explanation,
            "destinations":     location_names,
        }),
    )
    db.add(new_it)
    db.commit()
    db.refresh(new_it)

    stop_order = 1
    for day_num in range(1, num_days + 1):
        day = DailyPlan(itinerary_id=new_it.id, day_number=day_num)
        db.add(day)
        db.flush()

        slice_start = (day_num - 1) * per_day
        day_locs    = location_names[slice_start: slice_start + per_day]

        for i, loc in enumerate(day_locs):
            db.add(ScheduledActivity(
                day_id     = day.day_id,
                location   = loc,
                start_time = ACTIVITY_SLOTS[i] if i < len(ACTIVITY_SLOTS) else "09:00"
            ))
            db.add(OptimizedRoute(
                itinerary_id = new_it.id,
                location     = loc,
                stop_order   = stop_order
            ))
            stop_order += 1

    db.commit()

    return jsonify({
        "message":        "Itinerary generated",
        "itinerary_id":   new_it.id,
        "itinerary_type": new_it.itinerary_type,
        "title":          new_it.title,
        "destinations":   location_names,
        "explanation":    explanation,
        "num_days":       num_days,
    }), 201


# ── Itinerary CRUD ────────────────────────────────────────────────────────────
"""
PATCH for routes.py — replace the GET /itineraries endpoint with this version.
It fetches the user's saved hotel and guide from DB and attaches them to each
itinerary in the response.

Find and replace the entire @router.get("/itineraries") function in routes.py
with the one below. Everything else in routes.py stays the same.
"""

# ── REPLACE THIS ENTIRE FUNCTION in routes.py ─────────────────────────────────

@router.get("/itineraries")
@login_required
def get_itineraries(current_user, db):
    itineraries = db.query(Itinerary).filter(
        Itinerary.user_id == current_user.user_id
    ).order_by(Itinerary.created_at.desc()).all()

    # ── Fetch user's saved hotel (most recent confirmed) ──────────────────────
    from sqlalchemy import text as sa_text
    hotel_row = db.execute(sa_text("""
                                   SELECT sh.id, h.name, sh.location, sh.total_budget,
                                          sh.check_in, sh.check_out, h.budget_per_night
                                   FROM selected_hotels sh
                                            JOIN hotel h ON sh.hotel_id = h.hotel_id
                                   WHERE sh.user_id = :uid
                                   ORDER BY sh.created_at DESC
                                       LIMIT 1
                                   """), {"uid": current_user.user_id}).fetchone()

    saved_hotel = None
    if hotel_row:
        saved_hotel = {
            "name":            hotel_row[1],
            "location":        hotel_row[2],
            "total_budget":    float(hotel_row[3]) if hotel_row[3] else 0,
            "check_in":        hotel_row[4] or "",
            "check_out":       hotel_row[5] or "",
            "price_per_night": float(hotel_row[6]) if hotel_row[6] else 0,
        }

    # ── Fetch user's saved guide (most recent confirmed) ──────────────────────
    guide_row = db.execute(sa_text("""
                                   SELECT sg.id, sg.name, sg.language, sg.estimated_budget,
                                          sg.current_status, g.base_location, g.rating, g.daily_rate
                                   FROM selected_guides sg
                                            JOIN guide g ON g.guide_id = sg.guide_id
                                   WHERE sg.user_id = :uid AND sg.current_status = 'confirmed'
                                   ORDER BY sg.id DESC
                                       LIMIT 1
                                   """), {"uid": current_user.user_id}).fetchone()

    saved_guide = None
    if guide_row:
        saved_guide = {
            "name":             guide_row[1],
            "language":         guide_row[2],
            "estimated_budget": float(guide_row[3]) if guide_row[3] else 0,
            "status":           guide_row[4],
            "base_location":    guide_row[5],
            "rating":           float(guide_row[6]) if guide_row[6] else 0,
            "daily_rate":       float(guide_row[7]) if guide_row[7] else 0,
        }

    # ── Build itinerary list ───────────────────────────────────────────────────
    result = []
    for it in itineraries:
        days = db.query(DailyPlan).filter(
            DailyPlan.itinerary_id == it.id
        ).order_by(DailyPlan.day_number).all()

        days_data = []
        for day in days:
            activities = db.query(ScheduledActivity).filter(
                ScheduledActivity.day_id == day.day_id
            ).order_by(ScheduledActivity.start_time).all()

            days_data.append({
                "day_number": day.day_number,
                "activities": [
                    {"location": a.location, "start_time": str(a.start_time)}
                    for a in activities
                ]
            })

        routes_q = db.query(OptimizedRoute).filter(
            OptimizedRoute.itinerary_id == it.id
        ).order_by(OptimizedRoute.stop_order).all()

        plan = {}
        try:
            plan = json.loads(it.itinerary_plan) if it.itinerary_plan else {}
        except Exception:
            pass

        result.append({
            "itinerary_id":    it.id,
            "title":           it.title,
            "itinerary_type":  it.itinerary_type,
            "created_at":      it.created_at.isoformat() if it.created_at else None,
            "updated_at":      it.updated_at.isoformat() if it.updated_at else None,
            "personality_type":plan.get("personality_type", ""),
            "final_vibe":      plan.get("personality_type", ""),
            "explanation":     plan.get("explanation", ""),
            "destinations":    plan.get("destinations", []),
            "days":            days_data,
            "optimized_route": [r.location for r in routes_q],
            # ── Full optimizer JSON (present for optimized trips, empty for AI trips)
            "optimizer_plan":  plan if plan.get("ordered_clusters") else None,
            # ── User's saved hotel + guide (same for all itineraries of this user)
            "saved_hotel":     saved_hotel,
            "saved_guide":     saved_guide,
        })

    return jsonify(result), 200

@router.put("/itineraries/<int:itinerary_id>")
@login_required
def update_itinerary(current_user, db, itinerary_id):
    it = db.query(Itinerary).filter(
        Itinerary.id == itinerary_id,
        Itinerary.user_id == current_user.user_id
    ).first()
    if not it:
        return jsonify({"detail": "Itinerary not found"}), 404

    data = request.get_json() or {}
    if "title" in data:
        it.title = data["title"]
    if "itinerary_type" in data:
        it.itinerary_type = data["itinerary_type"]
    if "itinerary_plan" in data:
        it.itinerary_plan = data["itinerary_plan"]

    it.updated_at = datetime.utcnow()
    db.commit()
    return jsonify({"message": "Updated"}), 200


@router.delete("/itineraries/<int:itinerary_id>")
@login_required
def delete_itinerary(current_user, db, itinerary_id):
    it = db.query(Itinerary).filter(
        Itinerary.id == itinerary_id,
        Itinerary.user_id == current_user.user_id
    ).first()
    if not it:
        return jsonify({"detail": "Itinerary not found"}), 404

    db.delete(it)
    db.commit()
    return jsonify({"message": "Deleted"}), 200


# ── Feedback ──────────────────────────────────────────────────────────────────

@router.post("/feedback")
@login_required
def submit_feedback(current_user, db):
    """
    Submit a new feedback rating for an itinerary.
    RL Loop:
    1. Saves Feedback row  (rating + comment + reward)
    2. Saves RLFeedbackLog (cluster_label + itinerary_type + reward)
    3. Calls trigger_retrain() → AI updates alpha/beta in policy.json
    """
    data         = request.get_json() or {}
    itinerary_id = data.get("itinerary_id")
    rating       = data.get("rating")
    comment      = data.get("comment")

    if itinerary_id is None:
        return jsonify({"detail": "'itinerary_id' is required"}), 422
    if rating is None:
        return jsonify({"detail": "'rating' is required"}), 422
    try:
        rating = int(rating)
    except (TypeError, ValueError):
        return jsonify({"detail": "'rating' must be an integer"}), 422
    if not (1 <= rating <= 5):
        return jsonify({"detail": "'rating' must be between 1 and 5"}), 422

    it = db.query(Itinerary).filter(
        Itinerary.id == itinerary_id,
        Itinerary.user_id == current_user.user_id
    ).first()
    if not it:
        return jsonify({"detail": "Itinerary not found"}), 404

    # Get cluster from quiz result — never overwrite cluster_label on user
    qr = db.query(QuizResult).filter(
        QuizResult.user_id == current_user.user_id
    ).order_by(QuizResult.result_id.desc()).first()

    cluster = (
        qr.personality_type.strip().lower()
        if qr and qr.personality_type
        else (current_user.cluster_label or "unknown").strip().lower()
    )

    reward = float(rating)

    new_fb = Feedback(
        itinerary_id = itinerary_id,
        user_id      = current_user.user_id,
        rating       = rating,
        comment      = comment,
        reward       = reward
    )
    db.add(new_fb)
    db.commit()
    db.refresh(new_fb)

    rl_row = RLFeedbackLog(
        user_id        = current_user.user_id,
        itinerary_id   = it.id,
        feedback_id    = new_fb.id,
        cluster_label  = cluster,
        itinerary_type = it.itinerary_type,
        reward         = reward
    )
    db.add(rl_row)
    db.commit()

    # ── Trigger RL retraining ──────────────────────────────────────────────────
    trigger_retrain()

    return jsonify({
        "message":            "Feedback submitted",
        "reward":             reward,
        "feedback_id":        new_fb.id,
        "cluster_label_used": cluster
    }), 201


@router.get("/feedback")
@login_required
def get_my_feedbacks(current_user, db):
    """
    Get all feedbacks for current user.
    No RL retraining here — just reading data.
    """
    rows = (
        db.query(Feedback, Itinerary.title, Itinerary.itinerary_type)
        .join(Itinerary, Feedback.itinerary_id == Itinerary.id)
        .filter(Feedback.user_id == current_user.user_id)
        .order_by(Feedback.created_at.desc())
        .all()
    )
    return jsonify([
        {
            "feedback_id":     fb.id,
            "itinerary_id":    fb.itinerary_id,
            "itinerary_title": title,
            "itinerary_type":  itype,
            "rating":          fb.rating,
            "comment":         fb.comment,
            "reward":          float(fb.reward) if fb.reward is not None else None,
            "created_at":      fb.created_at.isoformat() if fb.created_at else None,
        }
        for fb, title, itype in rows
    ]), 200


@router.put("/feedback/<int:feedback_id>")
@login_required
def update_feedback(current_user, db, feedback_id):
    """
    Update rating and/or comment for an existing feedback.
    RL Loop:
    1. Updates Feedback row (new rating + reward)
    2. Cascades new reward to RLFeedbackLog row
    3. Calls trigger_retrain() → AI relearns with new rating
    """
    fb = db.query(Feedback).filter(
        Feedback.id == feedback_id,
        Feedback.user_id == current_user.user_id
    ).first()
    if not fb:
        return jsonify({"detail": "Feedback not found"}), 404

    data = request.get_json() or {}

    if "rating" in data and data["rating"] is not None:
        try:
            rating = int(data["rating"])
        except (TypeError, ValueError):
            return jsonify({"detail": "'rating' must be an integer"}), 422
        if not (1 <= rating <= 5):
            return jsonify({"detail": "'rating' must be between 1 and 5"}), 422
        fb.rating = rating
        fb.reward = float(rating)

    if "comment" in data:
        fb.comment = data["comment"]

    db.commit()
    db.refresh(fb)

    # Cascade reward to rl_feedback_log so trainer reads updated value
    if "rating" in data and data["rating"] is not None:
        rl_row = db.query(RLFeedbackLog).filter(
            RLFeedbackLog.feedback_id == feedback_id
        ).first()
        if rl_row:
            rl_row.reward = float(fb.rating)
            db.commit()

    # ── Trigger RL retraining ──────────────────────────────────────────────────
    trigger_retrain()

    return jsonify({
        "message":     "Feedback updated and AI policy retrained",
        "feedback_id": fb.id,
        "new_rating":  fb.rating,
        "new_reward":  float(fb.reward),
    }), 200


@router.delete("/feedback/<int:feedback_id>")
@login_required
def delete_feedback(current_user, db, feedback_id):
    """
    Delete feedback and its RL log row.
    RL Loop:
    1. Deletes RLFeedbackLog row first (FK constraint)
    2. Deletes Feedback row
    3. Calls trigger_retrain() → policy retrained without this rating
    """
    fb = db.query(Feedback).filter(
        Feedback.id == feedback_id,
        Feedback.user_id == current_user.user_id
    ).first()
    if not fb:
        return jsonify({"detail": "Feedback not found"}), 404

    rl_row = db.query(RLFeedbackLog).filter(
        RLFeedbackLog.feedback_id == feedback_id
    ).first()
    if rl_row:
        db.delete(rl_row)
        db.commit()

    db.delete(fb)
    db.commit()

    # ── Trigger RL retraining ──────────────────────────────────────────────────
    trigger_retrain()

    return jsonify({"message": "Feedback deleted and AI policy retrained"}), 200


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/analytics/personality-distribution")
def personality_distribution():
    db = SessionLocal()
    try:
        rows = db.query(
            User.cluster_label,
            func.count(User.user_id)
        ).group_by(User.cluster_label).all()
        return jsonify([{"cluster_label": r[0], "count": r[1]} for r in rows]), 200
    finally:
        db.close()


@router.get("/analytics/itinerary-performance")
def itinerary_performance():
    db = SessionLocal()
    try:
        rows = db.query(
            RLFeedbackLog.itinerary_type,
            func.avg(RLFeedbackLog.reward),
            func.count(RLFeedbackLog.feedback_id)
        ).group_by(RLFeedbackLog.itinerary_type).all()
        return jsonify([
            {
                "itinerary_type": r[0],
                "avg_reward":     float(r[1]) if r[1] else 0,
                "feedback_count": r[2]
            }
            for r in rows
        ]), 200
    finally:
        db.close()


@router.get("/analytics/reward-trend")
def reward_trend():
    db = SessionLocal()
    try:
        rows = db.query(
            func.date(RLFeedbackLog.created_at),
            func.avg(RLFeedbackLog.reward)
        ).group_by(func.date(RLFeedbackLog.created_at)).all()
        return jsonify([
            {"date": str(r[0]), "avg_reward": float(r[1]) if r[1] else 0}
            for r in rows
        ]), 200
    finally:
        db.close()


@router.get("/analytics/rl-policy")
def get_rl_policy():
    """Return current policy.json — useful to verify alpha/beta are changing."""
    policy_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "ai", "app", "artifacts", "policy.json")
    )
    if not os.path.exists(policy_path):
        return jsonify({"message": f"Policy not found at {policy_path}"}), 200
    with open(policy_path, "r", encoding="utf-8") as f:
        return jsonify(json.load(f)), 200