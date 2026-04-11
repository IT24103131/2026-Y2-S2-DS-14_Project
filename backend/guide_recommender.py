"""
guide_recommender.py  —  backend/
Ranks guides using the trained Random Forest model (25 features).

Now that the guide table has all 25 feature columns, this file reads
REAL values from the DB instead of using hardcoded defaults.

Place rf_model.pkl, scaler.pkl, encoder_maps.json in backend/ alongside this file.
"""

import json
import pickle
import re
import numpy as np
import pandas as pd
from pathlib import Path

# ── Load model artefacts from backend/ ───────────────────────────────────────
_DIR = Path(__file__).resolve().parent   # = backend/

with open(_DIR / "rf_model.pkl", "rb") as f:
    RF_MODEL = pickle.load(f)

with open(_DIR / "scaler.pkl", "rb") as f:
    SCALER = pickle.load(f)

with open(_DIR / "encoder_maps.json", "r") as f:
    ENC = json.load(f)

VIBE_MATCH_BONUS = 25

# ── Vibe label normalisation ──────────────────────────────────────────────────
# encoder_maps.json uses Title Case ("Balanced Traveller" / "Calm and Relaxed")
# Your system uses lowercase with & ("balanced traveler" / "calm & relaxed")
# We normalise both directions so comparisons work correctly.

# encoder key → your system lowercase
_VIBE_NORMALISE = {
    "Calm and Relaxed":     "calm & relaxed",
    "Adventurous Explorer": "adventurous explorer",
    "Balanced Traveller":   "balanced traveler",
    "Organized Sightseer":  "organized sightseer",
    "Friendly Cultural":    "friendly cultural",
}
# your system lowercase → encoder key (for encoding lookup)
_VIBE_TO_ENC = {v: k for k, v in _VIBE_NORMALISE.items()}

# specialization + tourist_type_preference defaults (for any NULL in DB)
_DEFAULT_SPEC = "Cultural"
_DEFAULT_PREF = "All"


def _compute_vibe_label(o: float, e: float, a: float, n: float) -> str:
    """
    Derives vibe label from OCEAN scores (0-10 scale).
    Returns lowercase to match users.cluster_label.
    """
    adv = (o + e) / 2
    if adv >= 7.5:  return "adventurous explorer"
    if a >= 7.5:    return "friendly cultural"
    if n <= 3.0:    return "calm & relaxed"
    if adv >= 6.0:  return "balanced traveler"
    return "organized sightseer"


def _user_vibe_label(user_ocean: dict) -> str:
    return _compute_vibe_label(
        o=float(user_ocean.get("openness", 5)),
        e=float(user_ocean.get("extraversion", 5)),
        a=float(user_ocean.get("agreeableness", 5)),
        n=float(user_ocean.get("neuroticism", 5)),
    )


def _guide_vibe_label(guide: dict) -> str:
    return _compute_vibe_label(
        o=float(guide.get("openness_score") or 5),
        e=float(guide.get("extraversion_score") or 5),
        a=float(guide.get("agreeableness_score") or 5),
        n=float(guide.get("neuroticism_score") or 5),
    )


def _build_feature_row(guide: dict) -> dict:
    """
    Builds the 25-feature row the RF model expects.
    ALL features now read from REAL guide DB columns.
    Falls back to sensible defaults only if a column is NULL.
    """
    # ── Core columns (always present) ────────────────────────────────────────
    rating  = float(guide.get("rating") or 3.5)
    daily   = float(guide.get("daily_rate") or 8000)
    o       = float(guide.get("openness_score") or 5)
    c       = float(guide.get("conscientiousness_score") or 5)
    e       = float(guide.get("extraversion_score") or 5)
    a       = float(guide.get("agreeableness_score") or 5)
    n       = float(guide.get("neuroticism_score") or 5)

    # ── New columns — read from DB, fall back to defaults only if NULL ───────
    exp     = float(guide.get("years_of_experience") or 5)
    repeat  = float(guide.get("repeat_client_rate") or 60.0)
    avg_dur = float(guide.get("avg_tour_duration") or 3.0)
    loc_cov = float(guide.get("locations_covered") or 3)
    n_lang  = float(guide.get("number_of_languages") or 1)
    cert    = float(guide.get("certified") or 0)
    award   = float(guide.get("award_or_recognition") or 0)
    vehicle = float(guide.get("has_vehicle") or 0)  # not in schema → always 0

    # Language spoken → binary flags
    lang = str(guide.get("language_spoken") or "")
    speaks_english = 1.0 if "English" in lang else 0.0
    speaks_sinhala = 1.0 if "Sinhala" in lang else 0.0
    speaks_tamil   = 1.0 if "Tamil"   in lang else 0.0

    # Specialization encoding
    spec_raw = str(guide.get("specialization") or _DEFAULT_SPEC)
    spec_enc = float(ENC["Specialization"].get(spec_raw, ENC["Specialization"][_DEFAULT_SPEC]))

    # Tourist type preference encoding
    pref_raw = str(guide.get("tourist_type_preference") or _DEFAULT_PREF)
    pref_enc = float(ENC["Tourist_Type_Preference"].get(pref_raw, ENC["Tourist_Type_Preference"][_DEFAULT_PREF]))

    # Vibe encoding — guide's own vibe (set by _guide_vibe_label before this call)
    vibe_lower = guide.get("vibe_label", "balanced traveler")
    vibe_title = _VIBE_TO_ENC.get(vibe_lower, "Balanced Traveller")
    vibe_enc   = float(ENC["Vibe"].get(vibe_title, 2))

    # Derived features (same formulas as the training notebook)
    value_score     = round(rating / (daily / 1000), 4) if daily > 0 else 0.0
    demand_index    = round(rating * 100, 2)
    reliability     = round((repeat / 100) * (rating / 5) * 100, 2)
    ocean_adv_index = round((o + e) / 2, 2)

    return {
        "Rating_Out_of_5":          rating,
        "Price_Per_Day_LKR":        daily,
        "Vibe":                     vibe_enc,
        "OCEAN_Openness":           o,
        "OCEAN_Conscientiousness":  c,
        "OCEAN_Extraversion":       e,
        "OCEAN_Agreeableness":      a,
        "OCEAN_Neuroticism":        n,
        "Years_of_Experience":      exp,
        "Number_of_Languages":      n_lang,
        "Specialization":           spec_enc,
        "Certified":                cert,
        "Repeat_Client_Rate_%":     repeat,
        "Has_Vehicle":              vehicle,   # always 0 — not in your DB
        "Avg_Tour_Duration_Days":   avg_dur,
        "Locations_Covered":        loc_cov,
        "Award_or_Recognition":     award,
        "Tourist_Type_Preference":  pref_enc,
        "Value_Score":              value_score,
        "Demand_Index":             demand_index,
        "Reliability_Score":        reliability,
        "OCEAN_Adventure_Index":    ocean_adv_index,
        "Speaks_English":           speaks_english,
        "Speaks_Sinhala":           speaks_sinhala,
        "Speaks_Tamil":             speaks_tamil,
    }


def _scale_and_assemble(rows: list) -> pd.DataFrame:
    df_full = pd.DataFrame(rows, columns=RF_MODEL.feature_names_in_)
    scaler_cols = list(SCALER.feature_names_in_)
    df_full[scaler_cols] = SCALER.transform(df_full[scaler_cols])
    return df_full


def _ocean_similarity(user_ocean: dict, guide: dict) -> float:
    u_o = float(user_ocean.get("openness", 5))
    u_c = float(user_ocean.get("conscientiousness", 5))
    u_e = float(user_ocean.get("extraversion", 5))
    u_a = float(user_ocean.get("agreeableness", 5))
    u_n = float(user_ocean.get("neuroticism", 5))
    g_o = float(guide.get("openness_score") or 5)
    g_c = float(guide.get("conscientiousness_score") or 5)
    g_e = float(guide.get("extraversion_score") or 5)
    g_a = float(guide.get("agreeableness_score") or 5)
    g_n = float(guide.get("neuroticism_score") or 5)
    # Invert neuroticism: calm user matches calm guide
    u_n_inv, g_n_inv = 10 - u_n, 10 - g_n
    dist = np.sqrt(
        (u_o - g_o)**2 + (u_c - g_c)**2 + (u_e - g_e)**2 +
        (u_a - g_a)**2 + (u_n_inv - g_n_inv)**2
    )
    return max(0.0, round((1 - dist / np.sqrt(5 * 100)) * 100, 2))


def get_top_guides(guides: list, user_ocean: dict, duration=3, top_n: int = 3) -> list:
    """
    Ranks guides: RF tier * 40 + OCEAN similarity * 0.6 + vibe bonus (25)
    """
    if not guides:
        return []
    try:
        duration = int(duration)
    except (ValueError, TypeError):
        nums = re.findall(r"\d+", str(duration))
        duration = int(nums[0]) if nums else 3

    user_vibe = _user_vibe_label(user_ocean)

    for g in guides:
        g["vibe_label"] = _guide_vibe_label(g)

    rows  = [_build_feature_row(g) for g in guides]
    X_df  = _scale_and_assemble(rows)
    tiers = RF_MODEL.predict(X_df)

    results = []
    for i, guide in enumerate(guides):
        ocean_sim   = _ocean_similarity(user_ocean, guide)
        tier        = int(tiers[i])
        vibe_bonus  = VIBE_MATCH_BONUS if guide["vibe_label"] == user_vibe else 0
        final_score = round(tier * 40 + ocean_sim * 0.6 + vibe_bonus, 2)

        results.append({
            "guide_id":                guide["guide_id"],
            "name":                    guide["name"],
            "base_location":           guide.get("base_location", ""),
            "daily_rate":              float(guide.get("daily_rate", 0)),
            "language_spoken":         guide.get("language_spoken", ""),
            "rating":                  float(guide.get("rating", 0)),
            "status":                  guide.get("status", "available"),
            "predicted_tier":          tier,
            "tier_label":              ["Average", "Good", "Top"][tier],
            "ocean_similarity":        ocean_sim,
            "vibe_match":              vibe_bonus > 0,
            "final_score":             final_score,
            "estimated_budget":        round(float(guide.get("daily_rate", 0)) * duration, 2),
            "vibe_label":              guide["vibe_label"],
            "user_vibe":               user_vibe,
            "openness_score":          float(guide.get("openness_score") or 0),
            "conscientiousness_score": float(guide.get("conscientiousness_score") or 0),
            "extraversion_score":      float(guide.get("extraversion_score") or 0),
            "agreeableness_score":     float(guide.get("agreeableness_score") or 0),
            "neuroticism_score":       float(guide.get("neuroticism_score") or 0),
            "confidence":              ocean_sim,
        })

    results.sort(key=lambda x: x["final_score"], reverse=True)
    return results[:top_n]