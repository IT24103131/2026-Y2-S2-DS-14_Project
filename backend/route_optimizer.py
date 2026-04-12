"""
Route Optimization using K-Means Clustering
Groups selected Sri Lanka locations into geographic clusters (days)
then finds the optimal visiting order within each cluster.

Algorithm:
  1. K-Means clusters locations into N groups (where N = number of days)
  2. Nearest Neighbor heuristic orders within each cluster
  3. Two-opt improvement for inter-cluster ordering
"""

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import MinMaxScaler
import joblib
import os
import math
from typing import List, Dict, Tuple, Optional

MODEL_PATH = "models/kmeans_route_model.pkl"
SCALER_PATH = "models/route_scaler.pkl"


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points (km)."""
    R = 6371  # Earth's radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def build_distance_matrix(locations: List[Dict]) -> np.ndarray:
    """Build a pairwise distance matrix for a list of locations."""
    n = len(locations)
    matrix = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            if i != j:
                matrix[i][j] = haversine_distance(
                    locations[i]["lat"], locations[i]["lng"],
                    locations[j]["lat"], locations[j]["lng"]
                )
    return matrix


def nearest_neighbor_tsp(locations: List[Dict], start_idx: int = 0) -> List[int]:
    """
    Nearest Neighbor heuristic for TSP.
    Returns an ordered list of indices for the given locations.
    """
    n = len(locations)
    if n <= 1:
        return list(range(n))

    dist_matrix = build_distance_matrix(locations)
    visited = [False] * n
    path = [start_idx]
    visited[start_idx] = True

    for _ in range(n - 1):
        current = path[-1]
        nearest = -1
        nearest_dist = float('inf')
        for j in range(n):
            if not visited[j] and dist_matrix[current][j] < nearest_dist:
                nearest_dist = dist_matrix[current][j]
                nearest = j
        if nearest != -1:
            path.append(nearest)
            visited[nearest] = True

    return path


def two_opt_improve(locations: List[Dict], path: List[int]) -> List[int]:
    """
    2-opt improvement for a TSP path.
    Tries reversing sub-paths to reduce total distance.
    """
    if len(path) <= 3:
        return path

    def total_distance(p):
        total = 0
        for i in range(len(p) - 1):
            a, b = p[i], p[i + 1]
            total += haversine_distance(
                locations[a]["lat"], locations[a]["lng"],
                locations[b]["lat"], locations[b]["lng"]
            )
        return total

    best = path[:]
    improved = True
    while improved:
        improved = False
        for i in range(1, len(best) - 1):
            for j in range(i + 1, len(best)):
                new_path = best[:i] + best[i:j + 1][::-1] + best[j + 1:]
                if total_distance(new_path) < total_distance(best):
                    best = new_path
                    improved = True
    return best


def cluster_locations_kmeans(
        locations: List[Dict],
        n_days: int,
        random_state: int = 42
) -> Tuple[List[int], object, object]:
    """
    Cluster locations into n_days groups using K-Means on lat/lng.

    Returns:
        labels: cluster label for each location
        kmeans: fitted KMeans model
        scaler: fitted scaler
    """
    if len(locations) <= n_days:
        # Each location gets its own day
        labels = list(range(len(locations)))
        return labels, None, None

    coords = np.array([[loc["lat"], loc["lng"]] for loc in locations])

    # Scale coordinates for K-Means
    scaler = MinMaxScaler()
    coords_scaled = scaler.fit_transform(coords)

    # K-Means with multiple initializations for stability
    kmeans = KMeans(
        n_clusters=n_days,
        init='k-means++',
        n_init=20,
        max_iter=500,
        random_state=random_state
    )
    kmeans.fit(coords_scaled)
    labels = kmeans.labels_.tolist()

    # Save model for reuse
    os.makedirs("models", exist_ok=True)
    joblib.dump(kmeans, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)

    return labels, kmeans, scaler


def order_clusters_by_geography(
        clusters: Dict[int, List[Dict]],
        starting_location: Optional[str] = "colombo"
) -> List[int]:
    """
    Order day-clusters geographically to minimize backtracking.
    Uses the centroid of each cluster and nearest-neighbor ordering.

    Returns ordered list of cluster IDs.
    """
    # Compute centroid for each cluster
    centroids = {}
    for cluster_id, locs in clusters.items():
        centroids[cluster_id] = {
            "lat": np.mean([l["lat"] for l in locs]),
            "lng": np.mean([l["lng"] for l in locs]),
            "id": str(cluster_id)
        }

    centroid_list = [{"lat": c["lat"], "lng": c["lng"], "cluster_id": cid}
                     for cid, c in centroids.items()]

    # Start from cluster nearest to Colombo (typical arrival airport)
    colombo_lat, colombo_lng = 6.9271, 79.8612
    min_dist = float('inf')
    start_idx = 0
    for i, c in enumerate(centroid_list):
        d = haversine_distance(colombo_lat, colombo_lng, c["lat"], c["lng"])
        if d < min_dist:
            min_dist = d
            start_idx = i

    # Nearest neighbor on centroids
    nn_order = nearest_neighbor_tsp(centroid_list, start_idx)

    # Return ordered cluster IDs
    return [centroid_list[i]["cluster_id"] for i in nn_order]


def optimize_route(
        selected_locations: List[Dict],
        n_days: int,
        budget_usd: float = 500,
        starting_point: str = "colombo"
) -> Dict:
    """
    Main route optimization function.

    Args:
        selected_locations: List of location dicts with lat, lng, id, name, etc.
        n_days: Number of days for the trip
        budget_usd: Total budget in USD
        starting_point: Starting location for route

    Returns:
        Optimized route with clusters, ordered itinerary, and stats
    """
    if not selected_locations:
        return {"error": "No locations provided"}

    if n_days < 1:
        return {"error": "Number of days must be at least 1"}

    # Adjust n_days if more days than locations
    effective_days = min(n_days, len(selected_locations))

    # Step 1: K-Means clustering
    labels, kmeans_model, scaler = cluster_locations_kmeans(
        selected_locations, effective_days
    )

    # Step 2: Group locations by cluster
    clusters: Dict[int, List[Dict]] = {}
    for i, label in enumerate(labels):
        clusters.setdefault(label, []).append({**selected_locations[i], "original_idx": i})

    # Step 3: Order clusters geographically
    ordered_cluster_ids = order_clusters_by_geography(clusters, starting_point)

    # Step 4: Optimize order within each cluster
    optimized_clusters = []
    for cluster_id in ordered_cluster_ids:
        locs = clusters[cluster_id]
        if len(locs) > 1:
            nn_path = nearest_neighbor_tsp(locs, 0)
            improved_path = two_opt_improve(locs, nn_path)
            ordered_locs = [locs[i] for i in improved_path]
        else:
            ordered_locs = locs
        optimized_clusters.append({
            "cluster_id": int(cluster_id),
            "locations": ordered_locs
        })

    # Step 5: Compute route statistics
    total_distance_km = 0
    all_ordered = []
    for cluster in optimized_clusters:
        locs = cluster["locations"]
        all_ordered.extend(locs)
        for i in range(len(locs) - 1):
            total_distance_km += haversine_distance(
                locs[i]["lat"], locs[i]["lng"],
                locs[i + 1]["lat"], locs[i + 1]["lng"]
            )

    # Inter-cluster distances
    for i in range(len(optimized_clusters) - 1):
        last_of_curr = optimized_clusters[i]["locations"][-1]
        first_of_next = optimized_clusters[i + 1]["locations"][0]
        total_distance_km += haversine_distance(
            last_of_curr["lat"], last_of_curr["lng"],
            first_of_next["lat"], first_of_next["lng"]
        )

    # Compute per-location cluster assignments for response
    location_cluster_map = {}
    for cluster in optimized_clusters:
        for loc in cluster["locations"]:
            location_cluster_map[loc["id"]] = cluster["cluster_id"]

    return {
        "success": True,
        "n_days": effective_days,
        "total_locations": len(selected_locations),
        "total_distance_km": round(total_distance_km, 2),
        "estimated_travel_hours": round(total_distance_km / 60, 2),  # ~60 km/h avg
        "ordered_clusters": [
            {
                "day_number": i + 1,
                "cluster_id": cluster["cluster_id"],
                "locations": [
                    {
                        "id": loc["id"],
                        "name": loc["name"],
                        "lat": loc["lat"],
                        "lng": loc["lng"],
                        "category": loc.get("category", ""),
                        "visit_duration_hours": loc.get("visit_duration_hours", 2),
                        "entry_fee_usd": loc.get("entry_fee_usd", 0),
                        "best_time": loc.get("best_time", "morning"),
                        "description": loc.get("description", ""),
                        "tags": loc.get("tags", []),
                        "difficulty": loc.get("difficulty", "easy"),
                    }
                    for loc in cluster["locations"]
                ],
                "centroid": {
                    "lat": round(np.mean([l["lat"] for l in cluster["locations"]]), 4),
                    "lng": round(np.mean([l["lng"] for l in cluster["locations"]]), 4)
                },
                "total_visit_hours": round(sum(
                    l.get("visit_duration_hours", 2) for l in cluster["locations"]
                ), 1),
                "total_entry_fees_usd": sum(
                    l.get("entry_fee_usd", 0) for l in cluster["locations"]
                ),
            }
            for i, cluster in enumerate(optimized_clusters)
        ],
        "route_summary": {
            "starting_point": starting_point,
            "total_distance_km": round(total_distance_km, 2),
            "avg_daily_distance_km": round(total_distance_km / effective_days, 2),
            "total_entry_fees_usd": sum(
                l.get("entry_fee_usd", 0) for l in selected_locations
            ),
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# DAY SPLITTING & ITINERARY FINALIZATION
# New functions added below — nothing above is changed.
# ─────────────────────────────────────────────────────────────────────────────

from datetime import date, timedelta


def calculate_travel_time_hours(loc1: Dict, loc2: Dict, speed_kmh: float = 50) -> float:
    """
    Estimate driving time between two locations.
    Uses 50 km/h average (accounts for Sri Lanka's winding roads).
    Adds 0.25h (15 min) buffer for stops and traffic.
    """
    dist = haversine_distance(loc1["lat"], loc1["lng"], loc2["lat"], loc2["lng"])
    return round((dist / speed_kmh) + 0.25, 2)


def calculate_day_load(locations: List[Dict]) -> float:
    """
    Total time commitment for a list of locations in one day.
    Includes visit durations + travel time between consecutive stops.
    """
    if not locations:
        return 0.0

    total = sum(loc.get("visit_duration_hours", 2.0) for loc in locations)

    # Add travel time between consecutive stops
    for i in range(len(locations) - 1):
        total += calculate_travel_time_hours(locations[i], locations[i + 1])

    return round(total, 2)


def split_overloaded_day(locations: List[Dict], max_hours: float) -> List[List[Dict]]:
    """
    If a single day's locations exceed max_hours, split them into smaller chunks.
    Keeps locations in their optimized order — just cuts when the limit is reached.
    Returns a list of day-chunks (each chunk is a list of locations).
    """
    days = []
    current_day = []
    current_hours = 0.0

    for loc in locations:
        visit_hrs = loc.get("visit_duration_hours", 2.0)
        travel_hrs = calculate_travel_time_hours(current_day[-1], loc) if current_day else 0.0
        added_hours = visit_hrs + travel_hrs

        if current_hours + added_hours > max_hours and current_day:
            # Current day is full — start a new one
            days.append(current_day)
            current_day = [loc]
            current_hours = visit_hrs
        else:
            current_day.append(loc)
            current_hours += added_hours

    if current_day:
        days.append(current_day)

    return days


def balance_days(
        day_chunks: List[List[Dict]],
        max_hours: float = 8.0,
        min_hours: float = 3.0
) -> List[List[Dict]]:
    """
    Rebalances days so none are too short or too long.
    - Splits days that exceed max_hours
    - Merges consecutive days that are too short (under min_hours) if they fit together
    """
    # First pass: split overloaded days
    balanced = []
    for chunk in day_chunks:
        load = calculate_day_load(chunk)
        if load > max_hours:
            sub_chunks = split_overloaded_day(chunk, max_hours)
            balanced.extend(sub_chunks)
        else:
            balanced.append(chunk)

    # Second pass: merge underloaded consecutive days
    merged = []
    i = 0
    while i < len(balanced):
        current = balanced[i]
        if i + 1 < len(balanced):
            combined = current + balanced[i + 1]
            if calculate_day_load(combined) <= max_hours:
                merged.append(combined)
                i += 2
                continue
        merged.append(current)
        i += 1

    return merged


def get_hotel_suggestion(
        location: Dict,
        budget_tier: str,
        hotels_data: Dict,
        hotel_areas: Optional[Dict] = None
) -> Optional[Dict]:
    """
    Find the nearest available hotel to a given location matching the budget tier.

    Hotels are only available in specific covered areas (Ahungalla, Anuradhapura,
    Arugam Bay, Dambulla, Hambantota, Hikkaduwa, Kalutara, Kandy, Mirissa,
    Negombo, Panadura, Polonnaruwa, Thalpe, Trincomalee, Yala).

    Strategy:
      1. If hotel_areas provided: find the closest covered area to the location,
         then return the hotel in that area matching the budget tier.
      2. Fallback: return the first hotel in the tier.
    """
    tier_hotels = hotels_data.get(budget_tier, [])
    if not tier_hotels:
        return None

    # If no area coords provided, just return first in tier
    if not hotel_areas:
        return tier_hotels[0]

    loc_lat = location.get("lat")
    loc_lng = location.get("lng")
    if loc_lat is None or loc_lng is None:
        return tier_hotels[0]

    # Find the nearest covered hotel area using haversine
    nearest_area = None
    min_dist = float("inf")
    for area_id, area_coords in hotel_areas.items():
        dist = haversine_distance(loc_lat, loc_lng, area_coords["lat"], area_coords["lng"])
        if dist < min_dist:
            min_dist = dist
            nearest_area = area_id

    # Return the hotel in that nearest area for this budget tier
    for hotel in tier_hotels:
        if hotel.get("area") == nearest_area:
            return hotel

    # Final fallback
    return tier_hotels[0]


def finalize_itinerary(
        optimize_route_result: Dict,
        trip_start_date: date,
        budget_tier: str = "mid",
        max_hours_per_day: float = 8.0,
        hotels_data: Optional[Dict] = None,
        hotel_areas: Optional[Dict] = None,
) -> Dict:
    """
    Takes the output of optimize_route() and produces a finalized day-by-day itinerary.

    Args:
        optimize_route_result: The dict returned by optimize_route()
        trip_start_date: The date the trip starts (Python date object)
        budget_tier: "budget", "mid", or "luxury"
        max_hours_per_day: Maximum activity hours per day (default 8)
        hotels_data: The HOTELS dict from locations_data.py (optional, adds hotel suggestions)
        hotel_areas: The HOTEL_AREAS dict from locations_data.py (used for nearest-area matching)

    Returns:
        Final itinerary dict ready to save as itinerary_json in the DB
    """
    if not optimize_route_result.get("success"):
        return {"error": "Route optimization failed — cannot finalize itinerary"}

    ordered_clusters = optimize_route_result["ordered_clusters"]

    # Use cluster groupings as initial day hints, then rebalance
    initial_day_chunks = [cluster["locations"] for cluster in ordered_clusters]

    # Rebalance days if needed
    balanced_days = balance_days(initial_day_chunks, max_hours=max_hours_per_day)

    # Build the finalized itinerary
    finalized_days = []
    current_date = trip_start_date

    for day_idx, day_locations in enumerate(balanced_days, start=1):
        day_dict = {
            "day_number": day_idx,
            "date": current_date.isoformat(),
            "locations": [],
            "total_hours": round(calculate_day_load(day_locations), 1),
            "total_entry_fees_usd": sum(loc.get("entry_fee_usd", 0) for loc in day_locations),
        }

        # Add locations to the day
        cumulative_time = 0.0
        for loc in day_locations:
            start_time_hours = cumulative_time
            visit_duration = loc.get("visit_duration_hours", 2.0)
            cumulative_time += visit_duration

            location_dict = {
                "id": loc.get("id"),
                "name": loc.get("name"),
                "category": loc.get("category"),
                "lat": loc.get("lat"),
                "lng": loc.get("lng"),
                "visit_duration_hours": visit_duration,
                "entry_fee_usd": loc.get("entry_fee_usd", 0),
                "best_time": loc.get("best_time"),
                "description": loc.get("description"),
                "tags": loc.get("tags", []),
                "difficulty": loc.get("difficulty"),
                "start_time_hours": start_time_hours,
            }
            day_dict["locations"].append(location_dict)

        # Add hotel suggestion if data provided
        if hotels_data and day_locations:
            first_location = day_locations[0]
            hotel = get_hotel_suggestion(first_location, budget_tier, hotels_data, hotel_areas)
            if hotel:
                day_dict["hotel_suggestion"] = hotel

        finalized_days.append(day_dict)
        current_date += timedelta(days=1)

    return {
        "success": True,
        "trip_start_date": trip_start_date.isoformat(),
        "n_days": len(balanced_days),
        "budget_tier": budget_tier,
        "total_distance_km": optimize_route_result.get("total_distance_km", 0),
        "total_entry_fees_usd": optimize_route_result.get("route_summary", {}).get("total_entry_fees_usd", 0),
        "days": finalized_days,
        "route_summary": optimize_route_result.get("route_summary", {}),
    }


if __name__ == "__main__":
    # Quick test
    from locations_data import SRI_LANKA_LOCATIONS, HOTELS, HOTEL_AREAS
    from datetime import date
    import json

    selected = SRI_LANKA_LOCATIONS[:8]
    route = optimize_route(selected, n_days=4, budget_usd=800)

    itinerary = finalize_itinerary(
        optimize_route_result=route,
        trip_start_date=date(2025, 6, 1),
        budget_tier="mid",
        max_hours_per_day=8.0,
        hotels_data=HOTELS,
        hotel_areas=HOTEL_AREAS,
    )

    print(json.dumps(itinerary, indent=2))