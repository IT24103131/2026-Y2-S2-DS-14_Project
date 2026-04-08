import random


def reward_to_prob(reward: float, max_rating: float = 5.0) -> float:
    """Convert a 1-5 star rating to a probability between 0.0 and 1.0."""
    if max_rating <= 0:
        return 0.0
    p = reward / max_rating
    return max(0.0, min(1.0, p))


def thompson_pick(arms: dict, fallback: list) -> str:
    """
    Thompson Sampling — picks an arm by sampling from each arm's
    Beta distribution. Arms with higher alpha (more positive rewards)
    are more likely to be picked, but there is still some exploration.

    arms = {
        "adventure": {"alpha": 3.5, "beta": 1.2},
        "beach":     {"alpha": 1.0, "beta": 2.0},
        ...
    }
    """
    if not arms:
        return random.choice(fallback)

    best_name, best_score = None, -1.0
    for name, ab in arms.items():
        a = float(ab.get("alpha", 1.0))
        b = float(ab.get("beta",  1.0))
        # Sample from Beta distribution — this is the core of Thompson Sampling
        score = random.betavariate(a, b)
        if score > best_score:
            best_score = score
            best_name  = name

    return best_name or random.choice(fallback)


def beta_update(ab: dict, reward: float) -> dict:
    """
    Update alpha and beta based on the reward received.

    High reward (5 stars) → alpha increases → arm more likely to be picked
    Low reward  (1 star)  → beta increases  → arm less likely to be picked
    """
    a = float(ab.get("alpha", 1.0))
    b = float(ab.get("beta",  1.0))
    p = reward_to_prob(reward)
    return {
        "alpha": a + p,
        "beta":  b + (1.0 - p)
    }