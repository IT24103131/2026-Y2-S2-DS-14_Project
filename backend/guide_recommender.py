"""
guide_recommender.py  —  backend/
Ranks guides using the new RF model + cosine OCEAN similarity + vibe compatibility.

Model files required in backend/:
    rf_model.pkl   — Random Forest classifier (13 features, 3 tiers)
    scaler.pkl     — StandardScaler fitted on same 13 features
    metadata.json  — vibe_map, spec_map, type_map, features list

Called by guide_routes.py with:
    get_top_guides(guides_list, user_ocean, duration=N, top_n=3)

user_ocean keys: "openness", "conscientiousness", "extraversion",
                 "agreeableness", "neuroticism"  (0–10 scale from quiz)
"""

import json
import pickle
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.metrics.pairwise import cosine_similarity

# ── Load model artefacts ──────────────────────────────────────────────────────
_DIR = Path(__file__).resolve().parent   # = backend/

try:
    with open(_DIR / "rf_model.pkl", "rb") as f:
        RF_MODEL = pickle.load(f)
    with open(_DIR / "scaler.pkl", "rb") as f:
        SCALER = pickle.load(f)
    with open(_DIR / "metadata.json", "r") as f:
        META = json.load(f)
    print("[guide_recommender] ✅ RF model, scaler, and metadata loaded.")
except FileNotFoundError as e:
    print(f"[guide_recommender] ❌ Model file missing: {e}")
    RF_MODEL = SCALER = META = None


# ── Vibe label: computed from OCEAN since it is not stored in the DB ──────────
def compute_vibe_label(o: float, e: float, a: float, n: float) -> str:
    """
    Derives the Title-Case vibe label that matches metadata.json keys.
    Input scores are on 0–10 scale (as stored in quiz_result).
    """
    adv = (o + e) / 2
    if adv >= 7.5:   return "Adventurous Explorer"
    elif a >= 7.5:   return "Friendly Cultural"
    elif n <= 3.0:   return "Calm and Relaxed"
    elif adv >= 6.0: return "Balanced Traveller"
    else:            return "Organized Sightseer"


# ── Vibe compatibility matrix ─────────────────────────────────────────────────
VIBE_COMPAT = {
    'Calm and Relaxed': {
        'Calm and Relaxed'    : 0.7,
        'Adventurous Explorer': 0.2,
        'Balanced Traveller'  : 0.7,
        'Organized Sightseer' : 0.5,
        'Friendly Cultural'   : 0.7,
    },
    'Adventurous Explorer': {
        'Calm and Relaxed'    : 0.5,
        'Adventurous Explorer': 0.7,
        'Balanced Traveller'  : 1.0,
        'Organized Sightseer' : 0.5,
        'Friendly Cultural'   : 0.5,
    },
    'Balanced Traveller': {
        'Calm and Relaxed'    : 0.7,
        'Adventurous Explorer': 0.7,
        'Balanced Traveller'  : 1.0,
        'Organized Sightseer' : 0.7,
        'Friendly Cultural'   : 0.7,
    },
    'Organized Sightseer': {
        'Calm and Relaxed'    : 0.2,
        'Adventurous Explorer': 0.5,
        'Balanced Traveller'  : 0.7,
        'Organized Sightseer' : 1.0,
        'Friendly Cultural'   : 0.5,
    },
    'Friendly Cultural': {
        'Calm and Relaxed'    : 0.7,
        'Adventurous Explorer': 0.5,
        'Balanced Traveller'  : 0.7,
        'Organized Sightseer' : 0.5,
        'Friendly Cultural'   : 1.0,
    },
}


def _get_vibe_compat(tourist_vibe: str, guide_vibe: str) -> float:
    return VIBE_COMPAT.get(tourist_vibe, {}).get(guide_vibe, 0.5)


# ── Map your personality_type strings → Title Case vibe labels ────────────────
# guide_routes passes personality_type from quiz_result e.g. "calm & relaxed"
# metadata.json and VIBE_COMPAT use Title Case e.g. "Calm and Relaxed"
_PTYPE_TO_VIBE = {
    "calm & relaxed"      : "Calm and Relaxed",
    "calm and relaxed"    : "Calm and Relaxed",
    "adventurous explorer": "Adventurous Explorer",
    "balanced traveler"   : "Balanced Traveller",
    "balanced traveller"  : "Balanced Traveller",
    "organized sightseer" : "Organized Sightseer",
    "friendly cultural"   : "Friendly Cultural",
}

def _normalise_user_vibe(personality_type: str) -> str:
    """Convert quiz personality_type string to the Title Case used in metadata."""
    return _PTYPE_TO_VIBE.get(
        (personality_type or "").strip().lower(),
        "Balanced Traveller"   # safe default
    )


# ── Main ranking function ─────────────────────────────────────────────────────
def get_top_guides(
        guides: list,
        user_ocean: dict,
        duration: int = 3,
        top_n: int = 3,
        # guide_routes does NOT pass user_vibe — we derive it from user_ocean
        user_vibe: str = None,
) -> list:
    """
    Rank guides using:
      A) Cosine similarity on OCEAN scores          (weight 0.50)
      B) RF model quality tier probability          (weight 0.30)
      C) Vibe compatibility matrix                  (weight 0.20)

    Parameters
    ----------
    guides     : list of dicts from _row_to_guide_dict() in guide_routes.py
                 Keys: openness_score, conscientiousness_score, extraversion_score,
                       agreeableness_score, neuroticism_score, daily_rate,
                       certified, award_or_recognition, years_of_experience,
                       specialization, guide_id, name, base_location, etc.

    user_ocean : dict with keys "openness", "conscientiousness", "extraversion",
                 "agreeableness", "neuroticism"  (0–10 scale)

    duration   : trip duration in days (used to calculate estimated_budget)
    top_n      : how many top guides to return
    user_vibe  : optional override; if None, derived from user_ocean
    """

    if not guides or RF_MODEL is None:
        return []

    try:
        duration = int(duration)
    except (ValueError, TypeError):
        duration = 3

    # ── Extract user OCEAN as a vector (0–10 scale) ───────────────────────────
    o_u = float(user_ocean.get("openness",          0))
    c_u = float(user_ocean.get("conscientiousness",  0))
    e_u = float(user_ocean.get("extraversion",       0))
    a_u = float(user_ocean.get("agreeableness",      0))
    n_u = float(user_ocean.get("neuroticism",        0))
    u_vec = np.array([[o_u, c_u, e_u, a_u, n_u]])

    # ── Derive user vibe label ────────────────────────────────────────────────
    if user_vibe:
        resolved_user_vibe = _normalise_user_vibe(user_vibe)
    else:
        resolved_user_vibe = compute_vibe_label(o=o_u, e=e_u, a=a_u, n=n_u)

    results = []

    for g in guides:
        o = float(g.get("openness_score")          or 0)
        c = float(g.get("conscientiousness_score")  or 0)
        e = float(g.get("extraversion_score")       or 0)
        a = float(g.get("agreeableness_score")      or 0)
        n = float(g.get("neuroticism_score")        or 0)

        # ── A: OCEAN cosine similarity ────────────────────────────────────────
        g_vec      = np.array([[o, c, e, a, n]])
        match_score = float(cosine_similarity(u_vec, g_vec)[0][0])

        # ── Derive guide vibe from its OCEAN scores ───────────────────────────
        guide_vibe = compute_vibe_label(o=o, e=e, a=a, n=n)

        # ── B: RF quality tier ────────────────────────────────────────────────
        feature_data = {
            'Vibe_Enc'               : META['vibe_map'].get(guide_vibe, 2),
            'Specialization_Enc'     : META['spec_map'].get(
                g.get('specialization', 'Cultural'), 1),
            'Tourist_Type_Enc'       : META['type_map'].get(
                g.get('tourist_type_preference', 'All'), 3),
            'OCEAN_Openness'         : o,
            'OCEAN_Conscientiousness': c,
            'OCEAN_Extraversion'     : e,
            'OCEAN_Agreeableness'    : a,
            'OCEAN_Neuroticism'      : n,
            'Price_Per_Day_LKR'      : float(g.get("daily_rate")          or 8000),
            'Certified'              : int(g.get("certified")             or 0),
            'Has_Vehicle'            : 0,   # not in DB — permanent default
            'Award_or_Recognition'   : int(g.get("award_or_recognition")  or 0),
            'Years_of_Experience'    : float(g.get("years_of_experience") or 2),
        }

        input_df       = pd.DataFrame([feature_data])[META['features']]
        input_scaled   = SCALER.transform(input_df)
        quality_score  = float(RF_MODEL.predict_proba(input_scaled)[0][2])
        predicted_tier = int(RF_MODEL.predict(input_scaled)[0])

        # ── C: Vibe compatibility ─────────────────────────────────────────────
        vibe_compat = _get_vibe_compat(resolved_user_vibe, guide_vibe)

        # ── Hybrid final score ────────────────────────────────────────────────
        final_score = round(
            (match_score   * 0.50) +
            (quality_score * 0.30) +
            (vibe_compat   * 0.20),
            4
        )

        daily_rate      = float(g.get("daily_rate") or 0)
        estimated_budget = round(daily_rate * duration, 2)

        results.append({
            # ── Fields used by guide_routes.py ────────────────────────────────
            "guide_id"        : g.get("guide_id"),
            "name"            : g.get("name"),
            "base_location"   : g.get("base_location"),
            "daily_rate"      : daily_rate,
            "language_spoken" : g.get("language_spoken"),
            "rating"          : float(g.get("rating") or 0),
            "status"          : g.get("status"),
            "predicted_tier"  : predicted_tier,
            "tier_label"      : ["Average", "Good", "Top"][predicted_tier],
            "ocean_similarity": round(match_score * 100, 2),
            "vibe_match"      : vibe_compat >= 0.7,
            "final_score"     : final_score,
            "estimated_budget": estimated_budget,   # LKR
            "vibe_label"      : guide_vibe,          # computed, not from DB
            "confidence"      : round(match_score * 100, 2),

            # ── Extra detail fields (used by Guides.jsx) ──────────────────────
            "openness_score"          : o,
            "conscientiousness_score" : c,
            "extraversion_score"      : e,
            "agreeableness_score"     : a,
            "neuroticism_score"       : n,
            "vibe_compat"             : round(vibe_compat, 4),
            "match_score"             : round(match_score, 4),
            "quality_score"           : round(quality_score, 4),
        })

    results.sort(key=lambda x: x["final_score"], reverse=True)
    return results[:top_n]