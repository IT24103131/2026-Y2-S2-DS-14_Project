import json
import os

POLICY_PATH = os.getenv("POLICY_PATH", "artifacts/policy.json")


def load_policy() -> dict:
    """Load policy from JSON file. Returns empty dict if file does not exist."""
    if not os.path.exists(POLICY_PATH):
        return {}
    with open(POLICY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_policy(policy: dict) -> None:
    """Save policy to JSON file. Creates directory if it does not exist."""
    dir_name = os.path.dirname(POLICY_PATH)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    with open(POLICY_PATH, "w", encoding="utf-8") as f:
        json.dump(policy, f, indent=2)