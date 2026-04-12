"""
itinerary_routes.py  —  backend/
Member 5's route optimizer as a Flask Blueprint.

KEY FIXES from previous version:
  1. NO MORE location picking step — reads user's already-saved locations
     from selected_locations table (member 2's data), NOT from a second picker.
  2. Matches location names to locations_data.py entries by name to get lat/lng.
     Falls back to a built-in coordinates dict for names not in locations_data.py.
  3. itinerary_type is now mapped from user's personality_type → RL arm name
     (e.g. "adventurous explorer" → "adventure") so rl_feedback_log is correct.
  4. GET /itineraries/planner-data returns the user's saved locations already
     enriched with coordinates — frontend just calls this and goes straight to
     trip settings, no second location selection.

Routes:
  GET  /itineraries/planner-data  → user's saved locations with lat/lng + trip metadata
  POST /itineraries/optimize      → run optimizer on saved locations, save to DB
"""

import json
from flask import Blueprint, request, jsonify
from sqlalchemy import text

from models import SessionLocal
from utils import login_required
from route_optimizer import optimize_route, haversine_distance
from locations_data import SRI_LANKA_LOCATIONS, HOTELS, HOTEL_AREAS, GUIDES

itinerary_router = Blueprint("itinerary_router", __name__)

# ── Personality → RL itinerary_type mapping (same as routes.py) ──────────────
PERSONALITY_TO_ITINERARY_TYPE = {
    "adventurous explorer": "adventure",
    "balanced traveler":    "peaceful",
    "friendly cultural":    "cultural",
    "organized sightseer":  "cultural",
    "calm & relaxed":       "beach",
}

# ── Fallback coordinates for locations NOT in locations_data.py ───────────────
# These are destinations from mapping.py that member 5 doesn't have in his file.
FALLBACK_COORDS = {
    "ahungalla":              {"lat": 6.3167, "lng": 80.0167},
    "ambalangoda":            {"lat": 6.2333, "lng": 80.0500},
    "balapitiya":             {"lat": 6.2667, "lng": 80.0333},
    "bentota":                {"lat": 6.4200, "lng": 80.0000},
    "beruwala":               {"lat": 6.4667, "lng": 79.9833},
    "habarana":               {"lat": 8.0000, "lng": 80.7500},
    "hikkaduwa":              {"lat": 6.1390, "lng": 80.1000},
    "induruwa":               {"lat": 6.3700, "lng": 80.0200},
    "kalutara":               {"lat": 6.5854, "lng": 79.9607},
    "kataragama":             {"lat": 6.4100, "lng": 81.3400},
    "kosgoda":                {"lat": 6.3500, "lng": 80.0000},
    "kumana national park":   {"lat": 6.5833, "lng": 81.6833},
    "mihintale":              {"lat": 8.3500, "lng": 80.5100},
    "moragalla":              {"lat": 6.4833, "lng": 79.9833},
    "nilaveli":               {"lat": 8.7000, "lng": 81.2000},
    "peradeniya":             {"lat": 7.2667, "lng": 80.5967},
    "pidurangala":            {"lat": 7.9700, "lng": 80.7600},
    "pottuvil":               {"lat": 6.8762, "lng": 81.8369},
    "ratnapura":              {"lat": 6.6828, "lng": 80.3992},
    "ritigala":               {"lat": 8.1333, "lng": 80.6833},
    "tangalle":               {"lat": 6.0254, "lng": 80.7983},
    "tissamaharama":          {"lat": 6.2831, "lng": 81.2870},
    "uppuveli":               {"lat": 8.6167, "lng": 81.2167},
    "weligama":               {"lat": 5.9749, "lng": 80.4289},
    "wilpattu national park": {"lat": 8.4500, "lng": 80.0167},
    "colombo":                {"lat": 6.9271, "lng": 79.8612},
    "negombo":                {"lat": 7.2008, "lng": 79.8386},
    "kandy":                  {"lat": 7.2936, "lng": 80.6413},
    "galle":                  {"lat": 6.0329, "lng": 80.2168},
    "ella":                   {"lat": 6.8667, "lng": 81.0466},
    "mirissa":                {"lat": 5.9477, "lng": 80.4566},
    "sigiriya":               {"lat": 7.9573, "lng": 80.7600},
    "dambulla":               {"lat": 7.8567, "lng": 80.6490},
    "anuradhapura":           {"lat": 8.3114, "lng": 80.4037},
    "polonnaruwa":            {"lat": 7.9403, "lng": 81.0188},
    "trincomalee":            {"lat": 8.5874, "lng": 81.2152},
    "yala national park":     {"lat": 6.3667, "lng": 81.5167},
    "minneriya national park":{"lat": 8.0333, "lng": 80.9000},
    "udawalawe":              {"lat": 6.4742, "lng": 80.8994},
    "arugam bay":             {"lat": 6.8403, "lng": 81.8338},
    "unawatuna":              {"lat": 6.0100, "lng": 80.2468},
    "nuwara eliya":           {"lat": 6.9497, "lng": 80.7891},
}

# Build a name→rich_object index from locations_data.py
_LOCS_BY_NAME = {}
for loc in SRI_LANKA_LOCATIONS:
    _LOCS_BY_NAME[loc["name"].lower()] = loc
    # also index partial matches (e.g. "kandy" matches "Kandy Temple of the Tooth")
    first_word = loc["name"].split()[0].lower()
    if first_word not in _LOCS_BY_NAME:
        _LOCS_BY_NAME[first_word] = loc


def _enrich_location(name: str) -> dict | None:
    """
    Given a destination name from selected_locations (e.g. "Kandy", "Mirissa"),
    returns a rich location dict with lat/lng suitable for the route optimizer.
    Priority:
      1. Exact name match in locations_data.py
      2. Partial/first-word match in locations_data.py
      3. Fallback coords dict
      4. None (skip this location — no coordinates known)
    """
    key = name.strip().lower()

    # Exact match
    if key in _LOCS_BY_NAME:
        return _LOCS_BY_NAME[key]

    # locations_data.py partial match
    for lkey, lobj in _LOCS_BY_NAME.items():
        if key in lkey or lkey in key:
            return lobj

    # Fallback coords
    if key in FALLBACK_COORDS:
        coords = FALLBACK_COORDS[key]
        return {
            "id":                   key.replace(" ", "_"),
            "name":                 name.strip(),
            "lat":                  coords["lat"],
            "lng":                  coords["lng"],
            "category":             "cultural",
            "region":               "unknown",
            "visit_duration_hours": 2.0,
            "entry_fee_usd":        0,
            "best_time":            "morning",
            "tags":                 [],
            "description":          f"Destination: {name.strip()}",
            "difficulty":           "easy",
        }

    # Try first word of the destination name against fallback dict
    first = key.split()[0]
    if first in FALLBACK_COORDS:
        coords = FALLBACK_COORDS[first]
        return {
            "id":                   key.replace(" ", "_"),
            "name":                 name.strip(),
            "lat":                  coords["lat"],
            "lng":                  coords["lng"],
            "category":             "cultural",
            "region":               "unknown",
            "visit_duration_hours": 2.0,
            "entry_fee_usd":        0,
            "best_time":            "morning",
            "tags":                 [],
            "description":          f"Destination: {name.strip()}",
            "difficulty":           "easy",
        }

    return None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _budget_to_tier(budget_usd: float, n_days: int) -> str:
    per_day = budget_usd / max(n_days, 1)
    if per_day < 80:   return "budget"
    if per_day < 200:  return "mid"
    return "luxury"

def _food_per_day(tier: str) -> float:
    return {"budget": 15, "mid": 40, "luxury": 100}.get(tier, 40)

def _estimate_accommodation(tier: str, n_days: int) -> float:
    return {"budget": 18, "mid": 100, "luxury": 400}.get(tier, 100) * n_days

def _get_hotels_for_clusters(ordered_clusters: list, budget_tier: str) -> list:
    hotels = HOTELS.get(budget_tier, HOTELS.get("mid", []))
    if not hotels:
        return []
    suggestions = []
    for cluster in ordered_clusters:
        centroid_lat = cluster["centroid"]["lat"]
        centroid_lng = cluster["centroid"]["lng"]
        nearest_area, min_dist = None, float("inf")
        for area_id, area_coords in HOTEL_AREAS.items():
            dist = haversine_distance(centroid_lat, centroid_lng, area_coords["lat"], area_coords["lng"])
            if dist < min_dist:
                min_dist, nearest_area = dist, area_id
        matched = next((h for h in hotels if h.get("area") == nearest_area), hotels[0])
        suggestions.append({
            "day_number":           cluster["day_number"],
            "nearest_area":         nearest_area,
            "distance_to_hotel_km": round(min_dist, 1),
            "hotel":                matched,
        })
    return suggestions

def _get_relevant_guides(selected_locations: list) -> list:
    visited_regions = set(l.get("region", "") for l in selected_locations)
    relevant = [g for g in GUIDES if any(s in visited_regions for s in g.get("specialization", []))]
    return relevant or GUIDES[:2]


# ── GET /itineraries/planner-data ─────────────────────────────────────────────
@itinerary_router.get("/itineraries/planner-data")
@login_required
def get_planner_data(current_user, db):
    """
    Returns the user's already-saved locations (from member 2's selection)
    enriched with lat/lng + rich metadata, ready for the optimizer.

    Also returns quiz duration so the frontend can pre-fill n_days.
    Frontend calls this once, then immediately shows trip settings.
    No second location picking needed.
    """
    # Read saved locations
    loc_rows = db.execute(text("""
                               SELECT selected_destination FROM selected_locations
                               WHERE user_id = :uid
                               ORDER BY created_at DESC
                               """), {"uid": current_user.user_id}).fetchall()

    names = []
    for row in loc_rows:
        if row[0]:
            names.extend([p.strip() for p in row[0].split("|") if p.strip()])

    # Deduplicate while preserving order
    seen = set()
    unique_names = []
    for n in names:
        if n.lower() not in seen:
            seen.add(n.lower())
            unique_names.append(n)

    # Enrich with coordinates
    enriched = []
    missing  = []
    for name in unique_names:
        obj = _enrich_location(name)
        if obj:
            enriched.append(obj)
        else:
            missing.append(name)

    # Read quiz duration for default n_days
    qr = db.execute(text("""
                         SELECT duration, personality_type FROM quiz_result
                         WHERE user_id = :uid ORDER BY result_id DESC LIMIT 1
                         """), {"uid": current_user.user_id}).fetchone()

    import re
    def parse_duration(raw):
        if raw is None: return 5
        try: return int(raw)
        except (ValueError, TypeError):
            nums = re.findall(r"\d+", str(raw))
            return int(nums[0]) if nums else 5

    default_days     = parse_duration(qr[0] if qr else None)
    personality_type = (qr[1] or "balanced traveler").strip().lower() if qr else "balanced traveler"

    return jsonify({
        "locations":        enriched,
        "location_count":   len(enriched),
        "missing_coords":   missing,          # names we couldn't map (for debug)
        "default_days":     default_days,
        "personality_type": personality_type,
    }), 200


# ── POST /itineraries/optimize ────────────────────────────────────────────────
@itinerary_router.post("/itineraries/optimize")
@login_required
def optimize_itinerary(current_user, db):
    """
    Runs K-Means + TSP route optimization on the user's saved locations.
    Saves result to itineraries table with the CORRECT itinerary_type for RL.

    Body: { n_days, budget_usd, starting_point }
    Locations are read from DB — NOT from the request body.
    """
    data = request.get_json(silent=True) or {}

    n_days         = int(data.get("n_days", 5))
    budget_usd     = float(data.get("budget_usd", 500))
    starting_point = str(data.get("starting_point", "colombo")).lower()

    if n_days < 1:
        return jsonify({"error": "n_days must be at least 1"}), 400

    # ── Read + enrich user's saved locations ─────────────────────────────────
    loc_rows = db.execute(text("""
                               SELECT selected_destination FROM selected_locations WHERE user_id = :uid
                               """), {"uid": current_user.user_id}).fetchall()

    names = []
    for row in loc_rows:
        if row[0]:
            names.extend([p.strip() for p in row[0].split("|") if p.strip()])

    # Deduplicate
    seen, unique_names = set(), []
    for n in names:
        if n.lower() not in seen:
            seen.add(n.lower())
            unique_names.append(n)

    selected = [_enrich_location(n) for n in unique_names]
    selected = [s for s in selected if s]   # drop None (no coords found)

    if len(selected) < 2:
        return jsonify({
            "error": "Not enough locations with known coordinates. Please save at least 2 locations first.",
            "tip":   "Go to the Locations page and save your destinations."
        }), 400

    # ── Run optimizer ────────────────────────────────────────────────────────
    result = optimize_route(selected, n_days=n_days, budget_usd=budget_usd,
                            starting_point=starting_point)
    if not result.get("success"):
        return jsonify(result), 400

    # ── Budget breakdown ─────────────────────────────────────────────────────
    budget_tier       = _budget_to_tier(budget_usd, n_days)
    accommodation_usd = _estimate_accommodation(budget_tier, n_days)
    total_entry_fees  = result["route_summary"]["total_entry_fees_usd"]
    food_estimate     = n_days * _food_per_day(budget_tier)
    transport_est     = round(result["total_distance_km"] * 0.15, 2)
    total_estimate    = accommodation_usd + total_entry_fees + food_estimate + transport_est

    result["budget_breakdown"] = {
        "tier":                   budget_tier,
        "accommodation_usd":      accommodation_usd,
        "entry_fees_usd":         total_entry_fees,
        "food_estimate_usd":      food_estimate,
        "transport_estimate_usd": transport_est,
        "total_estimate_usd":     round(total_estimate, 2),
        "budget_provided_usd":    budget_usd,
        "within_budget":          total_estimate <= budget_usd,
    }
    result["hotel_suggestions"] = _get_hotels_for_clusters(result["ordered_clusters"], budget_tier)
    result["guides"]            = _get_relevant_guides(selected)

    # ── Get personality_type → correct itinerary_type for RL ─────────────────
    qr = db.execute(text("""
                         SELECT result_id, personality_type FROM quiz_result
                         WHERE user_id = :uid ORDER BY result_id DESC LIMIT 1
                         """), {"uid": current_user.user_id}).fetchone()

    result_id        = qr[0] if qr else None
    personality_type = (qr[1] or "balanced traveler").strip().lower() if qr else "balanced traveler"
    # Map to RL arm — NEVER use "optimized" as itinerary_type
    itinerary_type   = PERSONALITY_TO_ITINERARY_TYPE.get(personality_type, "peaceful")

    title = f"{n_days}-Day Sri Lanka Trip ({len(selected)} stops)"

    # ── Save to itineraries ───────────────────────────────────────────────────
    saved_id = None
    try:
        db.execute(text("""
                        INSERT INTO itineraries
                        (user_id, result_id, title, itinerary_plan, itinerary_type, created_at, updated_at)
                        VALUES
                            (:uid, :rid, :title, :plan, :itype, NOW(), NOW())
                        """), {
                       "uid":   current_user.user_id,
                       "rid":   result_id,
                       "title": title,
                       "plan":  json.dumps(result),
                       "itype": itinerary_type,        # ← correct RL arm now
                   })
        db.commit()

        row = db.execute(text("""
                              SELECT id FROM itineraries WHERE user_id = :uid ORDER BY created_at DESC LIMIT 1
                              """), {"uid": current_user.user_id}).fetchone()
        saved_id = row[0] if row else None
        result["saved_itinerary_id"] = saved_id

        # ── Write daily_plan + scheduled_activity + optimized_routes ─────────
        if saved_id:
            stop_num   = 1
            time_slots = ["09:00", "11:30", "14:00", "16:30", "18:00"]
            for cluster in result.get("ordered_clusters", []):
                day_num = cluster["day_number"]
                db.execute(text("""
                                INSERT INTO daily_plan (itinerary_id, day_number) VALUES (:iid, :dn)
                                """), {"iid": saved_id, "dn": day_num})
                db.flush()

                day_row = db.execute(text("""
                                          SELECT day_id FROM daily_plan
                                          WHERE itinerary_id = :iid AND day_number = :dn
                                          ORDER BY day_id DESC LIMIT 1
                                          """), {"iid": saved_id, "dn": day_num}).fetchone()
                day_id = day_row[0] if day_row else None

                for i, loc in enumerate(cluster.get("locations", [])):
                    if day_id:
                        db.execute(text("""
                                        INSERT INTO scheduled_activity (day_id, location, start_time)
                                        VALUES (:did, :loc, :st)
                                        """), {
                                       "did": day_id,
                                       "loc": loc.get("name", ""),
                                       "st":  time_slots[i] if i < len(time_slots) else "09:00",
                                   })
                    db.execute(text("""
                                    INSERT INTO optimized_routes (itinerary_id, location, stop_order)
                                    VALUES (:iid, :loc, :so)
                                    """), {"iid": saved_id, "loc": loc.get("name", ""), "so": stop_num})
                    stop_num += 1
            db.commit()

    except Exception as e:
        db.rollback()
        print(f"[itinerary_routes] DB save error: {e}")
        result["db_save_error"] = str(e)

    result["itinerary_type"] = itinerary_type   # so frontend can show it
    return jsonify(result), 200