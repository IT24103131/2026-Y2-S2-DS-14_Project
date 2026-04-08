# Mapping from personality_type (from quiz_result.personality_type) to destinations

PERSONALITY_TO_DESTINATIONS = {
    "adventurous explorer": [
        "Bentota", "Galle", "Mihintale", "Ritigala",
        "Wilpattu National Park", "Arugam Bay", "Kumana National Park",
        "Dambulla", "Sigiriya", "Pidurangala", "Minneriya National Park",
        "Kandy", "Ella", "Mirissa", "Weligama", "Unawatuna",
        "Yala National Park", "Trincomalee", "Uppuveli", "Habarana",
        "Udawalawe", "Ratnapura"
    ],
    "balanced traveler": [
        "Ahungalla", "Kosgoda", "Balapitiya", "Ambalangoda",
        "Induruwa", "Hikkaduwa", "Beruwala", "Kalutara",
        "Moragalla", "Anuradhapura", "Pottuvil", "Peradeniya",
        "Nuwara Eliya", "Tissamaharama", "Nilaveli", "Polonnaruwa", "Tangalle"
    ],
    "friendly cultural": [
        "Kataragama", "Kandy", "Anuradhapura", "Polonnaruwa", "Dambulla"
    ],
    "organized sightseer": [
        "Negombo", "Colombo", "Galle", "Kandy", "Sigiriya"
    ],
    "calm & relaxed": [
        "Ahungalla", "Kosgoda", "Induruwa", "Beruwala",
        "Kalutara", "Tangalle", "Nilaveli", "Peradeniya"
    ],
}

PERSONALITY_EXPLANATIONS = {
    "adventurous explorer": "High-energy destinations — wildlife, surf towns, and dramatic landscapes chosen for your adventurous personality.",
    "balanced traveler":    "A perfect mix of calm coastlines and cultural depth, paced just right for the balanced traveler.",
    "friendly cultural":    "Sacred sites, welcoming communities, and rich Sri Lankan traditions matched to your cultural personality.",
    "organized sightseer":  "Well-structured city visits and UNESCO heritage sites, ideal for the methodical explorer.",
    "calm & relaxed":       "Quiet beaches and laid-back coastal towns selected to help you recharge and unwind.",
}

DEFAULT_PERSONALITY = "balanced traveler"


def normalize_personality(name: str | None) -> str:
    """Normalize personality_type string to a known key."""
    if not name:
        return DEFAULT_PERSONALITY
    key = name.strip().lower()
    if key in PERSONALITY_TO_DESTINATIONS:
        return key
    # fuzzy fallback
    if "advent"   in key or "explorer"  in key: return "adventurous explorer"
    if "balanced" in key or "traveler"  in key: return "balanced traveler"
    if "cultural" in key or "friendly"  in key: return "friendly cultural"
    if "sightseer"in key or "organiz"   in key: return "organized sightseer"
    if "calm"     in key or "relax"     in key: return "calm & relaxed"
    return DEFAULT_PERSONALITY


# Keep these as aliases so old code still works
VIBE_TO_DESTINATIONS  = PERSONALITY_TO_DESTINATIONS
VIBE_EXPLANATIONS     = PERSONALITY_EXPLANATIONS
DEFAULT_VIBE          = DEFAULT_PERSONALITY
normalize_vibe        = normalize_personality