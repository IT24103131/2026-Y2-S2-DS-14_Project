import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import API from "../services/api";
import Navbar from "../components/Navbar";

// ─────────────────────────────────────────────────────────────────────────────
// MyItineraries.jsx — My Trips page
//
// Shows ALL itineraries — both AI-generated and optimized (member 5).
// For optimized trips: renders the Leaflet map inline, budget breakdown,
//   hotel suggestions from the plan, and the user's confirmed hotel + guide.
// For AI trips: shows destinations, day plan, route — same as before.
// Feedback (star + comment) visible and fully editable for all trips.
// ─────────────────────────────────────────────────────────────────────────────

// Fix Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const DAY_COLORS = ["#38bdf8","#818cf8","#34d399","#fb923c","#f87171","#a78bfa","#facc15","#60a5fa","#4ade80","#fb7185"];

const VIBES = {
    "adventurous explorer": { gradient:"linear-gradient(135deg,#c0522a,#e07840)", glow:"rgba(192,82,42,0.3)", label:"Adventurous Explorer" },
    "balanced traveler":    { gradient:"linear-gradient(135deg,#3d7068,#4d8a82)", glow:"rgba(77,138,130,0.3)", label:"Balanced Traveler" },
    "friendly cultural":    { gradient:"linear-gradient(135deg,#5a4a82,#7b6aaa)", glow:"rgba(90,74,130,0.3)", label:"Friendly Cultural" },
    "organized sightseer":  { gradient:"linear-gradient(135deg,#2d4a47,#4d8a82)", glow:"rgba(45,74,71,0.3)", label:"Organized Sightseer" },
    "calm & relaxed":       { gradient:"linear-gradient(135deg,#2a6a60,#3d9488)", glow:"rgba(42,106,96,0.3)", label:"Calm & Relaxed" },
    default:                { gradient:"linear-gradient(135deg,#2d4a47,#4d8a82)", glow:"rgba(77,138,130,0.3)", label:"Explorer" },
};
const TRIP_ICONS = { beach:"🏖️", cultural:"🏛️", adventure:"🧗", peaceful:"🌿", budget:"🎒", unknown:"🗺️" };
const getVibe    = (v = "") => VIBES[v.toLowerCase()] || VIBES.default;
const getIcon    = (t = "") => TRIP_ICONS[t.toLowerCase()] || "🗺️";
const fmt        = (d) => d ? new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) : "—";

// ── Leaflet helpers ───────────────────────────────────────────────────────────
function makeIcon(n, color) {
    return L.divIcon({
        html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;border:2px solid rgba(255,255,255,0.6);box-shadow:0 2px 6px rgba(0,0,0,0.4)">${n}</div>`,
        className:"", iconSize:[24,24], iconAnchor:[12,12],
    });
}

function FitBounds({ positions }) {
    const map = useMap();
    useEffect(() => {
        if (positions.length > 0) map.fitBounds(positions, { padding:[24,24] });
    }, [positions, map]);
    return null;
}

// ── Inline map for optimized trips ────────────────────────────────────────────
function OptimizedMap({ clusters }) {
    const allPositions = clusters.flatMap(day => day.locations.map(l => [l.lat, l.lng]));
    if (allPositions.length === 0) return null;
    return (
        <div style={{ borderRadius:10, overflow:"hidden", border:"1px solid rgba(255,255,255,0.15)", marginBottom:16 }}>
            <MapContainer center={[7.8731, 80.7718]} zoom={7} style={{ height:300, width:"100%" }} scrollWheelZoom={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://carto.com/">CARTO</a>' />
                <FitBounds positions={allPositions} />
                {clusters.map((day, di) => {
                    const color = DAY_COLORS[di % DAY_COLORS.length];
                    const pts   = day.locations.map(l => [l.lat, l.lng]);
                    return (
                        <div key={day.day_number}>
                            {pts.length > 1 && <Polyline positions={pts} color={color} weight={2.5} opacity={0.75} dashArray="6,4" />}
                            {day.locations.map((loc, li) => (
                                <Marker key={`${day.day_number}-${li}`} position={[loc.lat, loc.lng]} icon={makeIcon(li+1, color)}>
                                    <Popup>
                                        <div style={{ fontFamily:"'DM Sans',sans-serif", minWidth:140 }}>
                                            <strong>{loc.name}</strong>
                                            <div style={{ fontSize:11, color:"#64748b", margin:"3px 0" }}>Day {day.day_number} · Stop {li+1}</div>
                                            <div style={{ fontSize:11 }}>🕐 {loc.visit_duration_hours}h &nbsp; {loc.entry_fee_usd > 0 ? `💵 $${loc.entry_fee_usd}` : "💚 Free"}</div>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </div>
                    );
                })}
            </MapContainer>
        </div>
    );
}

// ── Stars (readonly + interactive) ───────────────────────────────────────────
function Stars({ value, onChange, readonly = false }) {
    const [hov, setHov] = useState(0);
    return (
        <div style={{ display:"flex", gap:5, marginBottom: readonly ? 4 : 14 }}>
            {[1,2,3,4,5].map(n => (
                <button key={n} type="button"
                        onMouseEnter={() => !readonly && setHov(n)}
                        onMouseLeave={() => !readonly && setHov(0)}
                        onClick={() => !readonly && onChange && onChange(n)}
                        disabled={readonly}
                        style={{ background:"none", border:"none", cursor:readonly?"default":"pointer", padding:0 }}>
                    <svg width={readonly?18:30} height={readonly?18:30} viewBox="0 0 24 24"
                         style={{ fill:n<=(hov||value)?"#ffcc00":"rgba(255,255,255,0.2)", filter:n<=(hov||value)&&!readonly?"drop-shadow(0 0 4px rgba(255,204,0,0.5))":"none", transition:"fill 0.15s" }}>
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                </button>
            ))}
        </div>
    );
}

// ── Modals ────────────────────────────────────────────────────────────────────
function ModalShell({ title, eyebrow, gradient, onClose, children }) {
    return (
        <div style={{ position:"fixed", inset:0, zIndex:999, background:"rgba(26,46,43,0.6)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
             onClick={e => e.target===e.currentTarget && onClose()}>
            <div style={{ width:"100%", maxWidth:440, background:"#4d8a82", border:"1px solid rgba(255,255,255,0.18)", borderRadius:16, overflow:"hidden", boxShadow:"0 8px 48px rgba(29,58,54,0.35)", color:"#fff" }}>
                <div style={{ height:3, background:gradient }} />
                <div style={{ padding:"24px 28px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                        <div>
                            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", color:"rgba(255,255,255,0.45)", marginBottom:4 }}>{eyebrow}</div>
                            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:"#fff" }}>{title}</div>
                        </div>
                        <button onClick={onClose} style={{ width:28, height:28, borderRadius:7, background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"rgba(255,255,255,0.6)" }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}

function FeedbackModal({ it, close }) {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const v = getVibe(it.final_vibe || "");

    const submit = async () => {
        setLoading(true);
        try {
            await API.post("/feedback", { itinerary_id: it.itinerary_id, rating: Number(rating), comment });
            setDone(true);
            setTimeout(close, 1800);
        } catch { alert("Failed to submit feedback."); setLoading(false); }
    };

    if (done) return (
        <ModalShell eyebrow="Thank you" title="Review submitted!" gradient={v.gradient} onClose={close}>
            <div style={{ textAlign:"center", padding:"16px 0" }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🎉</div>
                <p style={{ fontSize:13.5, color:"rgba(255,255,255,0.6)" }}>Your feedback helps us improve future trips.</p>
            </div>
        </ModalShell>
    );

    return (
        <ModalShell eyebrow="Leave a Review" title="Rate this Trip" gradient={v.gradient} onClose={close}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(255,255,255,0.5)", marginBottom:10 }}>Your Rating</label>
            <Stars value={rating} onChange={setRating} />
            <label style={{ display:"block", fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(255,255,255,0.5)", marginBottom:10 }}>Comment <span style={{ fontWeight:400, textTransform:"none", color:"rgba(255,255,255,0.3)" }}>(optional)</span></label>
            <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="What did you love? Any suggestions?"
                      style={{ width:"100%", background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:10, padding:"11px 14px", color:"#fff", fontFamily:"'DM Sans',sans-serif", fontSize:13.5, outline:"none", resize:"vertical", minHeight:90, marginBottom:16, boxSizing:"border-box" }} />
            <div style={{ display:"flex", gap:10 }}>
                <button onClick={close} style={{ flex:1, padding:12, borderRadius:10, background:"transparent", border:"1px solid rgba(255,255,255,0.2)", fontFamily:"'DM Sans',sans-serif", fontSize:13.5, color:"rgba(255,255,255,0.6)", cursor:"pointer" }}>Cancel</button>
                <button onClick={submit} disabled={loading} style={{ flex:2, padding:12, borderRadius:10, border:"none", background:v.gradient, fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:13.5, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
                    {loading ? <span style={{ width:14, height:14, border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.7s linear infinite", display:"inline-block" }} /> : "Submit Review"}
                </button>
            </div>
        </ModalShell>
    );
}

function EditFeedbackModal({ fb, it, close, onSaved }) {
    const [rating, setRating] = useState(fb.rating);
    const [comment, setComment] = useState(fb.comment || "");
    const [loading, setLoading] = useState(false);
    const v = getVibe(it?.final_vibe || "");
    const save = async () => {
        setLoading(true);
        try { await API.put(`/feedback/${fb.feedback_id}`, { rating: Number(rating), comment }); onSaved(); close(); }
        catch { alert("Failed to update."); setLoading(false); }
    };
    return (
        <ModalShell eyebrow="Edit Review" title="Update your Rating" gradient={v.gradient} onClose={close}>
            <Stars value={rating} onChange={setRating} />
            <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="What did you love?"
                      style={{ width:"100%", background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:10, padding:"11px 14px", color:"#fff", fontFamily:"'DM Sans',sans-serif", fontSize:13.5, outline:"none", resize:"vertical", minHeight:80, marginBottom:16, boxSizing:"border-box" }} />
            <div style={{ display:"flex", gap:10 }}>
                <button onClick={close} style={{ flex:1, padding:12, borderRadius:10, background:"transparent", border:"1px solid rgba(255,255,255,0.2)", fontFamily:"'DM Sans',sans-serif", fontSize:13.5, color:"rgba(255,255,255,0.6)", cursor:"pointer" }}>Cancel</button>
                <button onClick={save} disabled={loading} style={{ flex:2, padding:12, borderRadius:10, border:"none", background:v.gradient, fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:13.5, color:"#fff", cursor:"pointer" }}>
                    {loading ? "Saving…" : "Save Changes"}
                </button>
            </div>
        </ModalShell>
    );
}

function DeleteFeedbackModal({ fb, close, onDeleted }) {
    const [loading, setLoading] = useState(false);
    const confirm = async () => {
        setLoading(true);
        try { await API.delete(`/feedback/${fb.feedback_id}`); onDeleted(); close(); }
        catch { alert("Failed to delete."); setLoading(false); }
    };
    return (
        <ModalShell eyebrow="Confirm" title="Remove this review?" gradient="linear-gradient(135deg,#8b1a1a,#b02020)" onClose={close}>
            <p style={{ fontSize:13.5, color:"rgba(255,255,255,0.6)", lineHeight:1.7, marginBottom:20 }}>This review will be permanently removed and the AI policy retrained.</p>
            <div style={{ display:"flex", gap:10 }}>
                <button onClick={close} style={{ flex:1, padding:12, borderRadius:10, background:"transparent", border:"1px solid rgba(255,255,255,0.2)", fontFamily:"'DM Sans',sans-serif", fontSize:13.5, color:"rgba(255,255,255,0.6)", cursor:"pointer" }}>Keep It</button>
                <button onClick={confirm} disabled={loading} style={{ flex:2, padding:12, borderRadius:10, border:"none", background:"linear-gradient(135deg,#8b1a1a,#b02020)", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:13.5, color:"#fff", cursor:"pointer" }}>
                    {loading ? "Deleting…" : "Yes, Delete"}
                </button>
            </div>
        </ModalShell>
    );
}

function EditModal({ it, close, onSaved }) {
    const [title, setTitle] = useState(it.title);
    const [loading, setLoading] = useState(false);
    const v = getVibe(it.final_vibe || "");
    const save = async () => {
        if (!title.trim()) return;
        setLoading(true);
        try { await API.put(`/itineraries/${it.itinerary_id}`, { title: title.trim() }); onSaved(it.itinerary_id, title.trim()); close(); }
        catch { alert("Failed to update."); setLoading(false); }
    };
    return (
        <ModalShell eyebrow="Edit Trip" title="Rename Itinerary" gradient={v.gradient} onClose={close}>
            <input autoFocus value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save()}
                   style={{ width:"100%", background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:10, padding:"12px 16px", color:"#fff", fontFamily:"'DM Sans',sans-serif", fontSize:14, outline:"none", marginBottom:16, boxSizing:"border-box" }} />
            <div style={{ display:"flex", gap:10 }}>
                <button onClick={close} style={{ flex:1, padding:12, borderRadius:10, background:"transparent", border:"1px solid rgba(255,255,255,0.2)", fontFamily:"'DM Sans',sans-serif", fontSize:13.5, color:"rgba(255,255,255,0.6)", cursor:"pointer" }}>Cancel</button>
                <button onClick={save} disabled={loading||!title.trim()} style={{ flex:2, padding:12, borderRadius:10, border:"none", background:v.gradient, fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:13.5, color:"#fff", cursor:"pointer" }}>
                    {loading ? "Saving…" : "Save Changes"}
                </button>
            </div>
        </ModalShell>
    );
}

function DeleteModal({ it, close, onDeleted }) {
    const [loading, setLoading] = useState(false);
    const confirm = async () => {
        setLoading(true);
        try { await API.delete(`/itineraries/${it.itinerary_id}`); onDeleted(it.itinerary_id); close(); }
        catch { alert("Failed to delete."); setLoading(false); }
    };
    return (
        <ModalShell eyebrow="Confirm Delete" title="Delete this trip?" gradient="linear-gradient(135deg,#8b1a1a,#b02020)" onClose={close}>
            <p style={{ fontSize:13.5, color:"rgba(255,255,255,0.6)", lineHeight:1.7, marginBottom:20 }}>
                <strong style={{ color:"#fff" }}>"{it.title}"</strong> will be permanently removed.
            </p>
            <div style={{ display:"flex", gap:10 }}>
                <button onClick={close} style={{ flex:1, padding:12, borderRadius:10, background:"transparent", border:"1px solid rgba(255,255,255,0.2)", fontFamily:"'DM Sans',sans-serif", fontSize:13.5, color:"rgba(255,255,255,0.6)", cursor:"pointer" }}>Keep It</button>
                <button onClick={confirm} disabled={loading} style={{ flex:2, padding:12, borderRadius:10, border:"none", background:"linear-gradient(135deg,#8b1a1a,#b02020)", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:13.5, color:"#fff", cursor:"pointer" }}>
                    {loading ? "Deleting…" : "Yes, Delete"}
                </button>
            </div>
        </ModalShell>
    );
}

// ── Feedback row (view + edit + delete) ──────────────────────────────────────
function FeedbackRow({ fb, it, onRefresh }) {
    const [editFb, setEditFb] = useState(null);
    const [deleteFb, setDeleteFb] = useState(null);
    return (
        <>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"10px 14px", borderRadius:10, background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", marginBottom:8 }}>
                <div style={{ flex:1 }}>
                    <Stars value={fb.rating} readonly />
                    <p style={{ fontSize:13, color:"rgba(255,255,255,0.65)", margin:"2px 0 4px", lineHeight:1.6 }}>
                        {fb.comment || <em style={{ color:"rgba(255,255,255,0.3)" }}>No comment</em>}
                    </p>
                    <p style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>{fmt(fb.created_at)}</p>
                </div>
                <div style={{ display:"flex", gap:6, marginLeft:10, flexShrink:0 }}>
                    <button onClick={() => setEditFb(fb)} style={{ width:28, height:28, borderRadius:7, background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.18)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"rgba(255,255,255,0.7)", fontSize:12 }}>✏</button>
                    <button onClick={() => setDeleteFb(fb)} style={{ width:28, height:28, borderRadius:7, background:"rgba(139,26,26,0.2)", border:"1px solid rgba(139,26,26,0.35)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#ffb4b4", fontSize:12 }}>🗑</button>
                </div>
            </div>
            {editFb   && <EditFeedbackModal   fb={editFb}   it={it} close={() => setEditFb(null)}   onSaved={onRefresh} />}
            {deleteFb && <DeleteFeedbackModal fb={deleteFb}         close={() => setDeleteFb(null)} onDeleted={onRefresh} />}
        </>
    );
}

// ── Section label ─────────────────────────────────────────────────────────────
const SL = ({ children }) => (
    <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", color:"rgba(255,255,255,0.4)", marginBottom:10 }}>{children}</div>
);

// ── Trip card ─────────────────────────────────────────────────────────────────
function TripCard({ it, feedbacks, onRate, onEdit, onDelete, onRefreshFeedbacks }) {
    const [open, setOpen]             = useState(false);
    const [showReviews, setShowReviews] = useState(false);

    const vibe   = (it.final_vibe || "").toLowerCase();
    const v      = getVibe(vibe);
    const icon   = getIcon(it.itinerary_type || "");
    const fbs    = feedbacks || [];
    const avgRating = fbs.length > 0 ? (fbs.reduce((s,f)=>s+f.rating,0)/fbs.length).toFixed(1) : null;

    // Detect which type of itinerary this is
    const isOptimized = !!it.optimizer_plan;
    const plan = it.optimizer_plan || {};
    const clusters = plan.ordered_clusters || [];
    const budget   = plan.budget_breakdown || null;
    const hotelSuggestions = plan.hotel_suggestions || [];

    // For AI-generated trips
    const dests = it.destinations || [];
    const days  = it.days || [];
    const route = it.optimized_route || [];
    const numDays = isOptimized ? (plan.n_days || clusters.length) : (days.length || Math.max(1, dests.length));

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');
                @keyframes spin{to{transform:rotate(360deg)}}
                @keyframes expandIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
                .trip-card{background:#4d8a82;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.15);box-shadow:0 4px 20px rgba(29,58,54,0.15);transition:box-shadow 0.25s,transform 0.2s;font-family:'DM Sans',sans-serif;color:#fff;}
                .trip-card:hover{box-shadow:0 10px 36px rgba(29,58,54,0.25);transform:translateY(-2px);}
                .trip-expanded{border-top:1px solid rgba(255,255,255,0.12);padding:20px;animation:expandIn 0.25s cubic-bezier(0.16,1,0.3,1) both;background:rgba(45,74,71,0.3);}
            `}</style>

            <div className="trip-card">
                <div style={{ height:4, background:v.gradient }} />

                {/* Card header */}
                <div style={{ padding:"18px 20px 14px", display:"flex", gap:14, alignItems:"flex-start" }}>
                    <div style={{ width:50, height:50, borderRadius:13, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.18)" }}>
                        {isOptimized ? "🗺️" : icon}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:7, marginBottom:4 }}>
                            <span style={{ display:"inline-block", fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", padding:"2px 9px", borderRadius:20, background:"rgba(255,255,255,0.15)", color:"rgba(255,255,255,0.85)" }}>
                                {isOptimized ? "optimized route" : (it.itinerary_type || "trip")}
                            </span>
                            <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{v.label}</span>
                            <span style={{ fontSize:11, color:"rgba(255,255,255,0.2)" }}>·</span>
                            <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{numDays} day{numDays!==1?"s":""}</span>
                            {avgRating && (
                                <>
                                    <span style={{ fontSize:11, color:"rgba(255,255,255,0.2)" }}>·</span>
                                    <span style={{ fontSize:11, color:"rgba(255,255,255,0.85)", fontWeight:600 }}>★ {avgRating} <span style={{ color:"rgba(255,255,255,0.4)", fontWeight:400 }}>({fbs.length})</span></span>
                                </>
                            )}
                        </div>
                        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, color:"#fff", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{it.title}</div>
                        <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.4)", marginTop:2 }}>Generated {fmt(it.created_at)}</div>
                    </div>
                </div>

                {/* Action row */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 20px 14px", gap:10 }}>
                    <button onClick={() => setOpen(o => !o)}
                            style={{ fontSize:12.5, fontWeight:600, background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", alignItems:"center", gap:5, color:"rgba(255,255,255,0.75)", fontFamily:"'DM Sans',sans-serif" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            {open ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
                        </svg>
                        {open ? "Hide plan" : "View full plan"}
                    </button>
                    <div style={{ display:"flex", gap:6 }}>
                        <button onClick={() => onRate(it)} title="Rate" style={{ width:30, height:30, borderRadius:8, border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"rgba(255,255,255,0.85)", fontSize:13 }}>★</button>
                        <button onClick={() => onEdit(it)} title="Edit" style={{ width:30, height:30, borderRadius:8, border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"rgba(255,255,255,0.65)", fontSize:12 }}>✏</button>
                        <button onClick={() => onDelete(it)} title="Delete" style={{ width:30, height:30, borderRadius:8, border:"1px solid rgba(139,26,26,0.4)", background:"rgba(139,26,26,0.2)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#ffb4b4", fontSize:12 }}>🗑</button>
                    </div>
                </div>

                {/* Expanded plan */}
                {open && (
                    <div className="trip-expanded">

                        {/* ── OPTIMIZED TRIP ───────────────────────────────── */}
                        {isOptimized && clusters.length > 0 && (
                            <>
                                {/* Map — visible forever, stored in itinerary_plan JSON */}
                                <SL>🗺 Route Map</SL>
                                <OptimizedMap clusters={clusters} />

                                {/* Stats row */}
                                <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16 }}>
                                    {[
                                        { v: plan.n_days, l:"Days" },
                                        { v: plan.total_locations, l:"Locations" },
                                        { v: `${Math.round(plan.total_distance_km||0)} km`, l:"Total Route" },
                                        { v: `${Math.round(plan.route_summary?.avg_daily_distance_km||0)} km`, l:"Avg/Day" },
                                    ].map(({v:val,l}) => (
                                        <div key={l} style={{ background:"rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 14px", textAlign:"center", flex:"1 1 80px" }}>
                                            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:15, color:"#ffcc00" }}>{val}</div>
                                            <div style={{ fontSize:9.5, color:"rgba(255,255,255,0.45)", marginTop:2 }}>{l}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Day-by-day */}
                                <SL>🗓 Day-by-Day Plan</SL>
                                {clusters.map(day => (
                                    <div key={day.day_number} style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, padding:"12px 14px", marginBottom:10 }}>
                                        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:"#fff", marginBottom:8 }}>Day {day.day_number}</div>
                                        {day.locations.map((loc, li) => (
                                            <div key={li} style={{ display:"flex", gap:12, padding:"7px 0", borderBottom: li<day.locations.length-1 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                                                <div style={{ width:20, height:20, borderRadius:"50%", background:DAY_COLORS[(day.day_number-1)%DAY_COLORS.length], display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:10, flexShrink:0 }}>{li+1}</div>
                                                <div>
                                                    <div style={{ fontWeight:600, fontSize:13 }}>{loc.name}</div>
                                                    <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", marginTop:2 }}>🕐 {loc.visit_duration_hours}h · {loc.entry_fee_usd>0?`💵 $${loc.entry_fee_usd}`:"💚 Free"}{loc.best_time?` · ⏰ ${loc.best_time}`:""}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}

                                {/* Budget breakdown */}
                                {budget && (
                                    <div style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, padding:"14px 16px", marginBottom:16 }}>
                                        <SL>💰 Budget Breakdown</SL>
                                        {[
                                            ["🏨 Accommodation", budget.accommodation_usd],
                                            ["🎟️ Entry Fees",    budget.entry_fees_usd],
                                            ["🍽️ Food (est.)",   budget.food_estimate_usd],
                                            ["🚗 Transport",     budget.transport_estimate_usd],
                                        ].map(([label, val]) => (
                                            <div key={label} style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, marginBottom:7, color:"rgba(255,255,255,0.65)" }}>
                                                <span>{label}</span><strong style={{ color:"#fff" }}>${val}</strong>
                                            </div>
                                        ))}
                                        <div style={{ height:5, background:"rgba(255,255,255,0.15)", borderRadius:3, margin:"10px 0 7px", overflow:"hidden" }}>
                                            <div style={{ height:"100%", borderRadius:3, background:budget.within_budget?"#34d399":"#f87171", width:`${Math.min((budget.total_estimate_usd/budget.budget_provided_usd)*100,100)}%` }} />
                                        </div>
                                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12 }}>
                                            <strong style={{ color:"#ffcc00" }}>${Math.round(budget.total_estimate_usd)} est.</strong>
                                            <span style={{ color:budget.within_budget?"#34d399":"#f87171", fontWeight:600 }}>
                                                {budget.within_budget ? "✓ Within budget" : "⚠ Over budget"}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Hotel suggestion from plan */}
                                {hotelSuggestions.length > 0 && (
                                    <div style={{ marginBottom:16 }}>
                                        <SL>🏨 Suggested Hotels (from Route Plan)</SL>
                                        {hotelSuggestions.map((hs, i) => hs.hotel && (
                                            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"10px 14px", marginBottom:8 }}>
                                                <div>
                                                    <div style={{ fontWeight:600, fontSize:13 }}>{hs.hotel.name}</div>
                                                    <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", marginTop:2 }}>Day {hs.day_number} · {hs.nearest_area} · ⭐ {hs.hotel.rating}</div>
                                                </div>
                                                <div style={{ fontWeight:700, color:"#ffcc00", fontSize:14 }}>${hs.hotel.price_per_night}<span style={{ fontSize:10, color:"rgba(255,255,255,0.4)", fontWeight:400 }}>/night</span></div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── AI-GENERATED TRIP ────────────────────────────── */}
                        {!isOptimized && (
                            <>
                                {dests.length > 0 && (
                                    <div style={{ marginBottom:16 }}>
                                        <SL>📍 Destinations</SL>
                                        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                                            {dests.map((d, i) => (
                                                <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.18)", borderRadius:20, padding:"5px 12px 5px 6px", fontSize:12.5, color:"#fff" }}>
                                                    <span style={{ width:19, height:19, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9.5, fontWeight:700, color:"#fff", background:v.gradient }}>{i+1}</span>{d}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {it.explanation && (
                                    <div style={{ marginBottom:16 }}>
                                        <SL>💡 Why this trip</SL>
                                        <div style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, padding:"12px 14px", fontSize:13.5, color:"rgba(255,255,255,0.7)", lineHeight:1.7 }}>{it.explanation}</div>
                                    </div>
                                )}
                                {days.length > 0 && (
                                    <div style={{ marginBottom:16 }}>
                                        <SL>🗓 Day-by-Day Plan</SL>
                                        {days.map(day => (
                                            <div key={day.day_number} style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, padding:"12px 14px", marginBottom:10 }}>
                                                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:"#fff", marginBottom:8 }}>Day {day.day_number}</div>
                                                {day.activities.map((act, i) => (
                                                    <div key={i} style={{ display:"flex", gap:12, padding:"7px 0", borderBottom:i<day.activities.length-1?"1px solid rgba(255,255,255,0.07)":"none" }}>
                                                        <span style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.55)", letterSpacing:"0.05em", width:48, flexShrink:0, paddingTop:2 }}>{act.start_time}</span>
                                                        <span style={{ fontSize:13, fontWeight:500, color:"#fff" }}>{act.location}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {route.length > 0 && (
                                    <div style={{ marginBottom:16 }}>
                                        <SL>🗺 Optimized Route</SL>
                                        <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
                                            {route.map((loc, i) => (
                                                <span key={i} style={{ display:"flex", alignItems:"center", gap:5 }}>
                                                    <span style={{ background:"rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.85)", borderRadius:20, padding:"3px 10px", fontSize:12, border:"1px solid rgba(255,255,255,0.15)" }}>{loc}</span>
                                                    {i<route.length-1 && <span style={{ color:"rgba(255,255,255,0.3)", fontSize:12 }}>→</span>}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── SAVED HOTEL (both trip types) ──────────────── */}
                        {it.saved_hotel && (
                            <div style={{ background:"rgba(77,138,130,0.25)", border:"1px solid rgba(255,204,0,0.2)", borderRadius:10, padding:"12px 14px", marginBottom:16 }}>
                                <SL>🏨 Your Booked Hotel</SL>
                                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
                                    <div>
                                        <div style={{ fontWeight:600, fontSize:14 }}>{it.saved_hotel.name}</div>
                                        <div style={{ fontSize:12, color:"rgba(255,255,255,0.55)", marginTop:3 }}>📍 {it.saved_hotel.location}</div>
                                        {(it.saved_hotel.check_in || it.saved_hotel.check_out) && (
                                            <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", marginTop:3 }}>
                                                {it.saved_hotel.check_in && `📅 In: ${it.saved_hotel.check_in}`}
                                                {it.saved_hotel.check_out && `  Out: ${it.saved_hotel.check_out}`}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ textAlign:"right" }}>
                                        <div style={{ fontWeight:700, color:"#ffcc00", fontSize:14 }}>LKR {Number(it.saved_hotel.total_budget).toLocaleString()}</div>
                                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>total budget</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── SAVED GUIDE (both trip types) ──────────────── */}
                        {it.saved_guide && (
                            <div style={{ background:"rgba(77,138,130,0.25)", border:"1px solid rgba(122,184,176,0.3)", borderRadius:10, padding:"12px 14px", marginBottom:16 }}>
                                <SL>🧭 Your Booked Guide</SL>
                                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
                                    <div>
                                        <div style={{ fontWeight:600, fontSize:14 }}>{it.saved_guide.name}</div>
                                        <div style={{ fontSize:12, color:"rgba(255,255,255,0.55)", marginTop:3 }}>🗣 {it.saved_guide.language} · 📍 {it.saved_guide.base_location}</div>
                                        <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", marginTop:3 }}>⭐ {it.saved_guide.rating} · LKR {Number(it.saved_guide.daily_rate).toLocaleString()}/day</div>
                                    </div>
                                    <div style={{ textAlign:"right" }}>
                                        <div style={{ fontWeight:700, color:"#ffcc00", fontSize:14 }}>LKR {Number(it.saved_guide.estimated_budget).toLocaleString()}</div>
                                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>estimated total</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── REVIEWS ────────────────────────────────────── */}
                        {fbs.length > 0 && (
                            <div style={{ marginTop:4 }}>
                                <button onClick={() => setShowReviews(r => !r)}
                                        style={{ width:"100%", marginBottom:10, padding:9, border:"1px solid rgba(255,255,255,0.18)", borderRadius:10, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:12.5, fontWeight:500, color:"rgba(255,255,255,0.6)", background:"transparent", display:"flex", alignItems:"center", justifyContent:"center", gap:6, transition:"border-color 0.2s,color 0.2s" }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        {showReviews ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
                                    </svg>
                                    {showReviews ? "Hide Reviews" : `My Reviews (${fbs.length})`}
                                </button>
                                {showReviews && (
                                    <div>
                                        <SL>⭐ Your Reviews</SL>
                                        {fbs.map(fb => <FeedbackRow key={fb.feedback_id} fb={fb} it={it} onRefresh={onRefreshFeedbacks} />)}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Stats footer + rate button */}
                        <div style={{ display:"flex", flexWrap:"wrap", gap:14, paddingTop:14, borderTop:"1px solid rgba(255,255,255,0.1)", marginTop:16, fontSize:12, color:"rgba(255,255,255,0.45)" }}>
                            <span>🗓 <strong style={{ color:"rgba(255,255,255,0.8)" }}>{numDays}</strong> days</span>
                            <span>📌 <strong style={{ color:"rgba(255,255,255,0.8)" }}>{isOptimized ? plan.total_locations : dests.length}</strong> locations</span>
                            <span>🎭 <strong style={{ color:"rgba(255,255,255,0.8)", textTransform:"capitalize" }}>{vibe || "explorer"}</strong></span>
                            <span style={{ marginLeft:"auto" }}>Generated {fmt(it.created_at)}</span>
                        </div>

                        <button onClick={() => onRate(it)}
                                style={{ width:"100%", marginTop:16, padding:11, border:"none", borderRadius:10, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:13.5, fontWeight:600, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", gap:8, background:v.gradient, boxShadow:`0 4px 18px ${v.glow}`, transition:"opacity 0.2s,transform 0.15s" }}
                                onMouseEnter={e=>{e.currentTarget.style.opacity="0.88";e.currentTarget.style.transform="translateY(-1px)"}}
                                onMouseLeave={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.transform="translateY(0)"}}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffffff" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            Rate This Trip
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}

function Skeleton() {
    return (
        <div style={{ background:"#4d8a82", borderRadius:16, overflow:"hidden", border:"1px solid rgba(255,255,255,0.12)", opacity:0.5 }}>
            <style>{`@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}.shimmer{background:linear-gradient(90deg,rgba(255,255,255,0.06) 25%,rgba(255,255,255,0.12) 50%,rgba(255,255,255,0.06) 75%);background-size:400px 100%;animation:shimmer 1.4s infinite;border-radius:6px;}`}</style>
            <div style={{ height:4, background:"rgba(255,255,255,0.15)" }} />
            <div style={{ padding:"20px 20px 22px", display:"flex", gap:14 }}>
                <div className="shimmer" style={{ width:50, height:50, borderRadius:13, flexShrink:0 }} />
                <div style={{ flex:1 }}>
                    <div className="shimmer" style={{ height:10, width:"35%", marginBottom:10 }} />
                    <div className="shimmer" style={{ height:18, width:"65%", marginBottom:8 }} />
                    <div className="shimmer" style={{ height:10, width:"30%" }} />
                </div>
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MyItineraries() {
    const [list,      setList]      = useState([]);
    const [feedbacks, setFeedbacks] = useState({});
    const [loading,   setLoading]   = useState(true);
    const [rateIt,    setRateIt]    = useState(null);
    const [editIt,    setEditIt]    = useState(null);
    const [deleteIt,  setDeleteIt]  = useState(null);

    const loadFeedbacks = () =>
        API.get("/feedback").then(res => {
            const grouped = {};
            res.data.forEach(fb => {
                if (!grouped[fb.itinerary_id]) grouped[fb.itinerary_id] = [];
                grouped[fb.itinerary_id].push(fb);
            });
            setFeedbacks(grouped);
        }).catch(() => {});

    useEffect(() => {
        Promise.all([
            API.get("/itineraries").then(r => setList(r.data)),
            loadFeedbacks(),
        ]).catch(() => alert("Could not load your itineraries."))
            .finally(() => setLoading(false));
    }, []);

    const handleSaved   = (id, title) => setList(p => p.map(it => it.itinerary_id === id ? { ...it, title } : it));
    const handleDeleted = (id)        => setList(p => p.filter(it => it.itinerary_id !== id));

    const tripCount      = list.length;
    const optimizedCount = list.filter(it => it.optimizer_plan).length;
    const aiCount        = tripCount - optimizedCount;

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');
                .it-page{min-height:100vh;background:#e8f0ef;font-family:'DM Sans',sans-serif;}
                .it-hero{background:#2d4a47;border-bottom:1px solid rgba(255,255,255,0.08);padding:44px 32px 36px;}
                .it-content{max-width:820px;margin:0 auto;padding:36px 24px 80px;}
                .cards-list{display:flex;flex-direction:column;gap:14px;}
            `}</style>

            <div className="it-page">
                <Navbar />
                <div className="it-hero">
                    <div style={{ maxWidth:820, margin:"0 auto" }}>
                        <p style={{ fontSize:10.5, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", color:"rgba(232,240,239,0.5)", marginBottom:10 }}>VibeLanka</p>
                        <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:40, fontWeight:500, color:"#e8f0ef", marginBottom:8 }}>My Trips</h1>
                        <p style={{ fontSize:14, color:"rgba(232,240,239,0.5)", fontWeight:300 }}>
                            {loading ? "Loading your itineraries…"
                                : tripCount === 0 ? "No itineraries yet"
                                    : `${tripCount} itinerar${tripCount===1?"y":"ies"} — ${aiCount} AI-generated · ${optimizedCount} route-optimised`}
                        </p>
                    </div>
                </div>

                <div className="it-content">
                    {loading ? (
                        <div className="cards-list"><Skeleton/><Skeleton/><Skeleton/></div>
                    ) : list.length === 0 ? (
                        <div style={{ textAlign:"center", padding:72 }}>
                            <div style={{ width:80, height:80, borderRadius:20, background:"#4d8a82", border:"1px solid rgba(255,255,255,0.18)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:40, margin:"0 auto 20px" }}>🗺️</div>
                            <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:400, color:"#1a2e2b", marginBottom:8 }}>No trips yet</h3>
                            <p style={{ fontSize:14, color:"rgba(26,46,43,0.5)", maxWidth:280, margin:"0 auto", lineHeight:1.7 }}>
                                Generate your first trip from the <strong>Dashboard</strong> or plan a custom route from <strong>Plan Trip</strong>.
                            </p>
                        </div>
                    ) : (
                        <div className="cards-list">
                            {list.map(it => (
                                <TripCard
                                    key={it.itinerary_id}
                                    it={it}
                                    feedbacks={feedbacks[it.itinerary_id] || []}
                                    onRate={setRateIt}
                                    onEdit={setEditIt}
                                    onDelete={setDeleteIt}
                                    onRefreshFeedbacks={loadFeedbacks}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {rateIt   && <FeedbackModal it={rateIt}   close={() => setRateIt(null)} />}
            {editIt   && <EditModal     it={editIt}   close={() => setEditIt(null)}   onSaved={handleSaved} />}
            {deleteIt && <DeleteModal   it={deleteIt} close={() => setDeleteIt(null)} onDeleted={handleDeleted} />}
        </>
    );
}