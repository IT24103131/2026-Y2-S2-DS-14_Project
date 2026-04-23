from sqlalchemy import text
from policy_store import save_policy
from bandit import beta_update
from mapping import normalize_personality

# Default arms — one entry per itinerary type
DEFAULT_ARMS = {
    "peaceful":  {"alpha": 1.0, "beta": 1.0},
    "cultural":  {"alpha": 1.0, "beta": 1.0},
    "adventure": {"alpha": 1.0, "beta": 1.0},
    "beach":     {"alpha": 1.0, "beta": 1.0},
    "budget":    {"alpha": 1.0, "beta": 1.0},
}

# All known personality clusters — always present in policy even with no feedback
KNOWN_CLUSTERS = [
    "adventurous explorer",
    "balanced traveler",
    "friendly cultural",
    "organized sightseer",
    "calm & relaxed",
]


def _fresh_policy() -> dict:
    """
    Build a clean policy with all known clusters and all default arms
    starting at alpha=1.0, beta=1.0.
    This is the correct starting point before replaying feedback rows.
    """
    policy = {}
    for cluster in KNOWN_CLUSTERS:
        policy[cluster] = {
            arm: defaults.copy()
            for arm, defaults in DEFAULT_ARMS.items()
        }
    return policy


def train_from_db(db, limit: int = 5000) -> dict:
    """
    Rebuild the policy from scratch by replaying every row in
    rl_feedback_log on top of fresh alpha=1.0 / beta=1.0 starting values.

    WHY we reset instead of loading the existing policy:
      - Every call to /train replays ALL rows from rl_feedback_log
      - If we load the existing policy first, each row gets applied AGAIN
        on top of already-accumulated values → numbers grow unboundedly
      - Resetting to 1.0/1.0 first means the policy always reflects
        exactly what is currently in rl_feedback_log — no more, no less
      - This means edit/delete feedback correctly shrinks the values
        instead of leaving ghost accumulation behind

    For each row:
      - cluster_label  = personality type  e.g. "organized sightseer"
      - itinerary_type = arm               e.g. "cultural"
      - reward         = rating 1-5        e.g. 4.0

    High reward → alpha increases → arm more likely to be picked next time
    Low  reward → beta  increases → arm less likely to be picked next time
    """
    # ── Always start from clean 1.0/1.0 values ───────────────────────────────
    # This is the key fix: do NOT load the existing policy.json here.
    policy = _fresh_policy()

    q = text("""
             SELECT cluster_label, itinerary_type, reward
             FROM rl_feedback_log
             ORDER BY created_at ASC
                 LIMIT :limit
             """)
    rows = db.execute(q, {"limit": limit}).fetchall()

    for cluster_label, itinerary_type, reward in rows:
        # normalize_personality handles all variants:
        # "calm and relaxed", "Calm and Relaxed" → "calm & relaxed"
        cluster = normalize_personality(cluster_label)
        arm     = (itinerary_type or "unknown").strip().lower()
        r       = float(reward) if reward is not None else 0.0

        # Create cluster entry if it doesn't exist (e.g. future new types)
        policy.setdefault(cluster, {})
        # Create arm entry if it doesn't exist
        policy[cluster].setdefault(arm, {"alpha": 1.0, "beta": 1.0})
        # Update alpha/beta using Beta distribution update rule
        policy[cluster][arm] = beta_update(policy[cluster][arm], r)

    # Make sure all default arms exist for every cluster in the policy
    for cluster in policy.keys():
        for arm_name, arm_defaults in DEFAULT_ARMS.items():
            policy[cluster].setdefault(arm_name, arm_defaults.copy())

    save_policy(policy)
    return {"clusters": len(policy), "rows_used": len(rows)}
