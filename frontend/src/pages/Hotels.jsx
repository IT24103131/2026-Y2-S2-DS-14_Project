import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Navbar from "../components/Navbar";

// ─────────────────────────────────────────────────────────────────────────────
// Hotels.jsx  —  Hotel recommender, integrated into VibeLanka
//
// Two-table flow:
//   hotel table → [KMeans cluster] → recommended_hotels
//   → user picks + enters dates → selected_hotels (check_in, check_out)
//
// Endpoints:
//   GET  /hotels              → AI recommendations (writes to recommended_hotels)
//   POST /hotels/save         → save with dates (writes to selected_hotels)
//   GET  /hotels/saved        → user's confirmed hotel list
//   PUT  /hotels/saved/<id>   → edit budget / dates
//   DELETE /hotels/saved/<id> → remove
// ─────────────────────────────────────────────────────────────────────────────

function formatLKR(v) {
    return `LKR ${Number(v).toLocaleString("en-LK")}`;
}

function HotelImage({ hotelId, name }) {
    return (
        <img
            src={`https://picsum.photos/seed/hotel${hotelId}/400/250`}
            alt={name}
            style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }}
            loading="lazy"
        />
    );
}

// Modal for entering check-in / check-out when saving a hotel
function SaveModal({ hotel, onClose, onSaved }) {
    const [checkIn,  setCheckIn]  = useState("");
    const [checkOut, setCheckOut] = useState("");
    const [budget,   setBudget]   = useState(hotel.budget_per_night || 0);
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState("");

    const handleSave = async () => {
        if (!checkIn || !checkOut) { setError("Please select both check-in and check-out dates."); return; }
        if (checkOut <= checkIn)   { setError("Check-out must be after check-in."); return; }
        setError("");
        setLoading(true);
        try {
            await API.post("/hotels/save", {
                hotel_id:     hotel.hotel_id,
                location:     hotel.location,
                total_budget: parseFloat(budget),
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
                .modal-overlay{position:fixed;inset:0;z-index:999;background:rgba(26,46,43,0.6);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;animation:overlayIn 0.2s ease;}
                @keyframes overlayIn{from{opacity:0}to{opacity:1}}
                .modal-box{width:100%;max-width:420px;background:#4d8a82;border:1px solid rgba(255,255,255,0.18);border-radius:16px;padding:32px;box-shadow:0 8px 48px rgba(29,58,54,0.35);color:#ffffff;animation:boxIn 0.3s cubic-bezier(0.16,1,0.3,1);}
                @keyframes boxIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
                .modal-title{font-family:'Playfair Display',serif;font-size:22px;font-weight:400;color:#ffffff;margin-bottom:6px;}
                .modal-sub{font-size:13px;color:rgba(255,255,255,0.55);margin-bottom:24px;}
                .modal-label{display:block;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.55);margin-bottom:6px;}
                .modal-input{width:100%;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:11px 14px;font-family:'DM Sans',sans-serif;font-size:14px;color:#ffffff;outline:none;margin-bottom:16px;transition:border-color 0.2s,background 0.2s;caret-color:#fff;}
                .modal-input:focus{border-color:rgba(255,255,255,0.4);background:rgba(255,255,255,0.18);}
                .modal-input[type=date]::-webkit-calendar-picker-indicator{filter:invert(1);opacity:0.6;cursor:pointer;}
                .modal-error{background:rgba(139,26,26,0.2);border:1px solid rgba(139,26,26,0.4);border-radius:8px;padding:10px 14px;font-size:12.5px;color:#ffb4b4;margin-bottom:16px;}
                .modal-actions{display:flex;gap:10px;margin-top:4px;}
                .modal-cancel{flex:1;padding:12px;border:1px solid rgba(255,255,255,0.2);border-radius:10px;background:transparent;font-family:'DM Sans',sans-serif;font-size:13.5px;font-weight:500;color:rgba(255,255,255,0.65);cursor:pointer;transition:border-color 0.2s,color 0.2s;}
                .modal-cancel:hover{border-color:rgba(255,255,255,0.5);color:#fff;}
                .modal-confirm{flex:2;padding:12px;border:none;border-radius:10px;background:#ffcc00;font-family:'DM Sans',sans-serif;font-size:13.5px;font-weight:700;color:#1a2e2b;cursor:pointer;transition:background 0.2s,transform 0.15s;}
                .modal-confirm:hover:not(:disabled){background:#e6b800;transform:translateY(-1px);}
                .modal-confirm:disabled{opacity:0.45;cursor:not-allowed;}
            `}</style>
            <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
                <div className="modal-box">
                    <div className="modal-title">Book {hotel.name}</div>
                    <div className="modal-sub">📍 {hotel.location}</div>
                    {error && <div className="modal-error">{error}</div>}
                    <label className="modal-label">Check-in Date</label>
                    <input type="date" className="modal-input" value={checkIn}
                           min={new Date().toISOString().split("T")[0]}
                           onChange={e => setCheckIn(e.target.value)} />
                    <label className="modal-label">Check-out Date</label>
                    <input type="date" className="modal-input" value={checkOut}
                           min={checkIn || new Date().toISOString().split("T")[0]}
                           onChange={e => setCheckOut(e.target.value)} />
                    <label className="modal-label">Budget per Night (LKR)</label>
                    <input type="number" className="modal-input" value={budget}
                           onChange={e => setBudget(e.target.value)} />
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
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
    const [tab, setTab]         = useState("search");
    const [hotels, setHotels]   = useState([]);
    const [saved,  setSaved]    = useState([]);
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState("");
    const [locationsUsed, setLocsUsed] = useState([]);
    const [saveTarget, setSaveTarget]  = useState(null); // hotel to show modal for

    const loadRecommendations = () => {
        setLoading(true);
        setError("");
        API.get("/hotels")
            .then(res => {
                setHotels(res.data.hotels || []);
                setLocsUsed(res.data.locations_used || []);
            })
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

    useEffect(() => { loadRecommendations(); }, []);

    const handleDelete = async (rowId) => {
        if (!window.confirm("Remove this hotel from your saved list?")) return;
        await API.delete(`/hotels/saved/${rowId}`).catch(() => {});
        loadSaved();
    };

    const handleEditBudget = async (hotel) => {
        const input = window.prompt(
            `Update details for ${hotel.name}\nNew budget (LKR):`, hotel.total_budget
        );
        if (!input) return;
        const checkIn  = window.prompt("New check-in date (YYYY-MM-DD):", hotel.check_in);
        const checkOut = window.prompt("New check-out date (YYYY-MM-DD):", hotel.check_out);
        await API.put(`/hotels/saved/${hotel.id}`, {
            total_budget: parseFloat(input) || hotel.total_budget,
            check_in:  checkIn  || hotel.check_in,
            check_out: checkOut || hotel.check_out,
        }).catch(() => alert("Could not update."));
        loadSaved();
    };

    const grandTotal = saved.reduce((s, h) => s + (h.total_budget || 0), 0);

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
                @keyframes pulse  { 0%,100%{opacity:1}50%{opacity:0.4} }
                @keyframes fadeUp { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)} }
                @keyframes cardIn { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)} }

                .ht-root { min-height:100vh; background:#e8f0ef; font-family:'DM Sans',sans-serif; }
                .ht-hero { background:#2d4a47; padding:40px 32px 32px; border-bottom:1px solid rgba(255,255,255,0.08); }
                .ht-hero-inner { max-width:960px; margin:0 auto; }
                .ht-eyebrow { font-size:10.5px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:rgba(232,240,239,0.45); margin-bottom:10px; }
                .ht-title { font-family:'Playfair Display',serif; font-size:36px; font-weight:500; color:#e8f0ef; letter-spacing:-0.3px; margin-bottom:8px; }
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

                .ht-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; margin-bottom:28px; }
                .ht-card { background:#4d8a82; border:1.5px solid rgba(255,255,255,0.16); border-radius:14px; overflow:hidden; box-shadow:0 4px 16px rgba(29,58,54,0.15); color:#fff; animation:cardIn 0.35s ease both; transition:box-shadow 0.2s,transform 0.2s; }
                .ht-card:hover { box-shadow:0 8px 28px rgba(29,58,54,0.25); transform:translateY(-2px); }
                .ht-card-body { padding:18px; }
                .ht-card-name { font-family:'Playfair Display',serif; font-size:17px; font-weight:400; color:#fff; margin-bottom:5px; line-height:1.3; }
                .ht-card-loc { font-size:12px; color:rgba(255,255,255,0.55); margin-bottom:12px; }
                .ht-badge { display:inline-block; background:rgba(255,204,0,0.15); border:1px solid rgba(255,204,0,0.35); border-radius:8px; padding:6px 12px; font-size:13px; font-weight:700; color:#ffcc00; margin-bottom:14px; }
                .ht-dates { font-size:11px; color:rgba(255,255,255,0.5); margin-bottom:10px; display:flex; gap:12px; }
                .ht-card-actions { display:flex; gap:8px; }
                .ht-btn-save { flex:1; padding:10px; border:none; border-radius:10px; background:#ffcc00; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:700; color:#1a2e2b; cursor:pointer; transition:background 0.2s,transform 0.15s; }
                .ht-btn-save:hover { background:#e6b800; transform:translateY(-1px); }
                .ht-btn-edit { flex:1; padding:10px; border:1px solid rgba(255,255,255,0.2); border-radius:10px; background:transparent; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; color:rgba(255,255,255,0.7); cursor:pointer; transition:border-color 0.2s,color 0.2s; }
                .ht-btn-edit:hover { border-color:rgba(255,255,255,0.5); color:#fff; }
                .ht-btn-del { padding:10px 14px; border:1px solid rgba(139,26,26,0.4); border-radius:10px; background:rgba(139,26,26,0.15); font-size:13px; color:#ffb4b4; cursor:pointer; transition:background 0.2s; }
                .ht-btn-del:hover { background:rgba(139,26,26,0.3); }

                .ht-total { background:rgba(255,204,0,0.12); border:1px solid rgba(255,204,0,0.3); border-radius:12px; padding:18px 22px; display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; animation:fadeUp 0.3s ease; }
                .ht-total-label { font-size:13px; color:rgba(26,46,43,0.6); font-weight:500; }
                .ht-total-amount { font-family:'Playfair Display',serif; font-size:24px; font-weight:500; color:#2d4a47; }

                .ht-empty { text-align:center; padding:56px 24px; color:rgba(255,255,255,0.5); background:#4d8a82; border:1px solid rgba(255,255,255,0.14); border-radius:14px; }
                .ht-empty p { font-size:14px; margin-top:12px; }

                .results-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
                .results-label { font-size:13px; font-weight:600; color:rgba(26,46,43,0.7); }
                .results-count { font-size:12px; color:rgba(26,46,43,0.5); background:rgba(45,74,71,0.1); border-radius:20px; padding:3px 10px; }

                @media(max-width:600px) { .ht-title{font-size:26px} .ht-content{padding:24px 16px 60px} }
            `}</style>

            <div className="ht-root">
                <Navbar />

                <div className="ht-hero">
                    <div className="ht-hero-inner">
                        <p className="ht-eyebrow">Step 3 — Hotel Selection</p>
                        <h1 className="ht-title">Find your perfect stay</h1>
                        <p className="ht-sub">
                            Hotels matched to your personality and chosen destinations.
                            Pick your dates and save the ones you love.
                        </p>
                        <div className="ht-tabs">
                            <button className={`ht-tab ${tab==="search"?"active":""}`}
                                    onClick={() => { setTab("search"); loadRecommendations(); }}>
                                🔍 Recommended
                            </button>
                            <button className={`ht-tab ${tab==="saved"?"active":""}`}
                                    onClick={() => { setTab("saved"); loadSaved(); }}>
                                ❤️ My Saved Hotels
                            </button>
                        </div>
                    </div>
                </div>

                <div className="ht-content">

                    {error && (
                        error.includes("quiz") ? (
                            <div className="ht-nudge">
                                <h3>Complete your personality quiz first 🧭</h3>
                                <p>We need your OCEAN scores to recommend the right hotels for you.</p>
                                <button className="ht-nudge-btn" onClick={() => navigate("/quiz")}>Take the Quiz →</button>
                            </div>
                        ) : (
                            <div className="ht-error">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                {error}
                            </div>
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
                            {loading ? <Skeleton /> : hotels.length === 0 ? (
                                <div className="ht-empty">
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{margin:"0 auto",display:"block",opacity:0.3}}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                    <p>No hotels found for your locations. Try selecting more destinations first.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="results-header">
                                        <span className="results-label">Recommended hotels</span>
                                        <span className="results-count">{hotels.length} shown</span>
                                    </div>
                                    <div className="ht-grid">
                                        {hotels.map((hotel, i) => (
                                            <div key={hotel.hotel_id} className="ht-card"
                                                 style={{ animationDelay:`${Math.min(i,8)*0.04}s` }}>
                                                <HotelImage hotelId={hotel.hotel_id} name={hotel.name} />
                                                <div className="ht-card-body">
                                                    <div className="ht-card-name">{hotel.name}</div>
                                                    <div className="ht-card-loc">📍 {hotel.location}</div>
                                                    <div className="ht-badge">💰 {formatLKR(hotel.budget_per_night)} / night</div>
                                                    <div className="ht-card-actions">
                                                        <button className="ht-btn-save"
                                                                onClick={() => setSaveTarget(hotel)}>
                                                            ❤️ Save + Pick Dates
                                                        </button>
                                                    </div>
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
                        <>
                            {saved.length > 0 && (
                                <div className="ht-total">
                                    <div>
                                        <div className="ht-total-label">Total planned budget</div>
                                        <div className="ht-total-amount">{formatLKR(grandTotal)} / night</div>
                                    </div>
                                    <span style={{fontSize:28}}>🏨</span>
                                </div>
                            )}
                            {loading ? <Skeleton /> : saved.length === 0 ? (
                                <div className="ht-empty">
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{margin:"0 auto",display:"block",opacity:0.3}}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                                    <p>You haven't saved any hotels yet. Go to Recommended to find some.</p>
                                </div>
                            ) : (
                                <div className="ht-grid">
                                    {saved.map((hotel, i) => (
                                        <div key={hotel.id} className="ht-card"
                                             style={{animationDelay:`${Math.min(i,8)*0.04}s`}}>
                                            <HotelImage hotelId={hotel.hotel_id} name={hotel.name} />
                                            <div className="ht-card-body">
                                                <div className="ht-card-name">{hotel.name}</div>
                                                <div className="ht-card-loc">📍 {hotel.location}</div>
                                                <div className="ht-badge">💰 {formatLKR(hotel.total_budget)} / night</div>
                                                {(hotel.check_in || hotel.check_out) && (
                                                    <div className="ht-dates">
                                                        {hotel.check_in  && <span>📅 In: {hotel.check_in}</span>}
                                                        {hotel.check_out && <span>📅 Out: {hotel.check_out}</span>}
                                                    </div>
                                                )}
                                                <div className="ht-card-actions">
                                                    <button className="ht-btn-edit"
                                                            onClick={() => handleEditBudget(hotel)}>✏️ Edit</button>
                                                    <button className="ht-btn-del"
                                                            onClick={() => handleDelete(hotel.id)}>🗑️</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Date/budget save modal */}
            {saveTarget && (
                <SaveModal
                    hotel={saveTarget}
                    onClose={() => setSaveTarget(null)}
                    onSaved={() => { /* optionally switch to saved tab */ }}
                />
            )}
        </>
    );
}