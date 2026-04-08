from flask import Blueprint, request, jsonify
from sqlalchemy import text

from db import get_db_session
from mapping import normalize_personality, PERSONALITY_TO_DESTINATIONS, PERSONALITY_EXPLANATIONS, DEFAULT_PERSONALITY
from policy_store import load_policy
from bandit import thompson_pick
from trainer import train_from_db

ai_router = Blueprint("ai_router", __name__)

DEFAULT_ARMS = ["peaceful", "cultural", "adventure", "beach", "budget"]


# ── Train endpoint ─────────────────────────────────────────────────────────────

@ai_router.post("/train")
def train():
    """
    Reads all rows from rl_feedback_log and updates alpha/beta values
    in policy.json using the Beta distribution update rule.
    Called automatically after every feedback submit/update/delete.
    """
    db = get_db_session()
    try:
        result = train_from_db(db)
        return jsonify(result), 200
    finally:
        db.close()


# ── Recommend endpoint ────────────────────────────────────────────────────────

@ai_router.post("/recommend")
def recommend():
    """
    Uses Thompson Sampling to pick the best itinerary_type for a user
    based on their personality_type and the current policy.

    Thompson Sampling:
    - Each itinerary_type (arm) has alpha and beta values
    - We sample from each arm's Beta distribution
    - The arm with the highest sample is picked
    - This balances exploration (trying new types) with
      exploitation (picking known good types)
    """
    data    = request.get_json() or {}
    user_id = data.get("user_id")

    if user_id is None:
        return jsonify({"detail": "'user_id' is required"}), 422

    db = get_db_session()
    try:
        # 1) Load user from users table
        user_row = db.execute(
            text("SELECT user_id, cluster_label FROM users WHERE user_id = :uid"),
            {"uid": user_id}
        ).fetchone()

        if not user_row:
            return jsonify({"detail": "User not found"}), 404

        user_id_val = int(user_row[0])

        # 2) Read latest personality_type from quiz_result
        qr = db.execute(
            text("""
                 SELECT personality_type
                 FROM quiz_result
                 WHERE user_id = :uid
                 ORDER BY result_id DESC
                     LIMIT 1
                 """),
            {"uid": user_id}
        ).fetchone()

        # 3) Normalize the personality_type to a known key
        personality    = normalize_personality(qr[0] if qr else DEFAULT_PERSONALITY)
        cluster_label  = personality

        # 4) Load policy and get arms for this cluster
        policy         = load_policy()
        arms           = policy.get(cluster_label, {})

        # 5) Use Thompson Sampling to pick the best itinerary_type
        # If no arms exist for this cluster yet, falls back to DEFAULT_ARMS
        itinerary_type = thompson_pick(arms, DEFAULT_ARMS)

        # 6) Get destinations and explanation for this personality
        destinations = PERSONALITY_TO_DESTINATIONS.get(
            personality,
            PERSONALITY_TO_DESTINATIONS[DEFAULT_PERSONALITY]
        )
        explanation = PERSONALITY_EXPLANATIONS.get(
            personality,
            "Personalised based on your psychometric profile."
        )

        return jsonify({
            "user_id":        user_id_val,
            "cluster_label":  cluster_label,
            "itinerary_type": itinerary_type,
            "destinations":   destinations,
            "explanation":    explanation
        }), 200

    finally:
        db.close()