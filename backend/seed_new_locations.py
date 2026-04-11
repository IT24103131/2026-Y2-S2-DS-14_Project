"""
seed_new_locations.py
──────────────────────
Adds new Sri Lankan tourist destinations to:
  1. The PostgreSQL `destinations` table
  2. The local CSV metadata file (location_personality_clusters.csv)

Run:  python3 seed_new_locations.py
"""

import csv
import os
from models import SessionLocal, Destination

# ── New locations to add ──────────────────────────────────────────────────────
# Format: (location, personality_type, province, district, E, A, C, N, O)

NEW_LOCATIONS = [
    # ── Calm & Relaxed  (currently 0 in DB — adding 8) ────────────────────────
    ("Weligama Beach",     "Calm & Relaxed",       "Southern Province",        "Matara",       2, 4, 2, 1, 3),
    ("Passikuda",          "Calm & Relaxed",       "Eastern Province",         "Batticaloa",   2, 4, 2, 1, 2),
    ("Bentota Beach",      "Calm & Relaxed",       "Southern Province",        "Galle",        2, 4, 3, 1, 2),
    ("Talalla",            "Calm & Relaxed",       "Southern Province",        "Matara",       2, 4, 2, 1, 2),
    ("Kalpitiya",          "Calm & Relaxed",       "North Western Province",   "Puttalam",     3, 4, 2, 1, 3),
    ("Jungle Beach",       "Calm & Relaxed",       "Southern Province",        "Galle",        2, 3, 2, 1, 2),
    ("Dickwella",          "Calm & Relaxed",       "Southern Province",        "Matara",       2, 4, 2, 2, 2),
    ("Hiriketiya",         "Calm & Relaxed",       "Southern Province",        "Matara",       3, 3, 2, 1, 3),

    # ── Friendly Cultural  (currently 2 — adding 8) ──────────────────────────
    ("Jaffna",             "Friendly Cultural",    "Northern Province",        "Jaffna",       3, 5, 3, 4, 2),
    ("Nallur Kandaswamy",  "Friendly Cultural",    "Northern Province",        "Jaffna",       2, 5, 2, 4, 1),
    ("Embekka Devalaya",   "Friendly Cultural",    "Central Province",         "Kandy",        2, 5, 2, 5, 1),
    ("Temple of the Tooth","Friendly Cultural",    "Central Province",         "Kandy",        2, 5, 3, 5, 1),
    ("Gadaladeniya Temple","Friendly Cultural",    "Central Province",         "Kandy",        2, 5, 2, 5, 1),
    ("Kelaniya Temple",    "Friendly Cultural",    "Western Province",         "Gampaha",      2, 5, 3, 4, 1),
    ("Ruwanwelisaya",      "Friendly Cultural",    "North Central Province",   "Anuradhapura", 2, 5, 2, 5, 1),
    ("Gangaramaya Temple", "Friendly Cultural",    "Western Province",         "Colombo",      3, 5, 3, 4, 2),

    # ── Organized Sightseer  (currently 1 — adding 8) ────────────────────────
    ("Colombo Fort",       "Organized Sightseer",  "Western Province",         "Colombo",      3, 4, 5, 3, 3),
    ("Galle Fort",         "Organized Sightseer",  "Southern Province",        "Galle",        3, 5, 5, 4, 2),
    ("National Museum",    "Organized Sightseer",  "Western Province",         "Colombo",      2, 5, 5, 3, 2),
    ("Pinnawala",          "Organized Sightseer",  "Sabaragamuwa Province",    "Kegalle",      3, 4, 5, 4, 2),
    ("Independence Square","Organized Sightseer",  "Western Province",         "Colombo",      3, 4, 5, 3, 3),
    ("Gangarama Museum",   "Organized Sightseer",  "Western Province",         "Colombo",      2, 5, 5, 3, 2),
    ("Matara Fort",        "Organized Sightseer",  "Southern Province",        "Matara",       3, 4, 4, 4, 2),
    ("Dutch Museum",       "Organized Sightseer",  "Western Province",         "Colombo",      2, 5, 5, 3, 2),

    # ── Balanced Traveler  (currently 9 — adding 6) ──────────────────────────
    ("Waikkal",            "Balanced Traveler",    "Western Province",         "Gampaha",      3, 3, 3, 4, 2),
    ("Chilaw",             "Balanced Traveler",    "North Western Province",   "Chilaw",       3, 3, 3, 5, 2),
    ("Matara",             "Balanced Traveler",    "Southern Province",        "Matara",       3, 4, 3, 4, 2),
    ("Hambantota",         "Balanced Traveler",    "Southern Province",        "Hambantota",   3, 3, 3, 4, 2),
    ("Batticaloa",         "Balanced Traveler",    "Eastern Province",         "Batticaloa",   3, 4, 3, 4, 2),
    ("Mannar",             "Balanced Traveler",    "Northern Province",        "Mannar",       3, 3, 2, 5, 2),

    # ── Adventurous Explorer  (currently 30 — adding 6) ──────────────────────
    ("Horton Plains",      "Adventurous Explorer", "Central Province",         "Nuwara Eliya", 5, 3, 3, 4, 3),
    ("Adams Peak",         "Adventurous Explorer", "Sabaragamuwa Province",    "Ratnapura",    5, 4, 3, 3, 3),
    ("Kitulgala",          "Adventurous Explorer", "Sabaragamuwa Province",    "Kegalle",      5, 3, 4, 3, 3),
    ("Knuckles Range",     "Adventurous Explorer", "Central Province",         "Kandy",        5, 3, 2, 3, 3),
    ("Sinharaja Forest",   "Adventurous Explorer", "Sabaragamuwa Province",    "Ratnapura",    5, 3, 2, 3, 4),
    ("Belihuloya",         "Adventurous Explorer", "Sabaragamuwa Province",    "Ratnapura",    5, 3, 3, 4, 3),
]


def seed_database():
    """Insert new locations into the destinations table (skip duplicates)."""
    db = SessionLocal()
    added = 0
    skipped = 0

    try:
        for loc_name, ptype, *_ in NEW_LOCATIONS:
            exists = db.query(Destination).filter(
                Destination.location == loc_name,
                Destination.personality_type == ptype,
            ).first()
            if exists:
                print(f"  ⏭  SKIP (already exists): {loc_name} [{ptype}]")
                skipped += 1
                continue

            db.add(Destination(location=loc_name, personality_type=ptype))
            print(f"  ✅ ADDED: {loc_name} [{ptype}]")
            added += 1

        db.commit()
        print(f"\n  Summary: {added} added, {skipped} skipped")

    except Exception as e:
        db.rollback()
        print(f"  ❌ ERROR: {e}")
        raise
    finally:
        db.close()


def update_csv():
    """Append new locations to the CSV metadata file (skip duplicates)."""
    csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "location_personality_clusters.csv")

    # Read existing locations from CSV
    existing = set()
    if os.path.exists(csv_path):
        with open(csv_path, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                existing.add(row.get("Location", "").strip().lower())

    added = 0
    with open(csv_path, "a", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        for loc_name, ptype, province, district, E, A, C, N, O in NEW_LOCATIONS:
            if loc_name.strip().lower() in existing:
                continue
            writer.writerow([loc_name, E, A, C, N, O, ptype, province, district])
            added += 1

    print(f"\n  CSV: {added} new rows appended to {csv_path}")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  Seeding new locations into DB + CSV")
    print("=" * 60 + "\n")

    print("── Step 1: Insert into PostgreSQL ──")
    seed_database()

    print("\n── Step 2: Update CSV metadata ──")
    update_csv()

    print("\n" + "=" * 60)
    print("  Done! Restart the backend to reload CSV metadata.")
    print("=" * 60 + "\n")
