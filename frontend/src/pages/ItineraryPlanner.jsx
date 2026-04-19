import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import API from "../services/api";
import Layout from "../components/Layout";
import NextStepBanner from "../components/NextStepBanner";
import { fmtLKR, lkrToUsd, fmtUSD } from "../utils/currency";

// ─────────────────────────────────────────────────────────────────────────────
// ItineraryPlanner.jsx  —  Member 5's route optimizer, fully integrated.
//
// Flow:
//   Step 0 — Trip Settings  (reads user's saved locations from DB automatically)
//   Step 1 — Optimised result with:
//               • Leaflet map
//               • Day-by-day plan
//               • Budget breakdown
//               • User's saved hotel (from selected_hotels)
//               • User's saved guide  (from selected_guides)
//               • Inline feedback form
//
// Endpoints used:
//   GET  /itineraries/planner-data  → user's saved locations enriched with coords
//   POST /itineraries/optimize      → run K-Means + TSP, save to DB
//   GET  /hotels/saved              → user's confirmed hotel
//   GET  /guides/booking            → user's confirmed guide
//   POST /feedback                  → submit star rating
// ─────────────────────────────────────────────────────────────────────────────

// Fix Leaflet icon paths broken by bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const DAY_COLORS    = ["#8C3322","#D4A373","#A95C42","#6B2E1E","#C68A57","#823A2A","#DEB887","#5E2012","#B5764F","#A8402D"];
const STARTING_POINTS = [
    { value: "colombo", label: "Colombo (CMB Airport)" },
    { value: "negombo", label: "Negombo" },
    { value: "kandy",   label: "Kandy" },
];
const STEPS = ["Trip Settings", "Your Itinerary"];

function HansaWatermark() {
    return (
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, opacity: 0.07, pointerEvents: "none", overflow: "hidden", display: "flex", alignItems: "center" }}>
            <svg viewBox="0 0 200 200" width="160" height="160" fill="white" xmlns="http://www.w3.org/2000/svg">
                <circle cx="100" cy="100" r="80" fill="none" stroke="white" strokeWidth="2" />
                <circle cx="100" cy="100" r="60" fill="none" stroke="white" strokeWidth="1.5" />
                <circle cx="100" cy="100" r="40" fill="none" stroke="white" strokeWidth="1" />
                <path d="M100 20 L110 90 L180 100 L110 110 L100 180 L90 110 L20 100 L90 90 Z" fill="white" opacity="0.6" />
                <circle cx="100" cy="100" r="12" fill="white" />
            </svg>
        </div>
    );
}

// ── Leaflet helpers ───────────────────────────────────────────────────────────
function makeIcon(number, color) {
    return L.divIcon({
        html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid rgba(255,255,255,0.6);box-shadow:0 2px 8px rgba(0,0,0,0.4)">${number}</div>`,
        className: "", iconSize: [28, 28], iconAnchor: [14, 14],
    });
}

function FitBounds({ positions }) {
    const map = useMap();
    useEffect(() => {
        if (positions.length > 0) map.fitBounds(positions, { padding: [30, 30] });
    }, [positions, map]);
    return null;
}

// ── Sidebar cards: saved hotel + guide ───────────────────────────────────────

function SavedHotelCard({ hotel }) {
    if (!hotel) return null;
    return (
        <div style={{
            background: "rgba(255,204,0,0.08)",
            border: "1px solid rgba(255,204,0,0.2)",
            borderRadius: 12,
            padding: "14px 16px",
            color: "#fff",
        }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(255,255,255,0.4)", marginBottom:10 }}>
                🏨 Your Booked Hotel
            </div>
            <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>{hotel.name}</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.55)", marginBottom:6 }}>📍 {hotel.location}</div>
            {(hotel.check_in || hotel.check_out) && (
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", marginBottom:6 }}>
                    {hotel.check_in  && `📅 In: ${hotel.check_in}`}
                    {hotel.check_out && `  ·  Out: ${hotel.check_out}`}
                </div>
            )}
            <div style={{ fontWeight:700, color:"#ffcc00", fontSize:14 }}>
                {fmtLKR(hotel.total_budget)}
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}> / ~{fmtUSD(lkrToUsd(hotel.total_budget))}</span>
                <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)", fontWeight:400 }}> total budget</span>
            </div>
        </div>
    );
}

function SavedGuideCard({ guide }) {
    if (!guide || guide.current_status !== "confirmed") return null;
    return (
        <div style={{
            background: "rgba(122,184,176,0.1)",
            border: "1px solid rgba(122,184,176,0.25)",
            borderRadius: 12,
            padding: "14px 16px",
            color: "#fff",
        }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(255,255,255,0.4)", marginBottom:10 }}>
                🧭 Your Booked Guide
            </div>
            <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>{guide.name}</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.55)", marginBottom:4 }}>
                🗣 {guide.language} · 📍 {guide.base_location}
            </div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", marginBottom:6 }}>
                ⭐ {guide.rating} · LKR {Number(guide.daily_rate).toLocaleString()}/day
            </div>
            <div style={{ fontWeight:700, color:"#ffcc00", fontSize:14 }}>
                {fmtLKR(guide.estimated_budget)}
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}> / ~{fmtUSD(lkrToUsd(guide.estimated_budget))}</span>
                <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)", fontWeight:400 }}> estimated total</span>
            </div>
        </div>
    );
}

// ── Inline feedback form ──────────────────────────────────────────────────────
function FeedbackForm({ itineraryId }) {
    const [rating,    setRating]    = useState(0);
    const [hovered,   setHovered]   = useState(0);
    const [comment,   setComment]   = useState("");
    const [loading,   setLoading]   = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error,     setError]     = useState("");

    const handleSubmit = async () => {
        if (!rating) { setError("Please select a rating."); return; }
        setLoading(true); setError("");
        try {
            await API.post("/feedback", { itinerary_id: itineraryId, rating, comment });
            setSubmitted(true);
        } catch (e) {
            setError(e?.response?.data?.detail || "Could not submit feedback.");
        } finally {
            setLoading(false);
        }
    };

    if (submitted) return (
        <div style={{ background:"#FDF5EE", border:"1px solid #D4A373", borderRadius:12, padding:"20px 24px", textAlign:"center", color:"#8C3322" }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🎉</div>
            <div style={{ fontWeight:600, marginBottom:4 }}>Thanks for your feedback!</div>
            <div style={{ fontSize:12, color:"rgba(140,51,34,0.7)" }}>Your rating helps improve future recommendations.</div>
        </div>
    );

    return (
        <div style={{ background:"#FFFFFF", border:"1px solid #E8D5BC", borderRadius:12, padding:24, color:"#3E2723", boxShadow:"0 4px 14px rgba(62,39,35,0.06)" }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"#8C3322" }}>⭐ Rate This Itinerary</div>

            {/* Stars */}
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                {[1,2,3,4,5].map(n => (
                    <button key={n} type="button"
                            onMouseEnter={() => setHovered(n)}
                            onMouseLeave={() => setHovered(0)}
                            onClick={() => setRating(n)}
                            style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}>
                        <svg width="32" height="32" viewBox="0 0 24 24"
                             style={{ fill: n<=(hovered||rating) ? "#D4A373" : "rgba(62,39,35,0.15)", filter: n<=(hovered||rating) ? "drop-shadow(0 0 4px rgba(212,163,115,0.5))" : "none", transition:"fill 0.15s" }}>
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                    </button>
                ))}
            </div>

            {/* Comment */}
            <textarea
                placeholder="What did you love? Any suggestions? (optional)"
                value={comment}
                onChange={e => setComment(e.target.value)}
                style={{ width:"100%", background:"#F9F6F0", border:"1px solid #E8D5BC", borderRadius:8, padding:"10px 14px", color:"#3E2723", fontFamily:"'DM Sans',sans-serif", fontSize:13, outline:"none", resize:"vertical", minHeight:80, marginBottom:14, boxSizing:"border-box" }}
            />

            {error && <div style={{ color:"#8C3322", fontSize:12, marginBottom:12 }}>{error}</div>}

            <button onClick={handleSubmit} disabled={loading || !rating}
                    style={{ width:"100%", padding:"12px", background: rating ? "#8C3322" : "#F9F6F0", border: rating ? "none" : "1px solid #E8D5BC", borderRadius:10, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:14, color: rating ? "#fff" : "rgba(62,39,35,0.4)", cursor: rating ? "pointer" : "not-allowed", transition:"background 0.2s" }}>
                {loading ? "Submitting…" : "Submit Review"}
            </button>
        </div>
    );
}

// ── Step 0: Trip Settings ─────────────────────────────────────────────────────
/**
 * PATCH for ItineraryPlanner.jsx — replace ONLY the TripSettings function.
 *
 * Find this line in ItineraryPlanner.jsx:
 *   function TripSettings({ plannerData, onSubmit }) {
 *
 * Replace the ENTIRE TripSettings function (from that line to its closing })
 * with the version below.
 *
 * WHAT CHANGES:
 *   - No more budget slider (budget comes from saved hotel automatically)
 *   - n_days pre-filled from quiz but user can still adjust if needed
 *   - Shows hotel budget source clearly ("from your saved hotel")
 *   - If no hotel saved yet, shows a fallback default ($500) with a note
 */

function TripSettings({ plannerData, onSubmit }) {
    const [startingPoint, setStartingPoint] = useState("colombo");

    const count      = plannerData.location_count || 0;
    const days       = plannerData.default_days || 5;
    const budgetUsd  = plannerData.default_budget_usd || 500;
    const budgetLkr  = plannerData.default_budget_lkr;
    const budgetSource = plannerData.budget_source;

    if (count < 2) return (
        <div style={{ maxWidth:640, margin:"0 auto" }}>
            <div style={{ background:"#FFFFFF", border:"1px solid #E8D5BC", borderRadius:14, padding:32, color:"#3E2723", textAlign:"center", boxShadow:"0 4px 14px rgba(62,39,35,0.06)" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📍</div>
                <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:20, marginBottom:8 }}>No saved locations yet</h3>
                <p style={{ fontSize:13.5, color:"rgba(62,39,35,0.6)", marginBottom:20 }}>
                    Save at least 2 destinations from the Locations page before generating an itinerary.
                </p>
                <a href="/locations" style={{ padding:"11px 24px", background:"#8C3322", borderRadius:10, fontWeight:700, fontSize:13.5, color:"#fff", textDecoration:"none", display:"inline-block" }}>
                    Go to Locations →
                </a>
            </div>
        </div>
    );

    return (
        <div style={{ maxWidth:640, margin:"0 auto" }}>
            <div style={{ marginBottom:24 }}>
                <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, color:"#3E2723", marginBottom:6 }}>Trip Settings</h2>
                <p style={{ fontSize:13.5, color:"rgba(62,39,35,0.6)" }}>
                    We'll build an optimised route using your <strong>{count} saved location{count!==1?"s":""}</strong>.
                    All settings are pulled from your quiz and hotel booking automatically.
                </p>
                {plannerData.missing_coords?.length > 0 && (
                    <div style={{ marginTop:10, background:"rgba(212,163,115,0.15)", border:"1px solid #D4A373", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#8C3322" }}>
                        ⚠️ No coordinates found for: <strong>{plannerData.missing_coords.join(", ")}</strong> — these will be skipped.
                    </div>
                )}
            </div>

            {/* Saved locations preview */}
            <div style={{ background:"#FFFFFF", border:"1px solid #E8D5BC", borderRadius:12, padding:"14px 18px", marginBottom:16, color:"#3E2723", boxShadow:"0 2px 8px rgba(62,39,35,0.04)" }}>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(62,39,35,0.45)", marginBottom:10 }}>Your Saved Locations</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                    {plannerData.locations.map((loc, i) => (
                        <span key={i} style={{ background:"#F9F6F0", border:"1px solid #E8D5BC", borderRadius:6, padding:"4px 10px", fontSize:12, color:"#3E2723" }}>
                            📍 {loc.name}
                        </span>
                    ))}
                </div>
            </div>

            {/* Auto-filled settings summary */}
            <div style={{ background:"#FFFFFF", border:"1px solid #E8D5BC", borderRadius:14, padding:28, color:"#3E2723", marginBottom:16, boxShadow:"0 4px 16px rgba(62,39,35,0.06)" }}>

                {/* Trip duration — from quiz, read-only */}
                <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(62,39,35,0.55)", marginBottom:10 }}>
                        Trip Duration
                    </div>
                    <div style={{ background:"#F9F6F0", border:"1px solid #E8D5BC", borderRadius:10, padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                        <div>
                            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:"#8C3322" }}>{days} days</div>
                            <div style={{ fontSize:11, color:"rgba(62,39,35,0.5)", marginTop:3 }}>
                                Based on your quiz preference
                            </div>
                        </div>
                        <div style={{ fontSize:28 }}>🗓️</div>
                    </div>
                </div>

                {/* Budget — from saved hotel */}
                <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(62,39,35,0.55)", marginBottom:10 }}>
                        Budget
                    </div>
                    <div style={{
                        background: budgetSource === "hotel" ? "rgba(212,163,115,0.15)" : "#F9F6F0",
                        border: budgetSource === "hotel" ? "1px solid #D4A373" : "1px solid #E8D5BC",
                        borderRadius:10, padding:"14px 16px",
                    }}>
                        {budgetSource === "hotel" ? (
                            <>
                                <div style={{ fontSize:11, color:"rgba(62,39,35,0.6)", marginBottom:4 }}>
                                    ✅ From your saved hotel booking
                                </div>
                                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:"#8C3322" }}>
                                    ${budgetUsd.toLocaleString()} USD
                                </div>
                                {budgetLkr && (
                                    <div style={{ fontSize:11, color:"rgba(62,39,35,0.5)", marginTop:3 }}>
                                        LKR {Number(budgetLkr).toLocaleString()} ÷ 320 ≈ ${budgetUsd}
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div style={{ fontSize:11, color:"rgba(62,39,35,0.6)", marginBottom:4 }}>
                                    ℹ️ Default estimate — save a hotel for accurate budget
                                </div>
                                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:"#D4A373" }}>
                                    ${budgetUsd.toLocaleString()} USD
                                </div>
                                <a href="/hotels" style={{ fontSize:11, color:"#8C3322", marginTop:4, display:"inline-block" }}>
                                    → Save a hotel to use your actual budget
                                </a>
                            </>
                        )}
                    </div>
                </div>

                {/* Starting Point — only user-adjustable field */}
                <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(62,39,35,0.55)", marginBottom:10 }}>Starting Point</label>
                    <select value={startingPoint} onChange={e => setStartingPoint(e.target.value)}
                            style={{ width:"100%", background:"#F9F6F0", border:"1px solid #E8D5BC", borderRadius:8, padding:"10px 14px", color:"#3E2723", fontFamily:"'DM Sans',sans-serif", fontSize:13.5, outline:"none" }}>
                        <option value="colombo" style={{ color:"#3E2723" }}>Colombo (CMB Airport)</option>
                        <option value="negombo" style={{ color:"#3E2723" }}>Negombo</option>
                        <option value="kandy"   style={{ color:"#3E2723" }}>Kandy</option>
                    </select>
                </div>
            </div>

            <button onClick={() => onSubmit({ days, budget: budgetUsd, startingPoint })}
                    style={{ width:"100%", padding:14, background:"#8C3322", border:"none", borderRadius:10, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:15, color:"#fff", cursor:"pointer", boxShadow:"0 4px 14px rgba(140,51,34,0.3)" }}>
                ✨ Generate Optimised Itinerary →
            </button>
        </div>
    );
}

// ── Step 1: Itinerary Result ──────────────────────────────────────────────────
function ItineraryResult({ result, onBack, onNewTrip }) {
    const [openDay, setOpenDay] = useState(1);

    // ── Fetch user's saved hotel + guide on mount ─────────────────────────────
    const [savedHotel, setSavedHotel] = useState(null);
    const [savedGuide, setSavedGuide] = useState(null);

    useEffect(() => {
        // Get user's confirmed hotel (most recent)
        API.get("/hotels/saved")
            .then(r => setSavedHotel(r.data.saved_hotels?.[0] || null))
            .catch(() => {});
        // Get user's confirmed guide booking
        API.get("/guides/booking")
            .then(r => setSavedGuide(r.data || null))
            .catch(() => {});
    }, []);
    // ─────────────────────────────────────────────────────────────────────────

    const {
        ordered_clusters, route_summary, budget_breakdown,
        hotel_suggestions, n_days, total_distance_km
    } = result;

    const allPositions = ordered_clusters.flatMap(day => day.locations.map(l => [l.lat, l.lng]));

    return (
        <div>
            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
                <div>
                    <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, color:"#3E2723", marginBottom:4 }}>🎉 Your Optimised Itinerary</h2>
                    <p style={{ fontSize:13.5, color:"rgba(62,39,35,0.6)" }}>
                        {n_days}-day Sri Lanka trip · Starting from {route_summary?.starting_point}
                    </p>
                </div>
                <div style={{ display:"flex", gap:10 }}>
                    <button onClick={onBack}
                            style={{ padding:"9px 16px", border:"1px solid #E8D5BC", borderRadius:10, background:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:12.5, color:"rgba(62,39,35,0.7)", cursor:"pointer" }}>
                        ← Edit
                    </button>
                    <button onClick={onNewTrip}
                            style={{ padding:"9px 16px", border:"none", borderRadius:10, background:"#8C3322", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:12.5, color:"#fff", cursor:"pointer" }}>
                        New Trip
                    </button>
                </div>
            </div>

            {/* Map */}
            <div style={{ borderRadius:14, overflow:"hidden", border:"1px solid rgba(45,74,71,0.15)", marginBottom:24, boxShadow:"0 4px 20px rgba(29,58,54,0.12)" }}>
                <MapContainer
                    bounds={[
                        [5.9, 79.5],
                        [9.9, 81.9]
                    ]}
                    maxBounds={[
                        [5.5, 79.0],
                        [10.2, 82.2]
                    ]}
                    maxBoundsViscosity={1.0}
                    dragging={true}
                    scrollWheelZoom={false}
                    doubleClickZoom={false}
                    zoomControl={true}
                    style={{ height:800, width:"100%" }}
                >                   <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                    />
                    <FitBounds positions={allPositions} />
                    {(() => {
                        let globalStop = 0;
                        return ordered_clusters.map((day, dayIdx) => {
                            const color = DAY_COLORS[dayIdx % DAY_COLORS.length];
                            const pts   = day.locations.map(l => [l.lat, l.lng]);
                            return (
                                <div key={day.day_number}>
                                    {pts.length > 1 && <Polyline positions={pts} color={color} weight={2.5} opacity={0.75} dashArray="6,4" />}
                                    {day.locations.map((loc, li) => {
                                        globalStop++;
                                        return (
                                            <Marker key={`${day.day_number}-${li}`} position={[loc.lat, loc.lng]} icon={makeIcon(globalStop, color)}>
                                                <Popup>
                                                    <div style={{ fontFamily:"'DM Sans',sans-serif", minWidth:150 }}>
                                                        <strong>{loc.name}</strong>
                                                        <div style={{ fontSize:11, color:"#64748b", margin:"4px 0" }}>Day {day.day_number} · Stop {li+1}</div>
                                                        <div style={{ fontSize:11 }}>
                                                            🕐 {loc.visit_duration_hours}h &nbsp;
                                                            {loc.entry_fee_usd > 0 ? `💵 $${loc.entry_fee_usd}` : "💚 Free"}
                                                        </div>
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        );
                                    })}
                                </div>
                            );
                        });
                    })()}
                </MapContainer>
            </div>

            {/* Main grid: day cards + sidebar */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:20, alignItems:"start" }}>

                {/* ── Day cards ─────────────────────────────────────────── */}
                <div>
                    {ordered_clusters.map(day => {
                        const isOpen = openDay === day.day_number;
                        const color  = DAY_COLORS[(day.day_number-1) % DAY_COLORS.length];
                        return (
                            <div key={day.day_number} style={{ background:"#FFFFFF", border:"1px solid #E8D5BC", borderRadius:12, marginBottom:12, overflow:"hidden", color:"#3E2723", boxShadow:"0 2px 8px rgba(62,39,35,0.04)" }}>
                                <div onClick={() => setOpenDay(isOpen ? null : day.day_number)}
                                     style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", cursor:"pointer", background: isOpen ? "#FDF5EE" : "transparent" }}>
                                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                                        <span style={{ background:"#8C3322", borderRadius:8, padding:"3px 12px", fontSize:11, fontWeight:700, color:"#fff" }}>Day {day.day_number}</span>
                                        <div>
                                            <div style={{ fontWeight:600, fontSize:14 }}>{day.locations.map(l => l.name.split(" ")[0]).join(" · ")}</div>
                                            <div style={{ fontSize:11, color:"rgba(62,39,35,0.5)", marginTop:2 }}>{day.locations.length} location{day.locations.length!==1?"s":""}</div>
                                        </div>
                                    </div>
                                    <div style={{ display:"flex", alignItems:"center", gap:18 }}>
                                        <div style={{ textAlign:"center" }}>
                                            <div style={{ fontWeight:700 }}>{day.total_visit_hours}h</div>
                                            <div style={{ fontSize:10, color:"rgba(62,39,35,0.45)" }}>Visit</div>
                                        </div>
                                        <div style={{ textAlign:"center" }}>
                                            <div style={{ fontWeight:700 }}>${day.total_entry_fees_usd}</div>
                                            <div style={{ fontSize:10, color:"rgba(62,39,35,0.45)" }}>Fees</div>
                                        </div>
                                        <span style={{ color:"rgba(62,39,35,0.4)", fontSize:12 }}>{isOpen ? "▲" : "▼"}</span>
                                    </div>
                                </div>

                                {isOpen && (
                                    <div style={{ padding:"0 20px 20px", borderTop:"1px solid #E8D5BC" }}>
                                        {day.locations.map((loc, li) => (
                                            <div key={li} style={{ display:"flex", gap:14, padding:"13px 0", borderBottom: li<day.locations.length-1 ? "1px solid #E8D5BC" : "none" }}>
                                                <div style={{ width:24, height:24, borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:11, color:"#fff", flexShrink:0, marginTop:2 }}>{li+1}</div>
                                                <div style={{ flex:1 }}>
                                                    <div style={{ fontWeight:600, marginBottom:3 }}>{loc.name}</div>
                                                    <div style={{ fontSize:12, color:"rgba(62,39,35,0.6)", marginBottom:6 }}>{loc.description}</div>
                                                    <div style={{ display:"flex", gap:12, fontSize:11, color:"rgba(62,39,35,0.5)" }}>
                                                        <span>🕐 {loc.visit_duration_hours}h</span>
                                                        <span style={{ color:"#8C3322", fontWeight:600 }}>{loc.entry_fee_usd>0 ? `💵 $${loc.entry_fee_usd}` : "💚 Free"}</span>
                                                        {loc.best_time && <span>⏰ Best: {loc.best_time}</span>}
                                                    </div>
                                                    {loc.tags?.length > 0 && (
                                                        <div style={{ marginTop:8, display:"flex", gap:5, flexWrap:"wrap" }}>
                                                            {loc.tags.slice(0,3).map(t => (
                                                                <span key={t} style={{ background:"#F9F6F0", borderRadius:4, padding:"2px 7px", fontSize:10, color:"#8C3322", border:"1px solid #E8D5BC" }}>{t}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        {/* Hotel suggestion for this day */}
                                        {hotel_suggestions?.[day.day_number-1]?.hotel && (
                                            <div style={{ marginTop:14, background:"rgba(212,163,115,0.1)", border:"1px solid #D4A373", borderRadius:10, padding:"12px 14px" }}>
                                                <div style={{ fontSize:10, fontWeight:700, color:"rgba(140,51,34,0.7)", marginBottom:6 }}>🏨 SUGGESTED STAY</div>
                                                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                                                    <div>
                                                        <div style={{ fontWeight:600, fontSize:13 }}>{hotel_suggestions[day.day_number-1].hotel.name}</div>
                                                        <div style={{ fontSize:11, color:"rgba(62,39,35,0.55)" }}>{hotel_suggestions[day.day_number-1].hotel.type} · ⭐ {hotel_suggestions[day.day_number-1].hotel.rating}</div>
                                                    </div>
                                                    <div style={{ textAlign:"right" }}>
                                                        <div style={{ fontWeight:700, color:"#8C3322", fontSize:14 }}>${hotel_suggestions[day.day_number-1].hotel.price_per_night}</div>
                                                        <div style={{ fontSize:10, color:"rgba(62,39,35,0.4)" }}>per night</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ── Sidebar ───────────────────────────────────────────── */}
                <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

                    {/* Stats */}
                    <div style={{ background:"#FFFFFF", border:"1px solid #E8D5BC", borderRadius:12, padding:20, color:"#3E2723", boxShadow:"0 2px 8px rgba(62,39,35,0.04)" }}>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                            {[
                                { v: n_days,                                            l: "Days" },
                                { v: result.total_locations,                            l: "Locations" },
                                { v: `${Math.round(total_distance_km)} km`,             l: "Total Route" },
                                { v: `${Math.round(route_summary?.avg_daily_distance_km||0)} km`, l: "Avg/Day" },
                            ].map(({ v, l }) => (
                                <div key={l} style={{ background:"#F9F6F0", border:"1px solid #E8D5BC", borderRadius:8, padding:"12px 8px", textAlign:"center" }}>
                                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:"#8C3322" }}>{v}</div>
                                    <div style={{ fontSize:10, color:"rgba(62,39,35,0.55)", marginTop:2 }}>{l}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Budget breakdown */}
                    {budget_breakdown && (
                        <div style={{ background:"#FFFFFF", border:"1px solid #E8D5BC", borderRadius:12, padding:20, color:"#3E2723", boxShadow:"0 2px 8px rgba(62,39,35,0.04)" }}>
                            <div style={{ fontWeight:700, marginBottom:14, fontSize:13 }}>💰 Budget Breakdown</div>
                            {[
                                ["🏨 Accommodation", budget_breakdown.accommodation_usd],
                                ["🎟️ Entry Fees",    budget_breakdown.entry_fees_usd],
                                ["🍽️ Food (est.)",   budget_breakdown.food_estimate_usd],
                                ["🚗 Transport",     budget_breakdown.transport_estimate_usd],
                            ].map(([label, val]) => (
                                <div key={label} style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, marginBottom:8, color:"rgba(62,39,35,0.7)" }}>
                                    <span>{label}</span>
                                    <strong style={{ color:"#3E2723" }}>${val}</strong>
                                </div>
                            ))}
                            <div style={{ height:6, background:"#F9F6F0", border:"1px solid #E8D5BC", borderRadius:3, margin:"12px 0 8px", overflow:"hidden", position:"relative" }}>
                                <div style={{ height:"100%", borderRadius:3, background: budget_breakdown.within_budget ? "rgba(74,93,35,0.8)" : "#8C3322", width:`${Math.min((budget_breakdown.total_estimate_usd/budget_breakdown.budget_provided_usd)*100,100)}%` }} />
                            </div>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12 }}>
                                <strong style={{ color:"#8C3322" }}>${Math.round(budget_breakdown.total_estimate_usd)} est.</strong>
                                <span style={{ color: budget_breakdown.within_budget ? "#4A5D23" : "#8C3322", fontWeight:600 }}>
                                    {budget_breakdown.within_budget ? "✓ Within budget" : "⚠ Over budget"}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Saved to My Trips notice */}
                    {result.saved_itinerary_id && (
                        <div style={{ background:"rgba(74,93,35,0.1)", border:"1px solid rgba(74,93,35,0.3)", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#4A5D23", textAlign:"center" }}>
                            ✅ Saved to My Trips (ID #{result.saved_itinerary_id})
                        </div>
                    )}

                    {/* ── Your saved hotel from selected_hotels table ──── */}
                    <SavedHotelCard hotel={savedHotel} />

                    {/* ── Your saved guide from selected_guides table ───── */}
                    <SavedGuideCard guide={savedGuide} />

                    {/* ── Inline feedback form ──────────────────────────── */}
                    {result.saved_itinerary_id && (
                        <FeedbackForm itineraryId={result.saved_itinerary_id} />
                    )}

                </div>
                {/* end sidebar */}

            </div>
            {/* end main grid */}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ItineraryPlanner() {
    const [step,        setStep]        = useState(0);
    const [plannerData, setPlannerData] = useState(null);
    const [result,      setResult]      = useState(null);
    const [loading,     setLoading]     = useState(false);
    const [initLoading, setInitLoading] = useState(true);
    const [error,       setError]       = useState("");

    // Load user's saved locations on mount (no second location picking needed)
    useEffect(() => {
        API.get("/itineraries/planner-data")
            .then(res => setPlannerData(res.data))
            .catch(e  => setError(e?.response?.data?.detail || "Could not load your saved locations."))
            .finally(()=> setInitLoading(false));
    }, []);

    const handleGenerate = async ({ days, budget, startingPoint }) => {
        setLoading(true); setError("");
        try {
            const res = await API.post("/itineraries/optimize", {
                n_days:         days,
                budget_usd:     budget,
                starting_point: startingPoint,
            });
            setResult(res.data);
            setStep(1);
        } catch (e) {
            setError(e?.response?.data?.error || "Optimization failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const resetAll = () => { setStep(0); setResult(null); setError(""); };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
                .ip-root { min-height:100vh; background:transparent; font-family:'DM Sans',sans-serif; color: #3E2723; }
                .ip-hero { position:relative; background:#8C3322; padding:24px 32px; border-bottom:1px solid rgba(255,255,255,0.1); overflow:hidden; }
                .ip-hero-inner { position:relative; z-index:2; max-width:960px; margin:0 auto; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; }
                .ip-content { max-width:960px; margin:0 auto; padding:36px 24px 80px; }
                .ip-error { background:rgba(140,51,34,0.1); border:1px solid rgba(140,51,34,0.3); border-radius:10px; padding:12px 16px; font-size:13px; color:#8C3322; margin-bottom:24px; }
                @media(max-width:700px){
                    .ip-content{padding:24px 16px 60px;}
                    .ip-hero{padding:20px 16px;}
                }
            `}</style>

            <Layout>

                {/* Hero with step progress */}
                <div className="ip-hero">
                    <HansaWatermark />
                    <div className="ip-hero-inner">
                        <div>
                            <p style={{ fontSize:10, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", color:"rgba(255,255,255,0.6)", marginBottom:6 }}>VibeLanka</p>
                            <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:500, color:"#fff" }}>Itinerary Planner</h1>
                        </div>

                        {/* Step indicators */}
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            {STEPS.map((label, i) => (
                                <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
                                    <div style={{ width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:11, flexShrink:0, background: step>i ? "#4A5D23" : step===i ? "#D4A373" : "rgba(255,255,255,0.15)", color: step>i ? "#fff" : step===i ? "#fff" : "rgba(255,255,255,0.6)" }}>
                                        {step > i ? "✓" : i+1}
                                    </div>
                                    <span style={{ fontSize:12, fontWeight:500, color: step===i ? "#D4A373" : "rgba(255,255,255,0.5)", whiteSpace:"nowrap" }}>{label}</span>
                                    {i < STEPS.length-1 && <div style={{ width:24, height:1, background:"rgba(255,255,255,0.2)" }} />}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="ip-content">
                    {error && <div className="ip-error">⚠️ {error}</div>}

                    {/* Loading initial data */}
                    {initLoading && (
                        <div style={{ textAlign:"center", padding:80, color:"rgba(26,46,43,0.5)" }}>
                            <div style={{ fontSize:36, marginBottom:12 }}>⏳</div>
                            <p>Loading your saved locations…</p>
                        </div>
                    )}

                    {/* Generating route */}
                    {!initLoading && loading && (
                        <div style={{ textAlign:"center", padding:80, color:"rgba(26,46,43,0.5)" }}>
                            <div style={{ fontSize:36, marginBottom:12 }}>🗺️</div>
                            <p style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:"#1a2e2b", marginBottom:8 }}>Optimising your route…</p>
                            <p>Running K-Means clustering + TSP optimisation</p>
                        </div>
                    )}

                    {/* Step 0: Settings */}
                    {!initLoading && !loading && step===0 && plannerData && (
                        <TripSettings plannerData={plannerData} onSubmit={handleGenerate} />
                    )}

                    {/* Step 1: Result */}
                    {!initLoading && !loading && step===1 && result && (
                        <ItineraryResult
                            result={result}
                            onBack={() => setStep(0)}
                            onNewTrip={resetAll}
                        />
                    )}
                </div>
                <NextStepBanner
                    step={4}
                    done={!!result?.saved_itinerary_id}
                    nextPath="/itineraries"
                    nextLabel="View My Trips →"
                    nextSub="See your full itinerary with map"
                    locked={!result?.saved_itinerary_id}
                    lockedMsg="Generate your itinerary first"
                />
            </Layout>
        </>
    );
}