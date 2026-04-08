"""
location_routes.py  —  backend/
Member 3's location suggestor endpoints, integrated into the main Flask backend.

CSV path: backend/location_personality_clusters.csv   ← place file here
"""

import csv
import json
import os

from flask import Blueprint, request, jsonify
from sqlalchemy import text

from models import SessionLocal, Destination
from utils import login_required

locations_router = Blueprint("locations_router", __name__)

# ── CSV metadata ───────────────────────────────────────────────────────────────
# Read once at startup. Provides province, district, OCEAN scores.
# CSV must be in the same folder as this file (backend/).
_CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "location_personality_clusters.csv")


def _load_csv_metadata() -> dict:
    """
    Returns dict keyed by lowercase location name.
    e.g. { "sigiriya": { province, district, E, A, C, N, O } }
    """
    meta = {}
    if not os.path.exists(_CSV_PATH):
        print(f"[location_routes] WARNING: CSV not found at {_CSV_PATH}")
        print(f"[location_routes] Place location_personality_clusters.csv in backend/")
        return meta

    with open(_CSV_PATH, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            loc = row.get("Location", "").strip()
            if not loc:
                continue
            meta[loc.lower()] = {
                "province": row.get("Province", "").strip(),
                "district": row.get("District", "").strip(),
                "E": float(row.get("E") or 0),
                "A": float(row.get("A") or 0),
                "C": float(row.get("C") or 0),
                "N": float(row.get("N") or 0),
                "O": float(row.get("O") or 0),
            }
    print(f"[location_routes] Loaded metadata for {len(meta)} locations from CSV")
    return meta


LOCATION_META = _load_csv_metadata()


def _enrich(location_name: str, personality_type: str) -> dict:
    """Attach province/district/OCEAN scores from CSV metadata."""
    meta = LOCATION_META.get(location_name.strip().lower(), {})
    return {
        "location":         location_name,
        "personality_type": personality_type,
        "province":         meta.get("province") or "Sri Lanka",
        "district":         meta.get("district") or "Sri Lanka",
        "E": meta.get("E", 0),
        "A": meta.get("A", 0),
        "C": meta.get("C", 0),
        "N": meta.get("N", 0),
        "O": meta.get("O", 0),
    }


def _deduplicate_by_name(rows) -> list:
    """
    Deduplicate destination rows by location name (case-insensitive).
    Keeps first occurrence. Handles both ORM objects and tuples.
    Required because the same location may appear under multiple
    personality_type values in the DB (e.g. Kandy under both
    'adventurous explorer' and 'friendly cultural').
    """
    seen = set()
    unique = []
    for row in rows:
        # Support both ORM Destination objects and (location, personality_type) tuples
        loc = row.location if hasattr(row, "location") else row[0]
        key = loc.strip().lower()
        if key not in seen:
            seen.add(key)
            unique.append(row)
    return unique


# ── GET /locations ─────────────────────────────────────────────────────────────
@locations_router.get("/locations")
def all_locations():
    """Public — list every destination. No auth required."""
    db = SessionLocal()
    try:
        rows = db.query(Destination).order_by(
            Destination.personality_type, Destination.location
        ).all()
        unique = _deduplicate_by_name(rows)
        return jsonify({
            "count":        len(unique),
            "destinations": [_enrich(d.location, d.personality_type) for d in unique],
        }), 200
    finally:
        db.close()


# ── GET /locations/me ─────────────────────────────────────────────────────────
@locations_router.get("/locations/me")
@login_required
def locations_for_me(current_user, db):
    """
    Returns destinations matched to the logged-in user's personality type.
    This is the primary endpoint called by Locations.jsx.
    personality_type comes from users.cluster_label (set when quiz is completed).
    """
    ptype = (current_user.cluster_label or "").strip().lower()
    if not ptype:
        return jsonify({"detail": "Complete the personality quiz first"}), 400

    # ilike = case-insensitive LIKE — handles both 'adventurous explorer'
    # and 'Adventurous Explorer' that may exist in DB after member 3's seeder ran
    rows = db.query(Destination).filter(
        Destination.personality_type.ilike(ptype)
    ).order_by(Destination.location).all()

    # Deduplicate by name in Python (handles rows from multiple seeding sources)
    unique = _deduplicate_by_name(rows)

    return jsonify({
        "personality_type": ptype,
        "count":            len(unique),
        "locations":        [_enrich(d.location, d.personality_type) for d in unique],
    }), 200


# ── GET /locations/<personality_type> ─────────────────────────────────────────
@locations_router.get("/locations/<string:personality_type>")
@login_required
def locations_by_type(current_user, db, personality_type):
    """Returns destinations for an explicit personality_type in the URL."""
    ptype_lower = personality_type.strip().lower()

    rows = db.query(Destination).filter(
        Destination.personality_type.ilike(ptype_lower)
    ).order_by(Destination.location).all()

    unique = _deduplicate_by_name(rows)

    if not unique:
        return jsonify({
            "personality_type": ptype_lower,
            "locations":        [],
            "message":          f"No destinations found for '{ptype_lower}'"
        }), 200

    return jsonify({
        "personality_type": ptype_lower,
        "count":            len(unique),
        "locations":        [_enrich(d.location, d.personality_type) for d in unique],
    }), 200


# ── POST /locations/save-selection ───────────────────────────────────────────
@locations_router.post("/locations/save-selection")
@login_required
def save_location_selection(current_user, db):
    """
    Save the user's chosen destinations.
    Body: { "selected_destinations": ["Sigiriya", "Ella", ...] }

    personality_type is taken from JWT (current_user.cluster_label) — cannot be spoofed.
    Stores as pipe-separated string. One row per user — upserts if row exists.
    """
    data         = request.get_json(silent=True) or {}
    destinations = data.get("selected_destinations", [])

    if not isinstance(destinations, list) or not destinations:
        return jsonify({"detail": "selected_destinations must be a non-empty list"}), 422

    # Accept both plain strings and {location: "..."} objects
    names = []
    for item in destinations:
        name = item.get("location") if isinstance(item, dict) else str(item)
        if name and name.strip():
            names.append(name.strip())

    names = list(dict.fromkeys(names))  # deduplicate preserving order
    if not names:
        return jsonify({"detail": "No valid destination names provided"}), 422

    blob = "|".join(names)
    if len(blob) > 500:
        return jsonify({"detail": "Too many destinations selected. Please select fewer."}), 422

    ptype = (current_user.cluster_label or "unknown").strip().lower()

    try:
        existing = db.execute(
            text("""
                 SELECT selection_id FROM selected_locations
                 WHERE user_id = :uid AND personality_type = :ptype
                 ORDER BY created_at DESC LIMIT 1
                 """),
            {"uid": current_user.user_id, "ptype": ptype}
        ).fetchone()

        if existing:
            selection_id = existing[0]
            db.execute(
                text("""
                     UPDATE selected_locations
                     SET selected_destination = :blob,
                         created_at = CURRENT_TIMESTAMP
                     WHERE selection_id = :sid
                     """),
                {"blob": blob, "sid": selection_id}
            )
            # Clean up any leftover duplicate rows
            db.execute(
                text("""
                     DELETE FROM selected_locations
                     WHERE user_id = :uid AND personality_type = :ptype
                       AND selection_id <> :sid
                     """),
                {"uid": current_user.user_id, "ptype": ptype, "sid": selection_id}
            )
        else:
            row = db.execute(
                text("""
                     INSERT INTO selected_locations (user_id, personality_type, selected_destination)
                     VALUES (:uid, :ptype, :blob)
                         RETURNING selection_id
                     """),
                {"uid": current_user.user_id, "ptype": ptype, "blob": blob}
            ).fetchone()
            selection_id = row[0]

        db.commit()

    except Exception as e:
        db.rollback()
        return jsonify({"detail": f"Database error: {str(e)}"}), 500

    return jsonify({
        "message":               "Locations saved",
        "selection_id":          selection_id,
        "personality_type":      ptype,
        "selected_destinations": names,
    }), 200


# ── GET /locations/selection ──────────────────────────────────────────────────
@locations_router.get("/locations/selection")
@login_required
def get_location_selection(current_user, db):
    """Returns the current user's saved location selection."""
    row = db.execute(
        text("""
             SELECT personality_type, selected_destination, created_at
             FROM selected_locations
             WHERE user_id = :uid
             ORDER BY created_at DESC LIMIT 1
             """),
        {"uid": current_user.user_id}
    ).fetchone()

    if not row:
        return jsonify({"selected_destinations": [], "personality_type": None}), 200

    ptype, blob, created_at = row
    try:
        parsed = json.loads(blob)
        names  = parsed if isinstance(parsed, list) else [str(parsed)]
    except Exception:
        names = [d.strip() for d in (blob or "").split("|") if d.strip()]

    return jsonify({
        "personality_type":      ptype,
        "selected_destinations": names,
        "saved_at":              created_at.isoformat() if created_at else None,
    }), 200