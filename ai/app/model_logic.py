"""
model_logic.py  –  ai/app/
Provides get_personality_prediction() called by the /recommend endpoint.

Input:  5 OCEAN averages on a 1–5 scale
        [E_score, N_score, A_score, C_score, O_score]

Output: lowercase personality_type string matching mapping.py keys

Two modes:
  1. knn_model.pkl exists → use trained KNN (production)
  2. No model file        → rule-based fallback (works without training)
"""

import os
import joblib
import numpy as np

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "artifacts", "knn_model.pkl")
_model = None


def _load_model():
    global _model
    if _model is None and os.path.exists(_MODEL_PATH):
        try:
            _model = joblib.load(_MODEL_PATH)
            print(f"[model_logic] KNN model loaded from {_MODEL_PATH}")
        except Exception as e:
            print(f"[model_logic] Could not load model: {e}")
    return _model


def _assign_type_rules(E, N, A, C, O) -> str:
    """Rule-based fallback — identical logic to model_train.py assign_type()."""
    calm = 6 - N
    trait_scores = {
        "adventurous explorer": (E + O) / 2,
        "friendly cultural":     A,
        "organized sightseer":   C,
        "calm & relaxed":        calm,
    }
    best = max(trait_scores, key=trait_scores.get)
    return "balanced traveler" if trait_scores[best] < 3.2 else best


def get_personality_prediction(ocean_scores: list) -> str:
    """
    ocean_scores = [E_score, N_score, A_score, C_score, O_score]
    Each value is a 1–5 float (OCEAN average, already reverse-scored).
    Returns lowercase personality_type matching mapping.py keys.
    """
    if len(ocean_scores) != 5:
        return "balanced traveler"

    E, N, A, C, O = [float(s) for s in ocean_scores]

    model = _load_model()
    if model is not None:
        # Features must match training: ['E_score', 'N_score', 'A_score', 'C_score', 'O_score']
        X = np.array([[E, N, A, C, O]])
        return str(model.predict(X)[0]).strip().lower()
    else:
        return _assign_type_rules(E, N, A, C, O)