"""
itinerary_routes.py  —  backend/
Member 5's route optimizer as a Flask Blueprint.

CHANGE in this version:
  GET /itineraries/planner-data also returns:
    default_budget_lkr  ← user's saved hotel total_budget (LKR)
    default_budget_usd  ← converted to USD (÷320 approx) for the optimizer
  This means ItineraryPlanner.jsx pre-fills budget_usd from the hotel the
  user already saved — no more asking for budget a second time.
"""

import json, re
from flask import Blueprint, request, jsonify
from sqlalchemy import text
from typing import Optional
from models import SessionLocal
from utils import login_required
from route_optimizer import optimize_route, haversine_distance
from locations_data import SRI_LANKA_LOCATIONS, HOTELS, HOTEL_AREAS, GUIDES
import requests as req
from config import Config
itinerary_router = Blueprint("itinerary_router", __name__)

LKR_TO_USD = 320   # approximate conversion rate — adjust if needed

PERSONALITY_TO_ITINERARY_TYPE = {
    "adventurous explorer": "adventure",
    "balanced traveler":    "peaceful",
    "friendly cultural":    "cultural",
    "organized sightseer":  "cultural",
    "calm & relaxed":       "beach",
}

# ── Fallback coordinates ──────────────────────────────────────────────────────
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

_LOCS_BY_NAME = {}
for _loc in SRI_LANKA_LOCATIONS:
    _LOCS_BY_NAME[_loc["name"].lower()] = _loc
    _fw = _loc["name"].split()[0].lower()
    if _fw not in _LOCS_BY_NAME:
        _LOCS_BY_NAME[_fw] = _loc


def _enrich_location(name: str) -> Optional[dict]:
    key = name.strip().lower()
    if key in _LOCS_BY_NAME:
        return _LOCS_BY_NAME[key]
    for lkey, lobj in _LOCS_BY_NAME.items():
        if key in lkey or lkey in key:
            return lobj
    for fkey in [key, key.split()[0]]:
        if fkey in FALLBACK_COORDS:
            coords = FALLBACK_COORDS[fkey]
            return {
                "id": key.replace(" ", "_"), "name": name.strip(),
                "lat": coords["lat"], "lng": coords["lng"],
                "category": "cultural", "region": "unknown",
                "visit_duration_hours": 2.0, "entry_fee_usd": 0,
                "best_time": "morning", "tags": [],
                "description": f"Destination: {name.strip()}", "difficulty": "easy",
            }
    return None


def _parse_duration(raw) -> int:
    if raw is None: return 5
    try: return int(raw)
    except (ValueError, TypeError):
        nums = re.findall(r"\d+", str(raw))
        return int(nums[0]) if nums else 5


def _budget_to_tier(budget_usd: float, n_days: int) -> str:
    per_day = budget_usd / max(n_days, 1)
    if per_day < 80:  return "budget"
    if per_day < 200: return "mid"
    return "luxury"

def _food_per_day(tier): return {"budget":15,"mid":40,"luxury":100}.get(tier,40)
def _estimate_accommodation(tier, n_days): return {"budget":18,"mid":100,"luxury":400}.get(tier,100)*n_days

def _get_hotels_for_clusters(ordered_clusters, budget_tier):
    hotels = HOTELS.get(budget_tier, HOTELS.get("mid",[]))
    if not hotels: return []
    suggestions = []
    for cluster in ordered_clusters:
        lat, lng = cluster["centroid"]["lat"], cluster["centroid"]["lng"]
        nearest_area, min_dist = None, float("inf")
        for area_id, area_coords in HOTEL_AREAS.items():
            dist = haversine_distance(lat, lng, area_coords["lat"], area_coords["lng"])
            if dist < min_dist: min_dist, nearest_area = dist, area_id
        matched = next((h for h in hotels if h.get("area")==nearest_area), hotels[0])
        suggestions.append({"day_number":cluster["day_number"],"nearest_area":nearest_area,"distance_to_hotel_km":round(min_dist,1),"hotel":matched})
    return suggestions

def _get_relevant_guides(selected_locations):
    visited_regions = set(l.get("region","") for l in selected_locations)
    relevant = [g for g in GUIDES if any(s in visited_regions for s in g.get("specialization",[]))]
    return relevant or GUIDES[:2]


# ── GET /itineraries/planner-data ─────────────────────────────────────────────
@itinerary_router.get("/itineraries/planner-data")
@login_required
def get_planner_data(current_user, db):
    """
    Returns the user's saved locations enriched with coordinates.
    Also returns:
      default_days       — from quiz_result.duration
      default_budget_usd — from selected_hotels.total_budget ÷ LKR_TO_USD
                           (so ItineraryPlanner pre-fills budget without asking again)
      default_budget_lkr — raw LKR amount for display
    """
    # Read saved locations
    loc_rows = db.execute(text("""
                               SELECT selected_destination FROM selected_locations WHERE user_id = :uid ORDER BY created_at DESC
                               """), {"uid": current_user.user_id}).fetchall()

    names = []
    for row in loc_rows:
        if row[0]: names.extend([p.strip() for p in row[0].split("|") if p.strip()])

    seen, unique_names = set(), []
    for n in names:
        if n.lower() not in seen: seen.add(n.lower()); unique_names.append(n)

    enriched, missing = [], []
    for name in unique_names:
        obj = _enrich_location(name)
        if obj: enriched.append(obj)
        else:   missing.append(name)

    # Quiz duration → default days
    qr = db.execute(text("""
                         SELECT duration, personality_type FROM quiz_result
                         WHERE user_id = :uid ORDER BY result_id DESC LIMIT 1
                         """), {"uid": current_user.user_id}).fetchone()

    default_days     = _parse_duration(qr[0] if qr else None)
    personality_type = (qr[1] or "balanced traveler").strip().lower() if qr else "balanced traveler"

    # ── NEW: read user's saved hotel budget to pre-fill budget_usd ───────────
    hotel_row = db.execute(text("""
                                SELECT sh.total_budget FROM selected_hotels sh
                                WHERE sh.user_id = :uid ORDER BY sh.created_at DESC LIMIT 1
                                """), {"uid": current_user.user_id}).fetchone()

    default_budget_lkr = float(hotel_row[0]) if hotel_row and hotel_row[0] else None
    default_budget_usd = round(default_budget_lkr / LKR_TO_USD) if default_budget_lkr else 500

    return jsonify({
        "locations":           enriched,
        "location_count":      len(enriched),
        "missing_coords":      missing,
        "default_days":        default_days,
        "personality_type":    personality_type,
        "default_budget_lkr":  default_budget_lkr,   # LKR total from saved hotel
        "default_budget_usd":  default_budget_usd,   # USD equivalent for optimizer
        "budget_source":       "hotel" if default_budget_lkr else "default",
    }), 200


# ── POST /itineraries/optimize ────────────────────────────────────────────────
@itinerary_router.post("/itineraries/optimize")
@login_required
def optimize_itinerary(current_user, db):
    """
    Runs K-Means + TSP on user's saved locations.
    n_days and budget_usd come from request body (pre-filled by frontend from quiz/hotel).
    """
    data           = request.get_json(silent=True) or {}
    n_days         = int(data.get("n_days", 5))
    budget_usd     = float(data.get("budget_usd", 500))
    starting_point = str(data.get("starting_point", "colombo")).lower()

    if n_days < 1: return jsonify({"error": "n_days must be at least 1"}), 400

    # Read + enrich saved locations
    loc_rows = db.execute(text("""
                               SELECT selected_destination FROM selected_locations WHERE user_id = :uid
                               """), {"uid": current_user.user_id}).fetchall()

    names = []
    for row in loc_rows:
        if row[0]: names.extend([p.strip() for p in row[0].split("|") if p.strip()])

    seen, unique_names = set(), []
    for n in names:
        if n.lower() not in seen: seen.add(n.lower()); unique_names.append(n)

    selected = [_enrich_location(n) for n in unique_names]
    selected = [s for s in selected if s]

    if len(selected) < 2:
        return jsonify({
            "error": "Not enough locations with coordinates. Save at least 2 locations first.",
            "tip":   "Go to the Locations page and save your destinations."
        }), 400

    result = optimize_route(selected, n_days=n_days, budget_usd=budget_usd, starting_point=starting_point)
    if not result.get("success"): return jsonify(result), 400

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

    qr = db.execute(text("""
                         SELECT result_id, personality_type FROM quiz_result
                         WHERE user_id = :uid ORDER BY result_id DESC LIMIT 1
                         """), {"uid": current_user.user_id}).fetchone()

    result_id        = qr[0] if qr else None
    personality_type = (qr[1] or "balanced traveler").strip().lower() if qr else "balanced traveler"
    itinerary_type   = PERSONALITY_TO_ITINERARY_TYPE.get(personality_type, "peaceful")

    try:
        r = req.post(
            f"{Config.AI_BASE_URL}/recommend",
            json={"user_id": current_user.user_id},
            timeout=10
        )
        if r.ok:
            itinerary_type = r.json().get("itinerary_type", itinerary_type)
    except Exception:
        pass

    title    = f"{n_days}-Day Sri Lanka Trip ({len(selected)} stops)"
    saved_id = None
    try:
        db.execute(text("""
                        INSERT INTO itineraries (user_id, result_id, title, itinerary_plan, itinerary_type, created_at, updated_at)
                        VALUES (:uid, :rid, :title, :plan, :itype, NOW(), NOW())
                        """), {"uid":current_user.user_id,"rid":result_id,"title":title,"plan":json.dumps(result),"itype":itinerary_type})
        db.commit()

        row = db.execute(text("""
                              SELECT id FROM itineraries WHERE user_id = :uid ORDER BY created_at DESC LIMIT 1
                              """), {"uid": current_user.user_id}).fetchone()
        saved_id = row[0] if row else None
        result["saved_itinerary_id"] = saved_id

        if saved_id:
            stop_num, time_slots = 1, ["09:00","11:30","14:00","16:30","18:00"]
            for cluster in result.get("ordered_clusters", []):
                day_num = cluster["day_number"]
                db.execute(text("INSERT INTO daily_plan (itinerary_id, day_number) VALUES (:iid,:dn)"),
                           {"iid":saved_id,"dn":day_num})
                db.flush()
                day_row = db.execute(text("""
                                          SELECT day_id FROM daily_plan WHERE itinerary_id=:iid AND day_number=:dn ORDER BY day_id DESC LIMIT 1
                                          """), {"iid":saved_id,"dn":day_num}).fetchone()
                day_id = day_row[0] if day_row else None
                for i, loc in enumerate(cluster.get("locations", [])):
                    if day_id:
                        db.execute(text("INSERT INTO scheduled_activity (day_id,location,start_time) VALUES (:did,:loc,:st)"),
                                   {"did":day_id,"loc":loc.get("name",""),"st":time_slots[i] if i<len(time_slots) else "09:00"})
                    db.execute(text("INSERT INTO optimized_routes (itinerary_id,location,stop_order) VALUES (:iid,:loc,:so)"),
                               {"iid":saved_id,"loc":loc.get("name",""),"so":stop_num})
                    stop_num += 1
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"[itinerary_routes] DB error: {e}")
        result["db_save_error"] = str(e)

    result["itinerary_type"] = itinerary_type
    return jsonify(result), 200
