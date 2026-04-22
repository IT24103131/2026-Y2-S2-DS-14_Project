"""
train_hotel_model.py  —  backend/

Retrains the hotel KMeans clustering model on ALL hotel data (existing DB rows +
new hotels defined here) and updates the database.

Run once from the backend/ directory:
    python3 train_hotel_model.py

What it does:
  1. Defines ~75 new Sri Lanka hotels with rule-based OCEAN scores
  2. Loads the 108 existing hotels from the DB
  3. Trains a fresh KMeans(n_clusters=5) on the combined OCEAN feature matrix
  4. Upserts ALL new hotels into the hotel table with their predicted cluster_id
  5. Updates cluster_id for existing hotels using the new model
  6. Saves the new model as hotel_model.joblib
"""

import csv
import os
import sys
import warnings
import random
from typing import Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sqlalchemy import text

warnings.filterwarnings("ignore")

# ── Add backend dir to path so imports work ──────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models import engine

# ─────────────────────────────────────────────────────────────────────────────
# OCEAN profiles per hotel type (O, C, E, A, N) — all 0-1 scale
# ─────────────────────────────────────────────────────────────────────────────
TYPE_OCEAN = {
    "eco_lodge":         (0.85, 0.50, 0.30, 0.75, 0.55),
    "beach_resort":      (0.55, 0.40, 0.85, 0.65, 0.28),
    "cultural_heritage": (0.88, 0.55, 0.22, 0.68, 0.42),
    "wellness_spa":      (0.48, 0.65, 0.22, 0.82, 0.78),
    "safari_lodge":      (0.88, 0.72, 0.60, 0.58, 0.32),
    "budget_hostel":     (0.62, 0.28, 0.65, 0.50, 0.38),
    "city_business":     (0.38, 0.82, 0.58, 0.58, 0.45),
    "family_resort":     (0.52, 0.68, 0.68, 0.88, 0.45),
    "luxury_villa":      (0.72, 0.72, 0.48, 0.78, 0.55),
    "surf_hostel":       (0.78, 0.25, 0.82, 0.62, 0.22),
    "boutique_hotel":    (0.78, 0.58, 0.52, 0.72, 0.52),
    "hill_retreat":      (0.82, 0.52, 0.28, 0.70, 0.62),
    "guesthouse":        (0.55, 0.38, 0.42, 0.68, 0.48),
    "tented_camp":       (0.90, 0.45, 0.55, 0.60, 0.35),
    "colonial_hotel":    (0.80, 0.65, 0.35, 0.65, 0.50),
}

def ocean_score(htype: str, noise: float = 0.06) -> dict:
    """Return OCEAN scores with small random noise for variety."""
    random.seed(abs(hash(htype)) % 9999)
    base = TYPE_OCEAN.get(htype, (0.50, 0.50, 0.50, 0.50, 0.50))
    def clip(v):
        return round(min(1.0, max(0.05, v + random.uniform(-noise, noise))), 2)
    return {
        "openness_score":          clip(base[0]),
        "conscientiousness_score": clip(base[1]),
        "extraversion_score":      clip(base[2]),
        "agreeableness_score":     clip(base[3]),
        "neuroticism_score":       clip(base[4]),
    }

# ─────────────────────────────────────────────────────────────────────────────
# NEW HOTELS — curated from Booking.com Sri Lanka listings
# Fields: hotel_id (int), name, location, budget_per_night (LKR), type
# Optional metadata: source_name, source_url
# ─────────────────────────────────────────────────────────────────────────────
NEW_HOTELS = [
    # ── Colombo ──────────────────────────────────────────────────────────────
    {"hotel_id": 3001001, "name": "Cinnamon Grand Colombo",        "location": "Colombo, Western Province",            "budget_per_night": 38500, "type": "city_business"},
    {"hotel_id": 3001002, "name": "Shangri-La Colombo",            "location": "Colombo, Western Province",            "budget_per_night": 52000, "type": "luxury_villa"},
    {"hotel_id": 3001003, "name": "Hilton Colombo",                "location": "Colombo, Western Province",            "budget_per_night": 42000, "type": "city_business"},
    {"hotel_id": 3001004, "name": "The Kingsbury Colombo",         "location": "Colombo, Western Province",            "budget_per_night": 35000, "type": "city_business"},
    {"hotel_id": 3001005, "name": "Cinnamon Red Colombo",          "location": "Colombo 2, Western Province",          "budget_per_night": 18500, "type": "boutique_hotel"},
    {"hotel_id": 3001006, "name": "OZO Colombo",                   "location": "Colombo 3, Western Province",          "budget_per_night": 16000, "type": "city_business"},
    {"hotel_id": 3001007, "name": "Colombo City Hotel",            "location": "Colombo 4, Western Province",          "budget_per_night": 8500,  "type": "guesthouse"},
    {"hotel_id": 3001008, "name": "Mango House Colombo",           "location": "Colombo 5, Western Province",          "budget_per_night": 6200,  "type": "guesthouse"},
    {"hotel_id": 3001009, "name": "Tintagel Colombo",              "location": "Colombo 7, Western Province",          "budget_per_night": 45000, "type": "colonial_hotel"},
    {"hotel_id": 3001010, "name": "Casa Colombo Collection",       "location": "Colombo 6, Western Province",          "budget_per_night": 55000, "type": "boutique_hotel"},
    {"hotel_id": 3001011, "name": "Movenpick Hotel Colombo",       "location": "Colombo 3, Western Province",          "budget_per_night": 39000, "type": "city_business"},
    {"hotel_id": 3001012, "name": "The Clock Inn Colombo",         "location": "Colombo, Western Province",            "budget_per_night": 4200,  "type": "budget_hostel"},
    {"hotel_id": 3001013, "name": "Radisson Blu Colombo",          "location": "Colombo 3, Western Province",          "budget_per_night": 36000, "type": "city_business"},
    {"hotel_id": 3001014, "name": "Mount Lavinia Hotel",           "location": "Mount Lavinia, Western Province",      "budget_per_night": 28000, "type": "colonial_hotel"},
    {"hotel_id": 3001015, "name": "Jetwing Blue Colombo",          "location": "Negombo, Western Province",            "budget_per_night": 22000, "type": "beach_resort"},

    # ── Galle & Unawatuna ────────────────────────────────────────────────────
    {"hotel_id": 3002001, "name": "Fort Bazaar Galle",             "location": "Galle Fort, Southern Province",        "budget_per_night": 48000, "type": "colonial_hotel"},
    {"hotel_id": 3002002, "name": "Amangalla Galle",               "location": "Galle Fort, Southern Province",        "budget_per_night": 165000,"type": "luxury_villa"},
    {"hotel_id": 3002003, "name": "The Fort Printers",             "location": "Galle Fort, Southern Province",        "budget_per_night": 52000, "type": "boutique_hotel"},
    {"hotel_id": 3002004, "name": "Galle Face Hotel Galle",        "location": "Galle, Southern Province",             "budget_per_night": 25000, "type": "colonial_hotel"},
    {"hotel_id": 3002005, "name": "Unawatuna Beach Resort",        "location": "Unawatuna, Galle District, Southern Province", "budget_per_night": 14500, "type": "beach_resort"},
    {"hotel_id": 3002006, "name": "Cantaloupe Levels Galle",       "location": "Galle, Southern Province",             "budget_per_night": 42000, "type": "boutique_hotel"},
    {"hotel_id": 3002007, "name": "Sun House Galle",               "location": "Galle, Southern Province",             "budget_per_night": 38000, "type": "colonial_hotel"},
    {"hotel_id": 3002008, "name": "Thaproban Beach House",         "location": "Unawatuna, Galle District, Southern Province", "budget_per_night": 9500,  "type": "guesthouse"},
    {"hotel_id": 3002009, "name": "Jetwing Lighthouse Galle",      "location": "Galle, Southern Province",             "budget_per_night": 35000, "type": "luxury_villa"},
    {"hotel_id": 3002010, "name": "Secret Garden Villa Galle",     "location": "Galle, Southern Province",             "budget_per_night": 62000, "type": "luxury_villa"},

    # ── Ella ─────────────────────────────────────────────────────────────────
    {"hotel_id": 3003001, "name": "Ella Flower Garden Resort",     "location": "Ella, Badulla District, Uva Province", "budget_per_night": 12500, "type": "hill_retreat"},
    {"hotel_id": 3003002, "name": "98 Acres Resort Ella",          "location": "Ella, Badulla District, Uva Province", "budget_per_night": 45000, "type": "luxury_villa"},
    {"hotel_id": 3003003, "name": "Zion View Ella",                "location": "Ella, Badulla District, Uva Province", "budget_per_night": 8500,  "type": "guesthouse"},
    {"hotel_id": 3003004, "name": "Ella Gap Eco Lodge",            "location": "Ella, Badulla District, Uva Province", "budget_per_night": 18000, "type": "eco_lodge"},
    {"hotel_id": 3003005, "name": "Amba Estate Ella",              "location": "Ella, Badulla District, Uva Province", "budget_per_night": 35000, "type": "eco_lodge"},
    {"hotel_id": 3003006, "name": "Ella Rock Inn",                 "location": "Ella, Badulla District, Uva Province", "budget_per_night": 6800,  "type": "budget_hostel"},
    {"hotel_id": 3003007, "name": "Ravana Heights Ella",           "location": "Ella, Badulla District, Uva Province", "budget_per_night": 22000, "type": "hill_retreat"},
    {"hotel_id": 3003008, "name": "Cloud 9 Ella",                  "location": "Ella, Badulla District, Uva Province", "budget_per_night": 28000, "type": "boutique_hotel"},
    {"hotel_id": 3003009, "name": "Little Nest Ella",              "location": "Ella, Badulla District, Uva Province", "budget_per_night": 5200,  "type": "budget_hostel"},
    {"hotel_id": 3003010, "name": "Ella Jungle Resort",            "location": "Ella, Badulla District, Uva Province", "budget_per_night": 38000, "type": "eco_lodge"},

    # ── Nuwara Eliya ─────────────────────────────────────────────────────────
    {"hotel_id": 3004001, "name": "Grand Hotel Nuwara Eliya",      "location": "Nuwara Eliya, Central Province",       "budget_per_night": 28000, "type": "colonial_hotel"},
    {"hotel_id": 3004002, "name": "Hotel Glendower Nuwara Eliya",  "location": "Nuwara Eliya, Central Province",       "budget_per_night": 22000, "type": "colonial_hotel"},
    {"hotel_id": 3004003, "name": "Araliya Green Hills Hotel",     "location": "Nuwara Eliya, Central Province",       "budget_per_night": 38000, "type": "luxury_villa"},
    {"hotel_id": 3004004, "name": "Heritance Tea Factory",         "location": "Kandapola, Nuwara Eliya, Central Province", "budget_per_night": 55000, "type": "cultural_heritage"},
    {"hotel_id": 3004005, "name": "Tea Trails Bungalows",          "location": "Dikoya, Nuwara Eliya, Central Province","budget_per_night": 120000,"type": "luxury_villa"},
    {"hotel_id": 3004006, "name": "Jetwing St. Andrews Nuwara Eliya","location": "Nuwara Eliya, Central Province",     "budget_per_night": 18500, "type": "boutique_hotel"},
    {"hotel_id": 3004007, "name": "Ceylon Tea Trails",             "location": "Nuwara Eliya, Central Province",       "budget_per_night": 98000, "type": "eco_lodge"},
    {"hotel_id": 3004008, "name": "Nuwara Eliya Golf Club Hotel",  "location": "Nuwara Eliya, Central Province",       "budget_per_night": 15000, "type": "colonial_hotel"},

    # ── Bentota & Beruwala ───────────────────────────────────────────────────
    {"hotel_id": 3005001, "name": "Vivanta by Taj Bentota",        "location": "Bentota, Southern Province",           "budget_per_night": 42000, "type": "beach_resort"},
    {"hotel_id": 3005002, "name": "Cinnamon Bey Beruwala",         "location": "Beruwala, Western Province",           "budget_per_night": 38000, "type": "beach_resort"},
    {"hotel_id": 3005003, "name": "Centara Ceysands Bentota",      "location": "Bentota, Southern Province",           "budget_per_night": 32000, "type": "family_resort"},
    {"hotel_id": 3005004, "name": "Saman Villas Bentota",          "location": "Bentota, Southern Province",           "budget_per_night": 85000, "type": "luxury_villa"},
    {"hotel_id": 3005005, "name": "Club Bentota",                  "location": "Bentota, Southern Province",           "budget_per_night": 28000, "type": "beach_resort"},
    {"hotel_id": 3005006, "name": "Bentota Beach Hotel",           "location": "Bentota, Southern Province",           "budget_per_night": 18500, "type": "beach_resort"},
    {"hotel_id": 3005007, "name": "Avani Bentota Resort",          "location": "Bentota, Southern Province",           "budget_per_night": 25000, "type": "wellness_spa"},
    {"hotel_id": 3005008, "name": "Beruwala Rest House",           "location": "Beruwala, Western Province",           "budget_per_night": 5500,  "type": "guesthouse"},

    # ── Weligama & Tangalle ──────────────────────────────────────────────────
    {"hotel_id": 3006001, "name": "Cape Weligama",                 "location": "Weligama, Southern Province",          "budget_per_night": 95000, "type": "luxury_villa"},
    {"hotel_id": 3006002, "name": "Weligama Bay Marriott Resort",  "location": "Weligama, Southern Province",          "budget_per_night": 58000, "type": "beach_resort"},
    {"hotel_id": 3006003, "name": "Kahanda Kanda Weligama",        "location": "Weligama, Southern Province",          "budget_per_night": 78000, "type": "boutique_hotel"},
    {"hotel_id": 3006004, "name": "Surf Village Weligama",         "location": "Weligama, Southern Province",          "budget_per_night": 8500,  "type": "surf_hostel"},
    {"hotel_id": 3006005, "name": "Amanwella Tangalle",            "location": "Tangalle, Southern Province",          "budget_per_night": 185000,"type": "luxury_villa"},
    {"hotel_id": 3006006, "name": "Buckingham Place Tangalle",     "location": "Tangalle, Southern Province",          "budget_per_night": 48000, "type": "eco_lodge"},
    {"hotel_id": 3006007, "name": "Mangrove Beach Cabanas Tangalle","location": "Tangalle, Southern Province",         "budget_per_night": 7200,  "type": "budget_hostel"},
    {"hotel_id": 3006008, "name": "Palm Paradise Cabanas Tangalle","location": "Tangalle, Southern Province",          "budget_per_night": 9500,  "type": "guesthouse"},

    # ── Sigiriya ─────────────────────────────────────────────────────────────
    {"hotel_id": 3007001, "name": "Aliya Resort & Spa Sigiriya",   "location": "Sigiriya, Central Province",           "budget_per_night": 62000, "type": "wellness_spa"},
    {"hotel_id": 3007002, "name": "Jetwing Vil Uyana Sigiriya",    "location": "Sigiriya, Central Province",           "budget_per_night": 110000,"type": "eco_lodge"},
    {"hotel_id": 3007003, "name": "Sigiriya Village Hotel",        "location": "Sigiriya, Central Province",           "budget_per_night": 22000, "type": "cultural_heritage"},
    {"hotel_id": 3007004, "name": "Water Garden Sigiriya",         "location": "Sigiriya, Central Province",           "budget_per_night": 85000, "type": "luxury_villa"},
    {"hotel_id": 3007005, "name": "Elephant Corridor Sigiriya",    "location": "Sigiriya, Central Province",           "budget_per_night": 125000,"type": "safari_lodge"},

    # ── Jaffna ───────────────────────────────────────────────────────────────
    {"hotel_id": 3008001, "name": "Jetwing Jaffna",                "location": "Jaffna, Northern Province",            "budget_per_night": 32000, "type": "boutique_hotel"},
    {"hotel_id": 3008002, "name": "The Thinnai Jaffna",            "location": "Jaffna, Northern Province",            "budget_per_night": 18500, "type": "cultural_heritage"},
    {"hotel_id": 3008003, "name": "Green Grass Hotel Jaffna",      "location": "Jaffna, Northern Province",            "budget_per_night": 8500,  "type": "guesthouse"},
    {"hotel_id": 3008004, "name": "Pillaiyar Kovil Guesthouse",    "location": "Jaffna, Northern Province",            "budget_per_night": 4500,  "type": "guesthouse"},
    {"hotel_id": 3008005, "name": "Sarras Hotel Jaffna",           "location": "Jaffna, Northern Province",            "budget_per_night": 12000, "type": "city_business"},
    {"hotel_id": 3008006, "name": "Atchuvely Inn Jaffna",          "location": "Atchuvely, Jaffna, Northern Province", "budget_per_night": 6500,  "type": "guesthouse"},

    # ── Kandy (extra) ────────────────────────────────────────────────────────
    {"hotel_id": 3009001, "name": "Cinnamon Citadel Kandy",        "location": "Kandy, Central Province",              "budget_per_night": 38000, "type": "cultural_heritage"},
    {"hotel_id": 3009002, "name": "Theva Residency Kandy",         "location": "Kandy, Central Province",              "budget_per_night": 55000, "type": "boutique_hotel"},
    {"hotel_id": 3009003, "name": "Helga's Folly Kandy",           "location": "Kandy, Central Province",              "budget_per_night": 48000, "type": "boutique_hotel"},
    {"hotel_id": 3009004, "name": "Earl's Regency Kandy",          "location": "Kandy, Central Province",              "budget_per_night": 25000, "type": "city_business"},
    {"hotel_id": 3009005, "name": "Kandy House",                   "location": "Kandy, Central Province",              "budget_per_night": 72000, "type": "colonial_hotel"},

    # ── Mirissa (extra) ──────────────────────────────────────────────────────
    {"hotel_id": 3010001, "name": "Mirissa Water's Edge",          "location": "Mirissa, Southern Province",           "budget_per_night": 22000, "type": "boutique_hotel"},
    {"hotel_id": 3010002, "name": "Sooriya Village Mirissa",       "location": "Mirissa, Southern Province",           "budget_per_night": 8500,  "type": "guesthouse"},
    {"hotel_id": 3010003, "name": "Amodhara Hotel Mirissa",        "location": "Mirissa, Southern Province",           "budget_per_night": 15000, "type": "beach_resort"},
    {"hotel_id": 3010004, "name": "Villa Shanti Mirissa",          "location": "Mirissa, Southern Province",           "budget_per_night": 35000, "type": "luxury_villa"},

    # ── Hikkaduwa (extra) ────────────────────────────────────────────────────
    {"hotel_id": 3011001, "name": "Hikka Tranz by Cinnamon",       "location": "Hikkaduwa, Southern Province",         "budget_per_night": 35000, "type": "beach_resort"},
    {"hotel_id": 3011002, "name": "Lanka Super Corals Hotel",      "location": "Hikkaduwa, Southern Province",         "budget_per_night": 9500,  "type": "guesthouse"},
    {"hotel_id": 3011003, "name": "Coral Sands Hotel Hikkaduwa",   "location": "Hikkaduwa, Southern Province",         "budget_per_night": 28000, "type": "beach_resort"},
    {"hotel_id": 3011004, "name": "The Drifter Surf Hotel",        "location": "Hikkaduwa, Southern Province",         "budget_per_night": 7500,  "type": "surf_hostel"},

    # ── Arugam Bay (extra) ───────────────────────────────────────────────────
    {"hotel_id": 3012001, "name": "Stardust Beach Hotel Arugam Bay","location": "Arugam Bay, Ampara, Eastern Province",  "budget_per_night": 12000, "type": "surf_hostel"},
    {"hotel_id": 3012002, "name": "Siam View Hotel Arugam Bay",    "location": "Arugam Bay, Ampara, Eastern Province",  "budget_per_night": 15000, "type": "beach_resort"},
    {"hotel_id": 3012003, "name": "Gecko Bay Hotel Arugam Bay",    "location": "Arugam Bay, Ampara, Eastern Province",  "budget_per_night": 8800,  "type": "surf_hostel"},

    # ── Trincomalee (extra) ──────────────────────────────────────────────────
    {"hotel_id": 3013001, "name": "Chaaya Blu Trincomalee",        "location": "Trincomalee, Eastern Province",        "budget_per_night": 32000, "type": "beach_resort"},
    {"hotel_id": 3013002, "name": "Welcombe Hotel Trincomalee",    "location": "Trincomalee, Eastern Province",        "budget_per_night": 8500,  "type": "guesthouse"},
    {"hotel_id": 3013003, "name": "Pigeon Island Beach Resort",    "location": "Trincomalee, Eastern Province",        "budget_per_night": 22000, "type": "beach_resort"},

    # ── Yala (extra) ─────────────────────────────────────────────────────────
    {"hotel_id": 3014001, "name": "Chena Huts by Uga Escapes",     "location": "Yala, Southern Province",              "budget_per_night": 145000,"type": "tented_camp"},
    {"hotel_id": 3014002, "name": "Cinnamon Wild Yala",            "location": "Yala, Southern Province",              "budget_per_night": 65000, "type": "safari_lodge"},
    {"hotel_id": 3014003, "name": "Leopard Trails Yala",           "location": "Yala, Southern Province",              "budget_per_night": 98000, "type": "tented_camp"},
    {"hotel_id": 3014004, "name": "Kithala Resort Yala",           "location": "Yala, Southern Province",              "budget_per_night": 18500, "type": "eco_lodge"},

    # ── Negombo (extra) ─────────────────────────────────────────────────────
    {"hotel_id": 3015001, "name": "Jetwing Sea Negombo",           "location": "Negombo, Western Province",            "budget_per_night": 28000, "type": "beach_resort"},
    {"hotel_id": 3015002, "name": "Camelot Beach Hotel Negombo",   "location": "Negombo, Western Province",            "budget_per_night": 18000, "type": "beach_resort"},
    {"hotel_id": 3015003, "name": "Browns Beach Hotel Negombo",    "location": "Negombo, Western Province",            "budget_per_night": 25000, "type": "beach_resort"},
]


def build_feature_row(htype: str) -> list:
    """Return [O, C, E, A, N] for a hotel type (deterministic, no noise)."""
    base = TYPE_OCEAN.get(htype, (0.50, 0.50, 0.50, 0.50, 0.50))
    return list(base)


def _normalize_hotel(raw: dict) -> Optional[Dict]:
    """Validate and normalize a single hotel row from code/CSV."""
    try:
        hotel_id = int(raw["hotel_id"])
        name = str(raw["name"]).strip()
        location = str(raw["location"]).strip()
        budget = float(raw["budget_per_night"])
        htype = str(raw["type"]).strip().lower()
        if not name or not location or budget <= 0:
            return None
        if htype not in TYPE_OCEAN:
            return None
        return {
            "hotel_id": hotel_id,
            "name": name,
            "location": location,
            "budget_per_night": budget,
            "type": htype,
            "source_name": str(raw.get("source_name", "booking.com")).strip() or "booking.com",
            "source_url": str(raw.get("source_url", "")).strip(),
        }
    except Exception:
        return None


def load_hotels_from_csv(csv_path: str) -> List[Dict]:
    """
    Load additional hotel rows from CSV.
    Expected columns: hotel_id,name,location,budget_per_night,type,source_name,source_url
    """
    if not os.path.exists(csv_path):
        print(f"CSV seed not found at {csv_path}; continuing with built-in list only.")
        return []

    loaded: List[Dict] = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader, start=2):
            normalized = _normalize_hotel(row)
            if normalized is None:
                print(f"  Skipping invalid CSV row {idx}")
                continue
            loaded.append(normalized)
    print(f"Loaded {len(loaded)} hotels from CSV seed")
    return loaded


def merge_hotel_sources(base_hotels: List[Dict], csv_hotels: List[Dict]) -> List[Dict]:
    """
    Merge hardcoded + CSV rows and de-duplicate by hotel_id.
    CSV entries override hardcoded rows with the same hotel_id.
    """
    merged = {}
    for h in base_hotels + csv_hotels:
        normalized = _normalize_hotel(h)
        if normalized is None:
            continue
        merged[normalized["hotel_id"]] = normalized
    return list(merged.values())


def main():
    random.seed(42)
    root_dir = os.path.dirname(os.path.abspath(__file__))
    csv_seed_path = os.path.join(root_dir, "data", "hotels_booking_seed.csv")

    csv_hotels = load_hotels_from_csv(csv_seed_path)
    all_new_hotels = merge_hotel_sources(NEW_HOTELS, csv_hotels)
    if not all_new_hotels:
        raise RuntimeError("No valid hotel rows found. Add entries to NEW_HOTELS or CSV seed.")

    # ── 1. Load existing hotels from DB ─────────────────────────────────────
    print("Loading existing hotels from DB...")
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT hotel_id, openness_score, conscientiousness_score, "
            "extraversion_score, agreeableness_score, neuroticism_score FROM hotel"
        )).fetchall()

    existing = pd.DataFrame(rows, columns=["hotel_id", "O", "C", "E", "A", "N"])
    print(f"  Existing hotels: {len(existing)}")

    # ── 2. Build feature matrix for new hotels ───────────────────────────────
    new_rows = []
    for h in all_new_hotels:
        scores = ocean_score(h["type"], noise=0.05)
        new_rows.append({
            "hotel_id": h["hotel_id"],
            "O": scores["openness_score"],
            "C": scores["conscientiousness_score"],
            "E": scores["extraversion_score"],
            "A": scores["agreeableness_score"],
            "N": scores["neuroticism_score"],
        })
    new_df = pd.DataFrame(new_rows)
    print(f"  New/updated hotels to process: {len(new_df)}")

    # ── 3. Combine for KMeans training ───────────────────────────────────────
    all_df = pd.concat([existing[["O", "C", "E", "A", "N"]], new_df[["O", "C", "E", "A", "N"]]], ignore_index=True)
    print(f"  Total hotels for training: {len(all_df)}")

    X = all_df[["O", "C", "E", "A", "N"]].values

    # ── 4. Train KMeans ─────────────────────────────────────────────────────
    print("Training KMeans (n_clusters=5)...")
    km = KMeans(n_clusters=5, n_init=20, max_iter=500, random_state=42)
    km.fit(X)
    print("  Cluster centers (O, C, E, A, N):")
    for i, c in enumerate(km.cluster_centers_):
        print(f"    Cluster {i}: O={c[0]:.2f} C={c[1]:.2f} E={c[2]:.2f} A={c[3]:.2f} N={c[4]:.2f}")

    # ── 5. Predict cluster_ids ───────────────────────────────────────────────
    existing_ids = existing[["hotel_id"]].copy()
    existing_ids["cluster_id"] = km.predict(existing[["O", "C", "E", "A", "N"]].values)

    new_df["cluster_id"] = km.predict(new_df[["O", "C", "E", "A", "N"]].values)

    print("\nNew hotel cluster distribution:")
    for cid in range(5):
        n = (new_df["cluster_id"] == cid).sum()
        print(f"  Cluster {cid}: {n} hotels")

    # ── 6. Save model ────────────────────────────────────────────────────────
    model_path = os.path.join(root_dir, "hotel_model.joblib")
    joblib.dump(km, model_path)
    print(f"\nSaved model → {model_path}")

    # ── 7. Update DB ─────────────────────────────────────────────────────────
    print("\nUpdating database...")
    with engine.connect() as conn:
        # 7a. Ensure hotel table has required columns
        conn.execute(text("ALTER TABLE hotel ADD COLUMN IF NOT EXISTS cluster_id INTEGER"))
        conn.execute(text("ALTER TABLE hotel ADD COLUMN IF NOT EXISTS source_name VARCHAR(120)"))
        conn.execute(text("ALTER TABLE hotel ADD COLUMN IF NOT EXISTS source_url TEXT"))
        conn.commit()

        # 7b. Update cluster_ids for existing hotels
        updated = 0
        for _, row in existing_ids.iterrows():
            result = conn.execute(
                text("UPDATE hotel SET cluster_id = :cid WHERE hotel_id = :hid"),
                {"cid": int(row["cluster_id"]), "hid": int(row["hotel_id"])}
            )
            updated += result.rowcount
        conn.commit()
        print(f"  Updated cluster_id for {updated} existing hotels")

        # 7c. Insert new hotels (skip if hotel_id already exists)
        inserted = 0
        skipped = 0
        for h, row in zip(all_new_hotels, new_df.itertuples()):
            scores = ocean_score(h["type"], noise=0.05)
            try:
                conn.execute(
                    text("""
                        INSERT INTO hotel
                            (hotel_id, name, location, budget_per_night,
                             openness_score, conscientiousness_score,
                             extraversion_score, agreeableness_score,
                             neuroticism_score, cluster_id, source_name, source_url)
                        VALUES
                            (:hid, :name, :loc, :budget,
                             :o, :c, :e, :a, :n, :cid, :source_name, :source_url)
                        ON CONFLICT (hotel_id) DO UPDATE SET
                            name                    = EXCLUDED.name,
                            location                = EXCLUDED.location,
                            budget_per_night        = EXCLUDED.budget_per_night,
                            openness_score          = EXCLUDED.openness_score,
                            conscientiousness_score = EXCLUDED.conscientiousness_score,
                            extraversion_score      = EXCLUDED.extraversion_score,
                            agreeableness_score     = EXCLUDED.agreeableness_score,
                            neuroticism_score       = EXCLUDED.neuroticism_score,
                            cluster_id              = EXCLUDED.cluster_id,
                            source_name             = EXCLUDED.source_name,
                            source_url              = EXCLUDED.source_url
                    """),
                    {
                        "hid":    h["hotel_id"],
                        "name":   h["name"],
                        "loc":    h["location"],
                        "budget": float(h["budget_per_night"]),
                        "o":      float(scores["openness_score"]),
                        "c":      float(scores["conscientiousness_score"]),
                        "e":      float(scores["extraversion_score"]),
                        "a":      float(scores["agreeableness_score"]),
                        "n":      float(scores["neuroticism_score"]),
                        "cid":    int(row.cluster_id),
                        "source_name": h["source_name"],
                        "source_url": h["source_url"],
                    }
                )
                inserted += 1
            except Exception as ex:
                print(f"  WARN: could not insert {h['name']}: {ex}")
                skipped += 1
        conn.commit()
        print(f"  Inserted/updated {inserted} new hotels ({skipped} skipped)")

        # 7d. Verify final count
        total = conn.execute(text("SELECT COUNT(*) FROM hotel")).fetchone()[0]
        print(f"\n  Total hotels in DB: {total}")

    print("\nDone! Hotel model retrained and database updated.")


if __name__ == "__main__":
    main()
