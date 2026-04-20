from sqlalchemy import text
from policy_store import load_policy, save_policy
from bandit import beta_update
from mapping import normalize_personality   # ← add this import

# Default arms — one entry per itinerary type
DEFAULT_ARMS = {
    "peaceful":  {"alpha": 1.0, "beta": 1.0},
    "cultural":  {"alpha": 1.0, "beta": 1.0},
    "adventure": {"alpha": 1.0, "beta": 1.0},
    "beach":     {"alpha": 1.0, "beta": 1.0},
    "budget":    {"alpha": 1.0, "beta": 1.0},
}


def train_from_db(db, limit: int = 5000) -> dict:
    """
    Read feedback from rl_feedback_log and update the policy using
    the Beta distribution (Thompson Sampling update rule).

    For each row:
      - cluster_label  = personality type  e.g. "organized sightseer"
      - itinerary_type = arm               e.g. "cultural"
      - reward         = rating 1-5        e.g. 4.0

    High reward → alpha increases → arm more likely to be picked next time
    Low  reward → beta  increases → arm less likely to be picked next time
    """
    policy = load_policy()

    q = text("""
             SELECT cluster_label, itinerary_type, reward
             FROM rl_feedback_log
             ORDER BY created_at DESC
                 LIMIT :limit
             """)
    rows = db.execute(q, {"limit": limit}).fetchall()

    for cluster_label, itinerary_type, reward in rows:
    # normalize_personality handles all variants:
    # "calm and relaxed", "calm & relaxed", "Calm and Relaxed" → "calm & relaxed"
        cluster = normalize_personality(cluster_label)   # ← was: .strip().lower()
        arm     = (itinerary_type or "unknown").strip().lower()
        r       = float(reward) if reward is not None else 0.0

        # Create cluster entry if it doesn't exist
        policy.setdefault(cluster, {})
        # Create arm entry if it doesn't exist
        policy[cluster].setdefault(arm, {"alpha": 1.0, "beta": 1.0})
        # Update alpha/beta using Beta distribution update rule
        policy[cluster][arm] = beta_update(policy[cluster][arm], r)

    # Make sure all default arms exist for every cluster
    for cluster in policy.keys():
        for arm_name, arm_defaults in DEFAULT_ARMS.items():
            policy[cluster].setdefault(arm_name, arm_defaults.copy())

    save_policy(policy)
    return {"clusters": len(policy), "rows_used": len(rows)}