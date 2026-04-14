import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Navbar from "../components/Navbar";
import NextStepBanner from "../components/NextStepBanner";

// ─────────────────────────────────────────────────────────────────────────────
// Hotels.jsx — Hotel recommender
//
// KEY CHANGE: total_budget is now auto-calculated as:
//   hotel.budget_per_night × quiz_result.duration (days from quiz)
// User NO LONGER enters budget manually.
// User still picks check-in and check-out dates.
// ─────────────────────────────────────────────────────────────────────────────

function formatLKR(v) {
    return `LKR ${Number(v).toLocaleString("en-LK")}`;
}

function HotelImage({ hotelId, name }) {
    return (
        <img src={`https://picsum.photos/seed/hotel${hotelId}/400/250`} alt={name}
             style={{ width:"100%", height:180, objectFit:"cover", display:"block" }} loading="lazy" />
    );
}

// ── Save Modal — auto-calculates budget, user picks dates only ────────────────
function SaveModal({ hotel, quizDays, onClose, onSaved }) {
    const [checkIn,  setCheckIn]  = useState("");
    const [checkOut, setCheckOut] = useState("");
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState("");

    // Auto-calculate: budget_per_night × quiz days
    const nights      = quizDays || 3;
    const totalBudget = Math.round((hotel.budget_per_night || 0) * nights);

    const handleSave = async () => {
        if (!checkIn || !checkOut) { setError("Please select both check-in and check-out dates."); return; }
        if (checkOut <= checkIn)   { setError("Check-out must be after check-in."); return; }
        setError("");
        setLoading(true);
        try {
            await API.post("/hotels/save", {
                hotel_id:     hotel.hotel_id,
                location:     hotel.location,
                total_budget: totalBudget,   // auto-calculated, not user input
                check_in:     checkIn,
                check_out:    checkOut,
            });
            onSaved();
            onClose();
        } catch (err) {
            setError(err?.response?.data?.detail || "Could not save hotel.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <style>{`
                .modal-overlay{position:fixed;inset:0;z-index:999;background:rgba(26,46,43,0.6);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;}
                .modal-box{width:100%;max-width:420px;background:#4d8a82;border:1px solid rgba(255,255,255,0.18);border-radius:16px;padding:32px;box-shadow:0 8px 48px rgba(29,58,54,0.35);color:#ffffff;}
                .modal-title{font-family:'Playfair Display',serif;font-size:22px;font-weight:400;color:#ffffff;margin-bottom:6px;}
                .modal-sub{font-size:13px;color:rgba(255,255,255,0.55);margin-bottom:24px;}
                .modal-label{display:block;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.55);margin-bottom:6px;}
                .modal-input{width:100%;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:11px 14px;font-family:'DM Sans',sans-serif;font-size:14px;color:#ffffff;outline:none;margin-bottom:16px;transition:border-color 0.2s,background 0.2s;caret-color:#fff;box-sizing:border-box;}
                .modal-input:focus{border-color:rgba(255,255,255,0.4);background:rgba(255,255,255,0.18);}
                .modal-input[type=date]::-webkit-calendar-picker-indicator{filter:invert(1);opacity:0.6;cursor:pointer;}
                .modal-calc-box{background:rgba(255,204,0,0.1);border:1px solid rgba(255,204,0,0.25);border-radius:10px;padding:14px 16px;margin-bottom:20px;}
                .modal-calc-label{font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-bottom:6px;}
                .modal-calc-formula{font-size:12.5px;color:rgba(255,255,255,0.6);margin-bottom:4px;}
                .modal-calc-total{font-family:'Playfair Display',serif;font-size:20px;color:#ffcc00;}
                .modal-error{background:rgba(139,26,26,0.2);border:1px solid rgba(139,26,26,0.4);border-radius:8px;padding:10px 14px;font-size:12.5px;color:#ffb4b4;margin-bottom:16px;}
                .modal-actions{display:flex;gap:10px;}
                .modal-cancel{flex:1;padding:12px;border:1px solid rgba(255,255,255,0.2);border-radius:10px;background:transparent;font-family:'DM Sans',sans-serif;font-size:13.5px;font-weight:500;color:rgba(255,255,255,0.65);cursor:pointer;transition:border-color 0.2s;}
                .modal-cancel:hover{border-color:rgba(255,255,255,0.5);color:#fff;}
                .modal-confirm{flex:2;padding:12px;border:none;border-radius:10px;background:#ffcc00;font-family:'DM Sans',sans-serif;font-size:13.5px;font-weight:700;color:#1a2e2b;cursor:pointer;transition:background 0.2s;}
                .modal-confirm:hover:not(:disabled){background:#e6b800;}
                .modal-confirm:disabled{opacity:0.45;cursor:not-allowed;}
            `}</style>
            <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
                <div className="modal-box">
                    <div className="modal-title">Book {hotel.name}</div>
                    <div className="modal-sub">📍 {hotel.location}</div>

                    {error && <div className="modal-error">{error}</div>}

                    {/* Auto-calculated budget — read only, not editable */}
                    <div className="modal-calc-box">
                        <div className="modal-calc-label">💰 Calculated Total Budget</div>
                        <div className="modal-calc-formula">
                            {formatLKR(hotel.budget_per_night)} × {nights} night{nights !== 1 ? "s" : ""} (from your quiz)
                        </div>
                        <div className="modal-calc-total">{formatLKR(totalBudget)}</div>
                    </div>

                    <label className="modal-label">Check-in Date</label>
                    <input type="date" className="modal-input" value={checkIn}
                           min={new Date().toISOString().split("T")[0]}
                           onChange={e => setCheckIn(e.target.value)} />

                    <label className="modal-label">Check-out Date</label>
                    <input type="date" className="modal-input" value={checkOut}
                           min={checkIn || new Date().toISOString().split("T")[0]}
                           onChange={e => setCheckOut(e.target.value)} />

                    <div className="modal-actions">
                        <button className="modal-cancel" onClick={onClose}>Cancel</button>
                        <button className="modal-confirm" onClick={handleSave} disabled={loading}>
                            {loading ? "Saving…" : "❤️ Save Hotel"}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

function Skeleton() {
    return (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 }}>
            {[...Array(6)].map((_, i) => (
                <div key={i} style={{ background:"#4d8a82", borderRadius:14, overflow:"hidden", opacity:0.5 }}>
                    <div style={{ height:180, background:"rgba(255,255,255,0.15)", animation:"pulse 1.2s infinite" }} />
                    <div style={{ padding:18 }}>
                        <div style={{ height:14, width:"70%", background:"rgba(255,255,255,0.2)", borderRadius:6, marginBottom:10 }} />
                        <div style={{ height:11, width:"50%", background:"rgba(255,255,255,0.15)", borderRadius:6 }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function Hotels() {
    const navigate = useNavigate();
    const [tab,          setTab]         = useState("search");
    const [hotels,       setHotels]      = useState([]);
    const [saved,        setSaved]       = useState([]);
    const [loading,      setLoading]     = useState(false);
    const [error,        setError]       = useState("");
    const [locationsUsed,setLocsUsed]   = useState([]);
    const [saveTarget,   setSaveTarget]  = useState(null);
    const [quizDays,     setQuizDays]    = useState(3); // from quiz_result.duration
    const [hasSaved, setHasSaved] = useState(false);

    // Load quiz days on mount so hotel budget can be auto-calculated
    useEffect(() => {
        API.get("/itineraries/planner-data")
            .then(r => setQuizDays(r.data.default_days || 3))
            .catch(() => {});
        loadRecommendations();
        // Check if hotel already saved (for banner unlock)
        API.get("/hotels/saved")
            .then(res => { if (res.data?.saved_hotels?.length > 0) setHasSaved(true); })
            .catch(() => {});
    }, []);

    const loadRecommendations = () => {
        setLoading(true); setError("");
        API.get("/hotels")
            .then(res => { setHotels(res.data.hotels || []); setLocsUsed(res.data.locations_used || []); })
            .catch(err => setError(err?.response?.data?.detail || "Could not load hotels."))
            .finally(() => setLoading(false));
    };

    const loadSaved = () => {
        setLoading(true);
        API.get("/hotels/saved")
            .then(res => setSaved(res.data.saved_hotels || []))
            .catch(() => setSaved([]))
            .finally(() => setLoading(false));
    };

    // Add inside the existing useEffect (after loadRecommendations()):
    API.get("/hotels/saved")
        .then(res => { if (res.data?.saved_hotels?.length > 0) setHasSaved(true); })
        .catch(() => {});

    const handleDelete = async (rowId) => {
        if (!window.confirm("Remove this hotel?")) return;
        await API.delete(`/hotels/saved/${rowId}`).catch(() => {});
        loadSaved();
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');
                *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
                @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
                @keyframes cardIn { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)} }

                .ht-root { min-height:100vh; background:#e8f0ef; font-family:'DM Sans',sans-serif; }
                .ht-hero { background:#2d4a47; padding:40px 32px 32px; border-bottom:1px solid rgba(255,255,255,0.08); }
                .ht-hero-inner { max-width:960px; margin:0 auto; }
                .ht-eyebrow { font-size:10.5px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:rgba(232,240,239,0.45); margin-bottom:10px; }
                .ht-title { font-family:'Playfair Display',serif; font-size:36px; font-weight:500; color:#e8f0ef; margin-bottom:8px; }
                .ht-sub { font-size:13.5px; color:rgba(232,240,239,0.5); font-weight:300; margin-bottom:22px; }
                .ht-tabs { display:flex; gap:8px; }
                .ht-tab { padding:8px 20px; border-radius:20px; border:1px solid rgba(255,255,255,0.2); background:transparent; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; color:rgba(255,255,255,0.6); cursor:pointer; transition:all 0.2s; }
                .ht-tab:hover { border-color:rgba(255,255,255,0.4); color:#fff; }
                .ht-tab.active { background:#ffcc00; border-color:#ffcc00; color:#1a2e2b; }

                .ht-content { max-width:960px; margin:0 auto; padding:32px 24px 80px; }
                .ht-error { display:flex; align-items:center; gap:8px; background:rgba(139,26,26,0.18); border:1px solid rgba(139,26,26,0.35); border-radius:10px; padding:12px 16px; font-size:13px; color:#ffb4b4; margin-bottom:24px; }
                .ht-nudge { background:#4d8a82; border:1px solid rgba(255,255,255,0.18); border-radius:14px; padding:36px; text-align:center; color:#ffffff; }
                .ht-nudge h3 { font-family:'Playfair Display',serif; font-size:22px; margin-bottom:10px; }
                .ht-nudge p { font-size:13.5px; color:rgba(255,255,255,0.6); margin-bottom:22px; }
                .ht-nudge-btn { display:inline-block; padding:12px 24px; background:#ffcc00; border-radius:10px; font-weight:700; font-size:13.5px; color:#1a2e2b; cursor:pointer; border:none; }

                .ht-filter { display:flex; align-items:center; gap:8px; margin-bottom:24px; flex-wrap:wrap; }
                .ht-filter-label { font-size:12px; color:rgba(26,46,43,0.6); font-weight:600; }
                .ht-chip { padding:4px 12px; border-radius:20px; font-size:11px; font-weight:600; background:#4d8a82; color:#fff; border:1px solid rgba(255,255,255,0.2); }

                .ht-quiz-notice { background:rgba(122,184,176,0.12); border:1px solid rgba(122,184,176,0.25); border-radius:10px; padding:12px 16px; font-size:12.5px; color:#2d4a47; margin-bottom:20px; display:flex; align-items:center; gap:8px; }

                .ht-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; margin-bottom:28px; }
                .ht-card { background:#4d8a82; border:1.5px solid rgba(255,255,255,0.16); border-radius:14px; overflow:hidden; box-shadow:0 4px 16px rgba(29,58,54,0.15); color:#fff; animation:cardIn 0.35s ease both; transition:box-shadow 0.2s,transform 0.2s; }
                .ht-card:hover { box-shadow:0 8px 28px rgba(29,58,54,0.25); transform:translateY(-2px); }
                .ht-card-body { padding:18px; }
                .ht-card-name { font-family:'Playfair Display',serif; font-size:17px; color:#fff; margin-bottom:5px; }
                .ht-card-loc { font-size:12px; color:rgba(255,255,255,0.55); margin-bottom:10px; }
                .ht-price-row { display:flex; align-items:baseline; gap:6px; margin-bottom:8px; }
                .ht-price { font-family:'Playfair Display',serif; font-size:18px; color:#ffcc00; font-weight:400; }
                .ht-price-label { font-size:11px; color:rgba(255,255,255,0.45); }
                .ht-nights-calc { font-size:12px; color:rgba(255,255,255,0.5); margin-bottom:14px; }
                .ht-btn-save { width:100%; padding:10px; border:none; border-radius:10px; background:#ffcc00; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:700; color:#1a2e2b; cursor:pointer; transition:background 0.2s; }
                .ht-btn-save:hover { background:#e6b800; }

                .ht-saved-card { background:#4d8a82; border:1.5px solid rgba(255,255,255,0.16); border-radius:14px; overflow:hidden; color:#fff; animation:cardIn 0.35s ease both; }
                .ht-saved-body { padding:18px; }
                .ht-dates { font-size:11px; color:rgba(255,255,255,0.5); margin-bottom:10px; display:flex; gap:12px; }
                .ht-total-badge { background:rgba(255,204,0,0.12); border:1px solid rgba(255,204,0,0.25); border-radius:8px; padding:"6px 12px"; font-size:13px; font-weight:700; color:#ffcc00; margin-bottom:12px; display:inline-block; }
                .ht-btn-del { padding:8px 14px; border:1px solid rgba(139,26,26,0.4); border-radius:9px; background:rgba(139,26,26,0.15); font-size:12px; color:#ffb4b4; cursor:pointer; }

                .results-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
                .results-label { font-size:13px; font-weight:600; color:rgba(26,46,43,0.7); }
                .results-count { font-size:12px; color:rgba(26,46,43,0.5); background:rgba(45,74,71,0.1); border-radius:20px; padding:3px 10px; }
            `}</style>

            <div className="ht-root">
                <Navbar />

                <div className="ht-hero">
                    <div className="ht-hero-inner">
                        <p className="ht-eyebrow">Step 2 — Hotel Selection</p>
                        <h1 className="ht-title">Find your perfect stay</h1>
                        <p className="ht-sub">
                            Hotels matched to your personality and saved destinations.
                            Budget is calculated automatically from your quiz ({quizDays} nights).
                        </p>
                        <div className="ht-tabs">
                            <button className={`ht-tab ${tab==="search"?"active":""}`}
                                    onClick={() => { setTab("search"); loadRecommendations(); }}>
                                🔍 Recommended
                            </button>
                            <button className={`ht-tab ${tab==="saved"?"active":""}`}
                                    onClick={() => { setTab("saved"); loadSaved(); }}>
                                ❤️ My Saved Hotel
                            </button>
                        </div>
                    </div>
                </div>

                <div className="ht-content">
                    {error && (
                        error.includes("quiz") ? (
                            <div className="ht-nudge">
                                <h3>Complete your personality quiz first 🧭</h3>
                                <p>We need your OCEAN scores to recommend hotels for you.</p>
                                <button className="ht-nudge-btn" onClick={() => navigate("/quiz")}>Take the Quiz →</button>
                            </div>
                        ) : (
                            <div className="ht-error">{error}</div>
                        )
                    )}

                    {/* ── RECOMMENDED ── */}
                    {tab === "search" && !error && (
                        <>
                            {locationsUsed.length > 0 && (
                                <div className="ht-filter">
                                    <span className="ht-filter-label">Filtered by your locations:</span>
                                    {locationsUsed.map(l => <span key={l} className="ht-chip">{l}</span>)}
                                </div>
                            )}
                            {/* Budget notice */}
                            <div className="ht-quiz-notice">
                                📅 Budget calculated automatically: <strong>{quizDays} nights</strong> from your quiz settings
                            </div>

                            {loading ? <Skeleton /> : hotels.length === 0 ? (
                                <div style={{ background:"#4d8a82", borderRadius:12, padding:"36px 24px", textAlign:"center", color:"rgba(255,255,255,0.5)" }}>
                                    <p style={{ fontSize:36, marginBottom:12 }}>🏨</p>
                                    <p style={{ fontSize:14 }}>No hotels found. Save some locations first.</p>
                                    <button onClick={() => navigate("/locations")} style={{ marginTop:16, padding:"10px 22px", background:"#ffcc00", border:"none", borderRadius:10, fontWeight:700, fontSize:13, color:"#1a2e2b", cursor:"pointer" }}>Go to Locations →</button>
                                </div>
                            ) : (
                                <>
                                    <div className="results-header">
                                        <span className="results-label">Recommended hotels</span>
                                        <span className="results-count">{hotels.length} shown</span>
                                    </div>
                                    <div className="ht-grid">
                                        {hotels.map((hotel, i) => (
                                            <div key={hotel.hotel_id} className="ht-card" style={{ animationDelay:`${Math.min(i,8)*0.04}s` }}>
                                                <HotelImage hotelId={hotel.hotel_id} name={hotel.name} />
                                                <div className="ht-card-body">
                                                    <div className="ht-card-name">{hotel.name}</div>
                                                    <div className="ht-card-loc">📍 {hotel.location}</div>
                                                    <div className="ht-price-row">
                                                        <span className="ht-price">{formatLKR(hotel.budget_per_night)}</span>
                                                        <span className="ht-price-label">/ night</span>
                                                    </div>
                                                    {/* Auto-calculated total shown upfront */}
                                                    <div className="ht-nights-calc">
                                                        = {formatLKR(Math.round((hotel.budget_per_night||0) * quizDays))} for {quizDays} nights
                                                    </div>
                                                    <button className="ht-btn-save" onClick={() => setSaveTarget(hotel)}>
                                                        ❤️ Save + Pick Dates
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* ── SAVED ── */}
                    {tab === "saved" && (
                        loading ? <Skeleton /> : saved.length === 0 ? (
                            <div style={{ background:"#4d8a82", borderRadius:12, padding:"36px 24px", textAlign:"center", color:"rgba(255,255,255,0.5)" }}>
                                <p style={{ fontSize:36, marginBottom:12 }}>❤️</p>
                                <p style={{ fontSize:14 }}>You haven't saved a hotel yet.</p>
                            </div>
                        ) : (
                            <div className="ht-grid">
                                {saved.map((hotel, i) => (
                                    <div key={hotel.id} className="ht-saved-card" style={{ animationDelay:`${i*0.04}s` }}>
                                        <HotelImage hotelId={hotel.hotel_id} name={hotel.name} />
                                        <div className="ht-saved-body">
                                            <div className="ht-card-name">{hotel.name}</div>
                                            <div className="ht-card-loc">📍 {hotel.location}</div>
                                            {(hotel.check_in || hotel.check_out) && (
                                                <div className="ht-dates">
                                                    {hotel.check_in  && <span>📅 In: {hotel.check_in}</span>}
                                                    {hotel.check_out && <span>📅 Out: {hotel.check_out}</span>}
                                                </div>
                                            )}
                                            <div style={{ background:"rgba(255,204,0,0.12)", border:"1px solid rgba(255,204,0,0.25)", borderRadius:8, padding:"8px 12px", fontSize:13, fontWeight:700, color:"#ffcc00", marginBottom:12 }}>
                                                {formatLKR(hotel.total_budget)} total
                                                <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)", fontWeight:400 }}> ({quizDays} nights)</span>
                                            </div>
                                            <button className="ht-btn-del" onClick={() => handleDelete(hotel.id)}>🗑️ Remove</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
                <NextStepBanner
                    step={2}
                    done={hasSaved}
                    nextPath="/guides"
                    nextLabel="Find Your Guide →"
                    nextSub="Step 3 of 4"
                    locked={!hasSaved}
                    lockedMsg="Save a hotel first"
                />
            </div>

            {saveTarget && (
                <SaveModal
                    hotel={saveTarget}
                    quizDays={quizDays}
                    onClose={() => setSaveTarget(null)}
                    onSaved={() => setHasSaved(true)}
                />
            )}
        </>
    );
}