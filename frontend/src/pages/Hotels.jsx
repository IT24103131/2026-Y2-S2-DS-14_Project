import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Layout from "../components/Layout";
import NextStepBanner from "../components/NextStepBanner";
import { fmtLKR, lkrToUsd, fmtUSD } from "../utils/currency";

// ─────────────────────────────────────────────────────────────────────────────
// Hotels.jsx — Vibe Lanka design system
// Layout wrapper, rust hero gradient, white cards, rust/gold accents
// ─────────────────────────────────────────────────────────────────────────────

const TRAIT_META = [
    { key: "openness",          label: "adventurous spirit",   reasons: ["its unique local character and creative design","its distinctive atmosphere that suits explorers","the one-of-a-kind experiences it offers"] },
    { key: "conscientiousness", label: "organised mindset",    reasons: ["its well-structured amenities and reliable service","the consistently high standards you value","its orderly and efficient hospitality"] },
    { key: "extraversion",      label: "outgoing personality", reasons: ["its vibrant social spaces and lively atmosphere","the social activities and communal areas available","the energetic environment you'll thrive in"] },
    { key: "agreeableness",     label: "warm and caring nature",reasons: ["its genuinely welcoming staff and warm hospitality","the family-friendly and cooperative atmosphere","the harmony and comfort it provides"] },
    { key: "neuroticism",       label: "desire for calm",      reasons: ["its peaceful, serene surroundings","the stress-free and relaxing environment","the tranquil retreat it offers"] },
];

function getPersonalityReason(hotel) {
    const scored = TRAIT_META.map(t => ({ ...t, score: hotel[`${t.key}_score`] || 0 }));
    const dominant = scored.reduce((a, b) => (a.score >= b.score ? a : b));
    const reasonIdx = (hotel.hotel_id || 0) % dominant.reasons.length;
    return { label: dominant.label, reason: dominant.reasons[reasonIdx], trait: dominant.key };
}

function extractCity(locationStr) {
    if (!locationStr) return "Other";
    return locationStr.split(",")[0].trim();
}

function groupByLocation(hotels) {
    const map = {};
    for (const h of hotels) {
        const city = extractCity(h.location);
        if (!map[city]) map[city] = [];
        map[city].push(h);
    }
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
}

function HotelImage({ hotelId, name }) {
    return (
        <img
            src={`https://picsum.photos/seed/hotel${hotelId}/400/250`}
            alt={name}
            style={{ width: "100%", height: 170, objectFit: "cover", display: "block" }}
            loading="lazy"
        />
    );
}

// Save / Book Modal
function SaveModal({ hotel, onClose, onSaved }) {
    const [checkIn,   setCheckIn]   = useState("");
    const [checkOut,  setCheckOut]  = useState("");
    const [numPeople, setNumPeople] = useState(1);
    const [loading,   setLoading]   = useState(false);
    const [error,     setError]     = useState("");

    const today = new Date().toISOString().split("T")[0];

    const nights = (() => {
        if (!checkIn || !checkOut) return 0;
        const diff = (new Date(checkOut) - new Date(checkIn)) / 86400000;
        return diff > 0 ? diff : 0;
    })();

    const perNight    = hotel.budget_per_night || 0;
    const totalBudget = Math.round(perNight * nights * numPeople);

    const handleSave = async () => {
        if (!checkIn || !checkOut) { setError("Please select both check-in and check-out dates."); return; }
        if (checkOut <= checkIn)   { setError("Check-out must be after check-in."); return; }
        if (numPeople < 1)         { setError("At least 1 guest is required."); return; }
        setError("");
        setLoading(true);
        try {
            await API.post("/hotels/save", {
                hotel_id:     hotel.hotel_id,
                location:     hotel.location,
                total_budget: totalBudget,
                check_in:     checkIn,
                check_out:    checkOut,
                num_people:   numPeople,
            });
            onSaved();
            onClose();
        } catch (err) {
            setError(err?.response?.data?.detail || "Could not save hotel. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <style>{`
                .sm-overlay{position:fixed;inset:0;z-index:999;background:rgba(62,39,35,0.6);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;}
                .sm-box{width:100%;max-width:460px;background:#FFFFFF;border:1px solid #E8D5BC;border-radius:20px;padding:36px;box-shadow:0 20px 60px rgba(62,39,35,0.2);color:#3E2723;}
                .sm-hotel-name{font-family:'Playfair Display',serif;font-size:22px;font-weight:500;color:#3E2723;margin-bottom:4px;}
                .sm-loc{font-size:13px;color:rgba(62,39,35,0.5);margin-bottom:24px;}
                .sm-divider{height:1px;background:#E8D5BC;margin:20px 0;}
                .sm-label{display:block;font-size:10.5px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(62,39,35,0.45);margin-bottom:7px;}
                .sm-input{width:100%;background:#FFFFFF;border:1.5px solid #E8D5BC;border-radius:10px;padding:12px 14px;font-family:'Inter',sans-serif;font-size:15px;color:#3E2723;outline:none;margin-bottom:16px;transition:border-color .2s,box-shadow .2s;box-sizing:border-box;caret-color:#8C3322;}
                .sm-input:focus{border-color:#8C3322;box-shadow:0 0 0 3px rgba(140,51,34,0.1);}
                .sm-input[type=date]::-webkit-calendar-picker-indicator{cursor:pointer;opacity:0.6;}
                .sm-input[type=number]::-webkit-inner-spin-button,.sm-input[type=number]::-webkit-outer-spin-button{opacity:.6;}
                .sm-two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
                .sm-calc{background:#FDF5EE;border:1px solid #E8D5BC;border-radius:12px;padding:16px;margin:4px 0 20px;}
                .sm-calc-title{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(62,39,35,0.4);margin-bottom:10px;}
                .sm-calc-row{display:flex;justify-content:space-between;font-size:13px;color:rgba(62,39,35,0.6);margin-bottom:5px;}
                .sm-calc-total{display:flex;justify-content:space-between;align-items:baseline;margin-top:8px;padding-top:8px;border-top:1px solid #E8D5BC;}
                .sm-calc-total-label{font-size:12px;color:rgba(62,39,35,0.45);}
                .sm-calc-total-value{font-family:'Playfair Display',serif;font-size:22px;color:#8C3322;}
                .sm-error{background:rgba(140,51,34,0.07);border:1px solid rgba(140,51,34,0.2);border-radius:8px;padding:10px 14px;font-size:13px;color:#8C3322;margin-bottom:16px;}
                .sm-actions{display:flex;gap:10px;margin-top:4px;}
                .sm-cancel{flex:1;padding:13px;border:1.5px solid #E8D5BC;border-radius:50px;background:#fff;font-family:'Inter',sans-serif;font-size:14px;font-weight:500;color:rgba(62,39,35,0.6);cursor:pointer;transition:all .2s;min-height:48px;}
                .sm-cancel:hover{border-color:#8C3322;color:#8C3322;}
                .sm-confirm{flex:2;padding:13px;border:none;border-radius:50px;background:#8C3322;font-family:'Inter',sans-serif;font-size:14px;font-weight:700;color:#fff;cursor:pointer;transition:opacity .2s;min-height:48px;}
                .sm-confirm:hover:not(:disabled){opacity:0.88;}
                .sm-confirm:disabled{opacity:.4;cursor:not-allowed;}
            `}</style>
            <div className="sm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
                <div className="sm-box">
                    <div className="sm-hotel-name">{hotel.name}</div>
                    <div className="sm-loc">📍 {hotel.location}</div>

                    <div className="sm-two-col">
                        <div>
                            <label className="sm-label">Check-in Date</label>
                            <input type="date" className="sm-input" value={checkIn} min={today}
                                   onChange={e => setCheckIn(e.target.value)} />
                        </div>
                        <div>
                            <label className="sm-label">Check-out Date</label>
                            <input type="date" className="sm-input" value={checkOut}
                                   min={checkIn || today}
                                   onChange={e => setCheckOut(e.target.value)} />
                        </div>
                    </div>

                    <label className="sm-label">Number of Guests</label>
                    <input type="number" className="sm-input" value={numPeople} min={1} max={20}
                           onChange={e => setNumPeople(Math.max(1, parseInt(e.target.value) || 1))} />

                    <div className="sm-calc">
                        <div className="sm-calc-title">Budget Calculation</div>
                        <div className="sm-calc-row">
                            <span>Rate per night</span>
                            <span>{fmtLKR(perNight)}</span>
                        </div>
                        <div className="sm-calc-row">
                            <span>Duration</span>
                            <span>{nights > 0 ? `${nights} night${nights !== 1 ? "s" : ""}` : "— pick dates"}</span>
                        </div>
                        <div className="sm-calc-row">
                            <span>Guests</span>
                            <span>{numPeople} {numPeople === 1 ? "person" : "people"}</span>
                        </div>
                        <div className="sm-calc-total">
                            <span className="sm-calc-total-label">
                                {nights > 0 ? `${fmtLKR(perNight)} × ${nights}n × ${numPeople}` : "Select dates above"}
                            </span>
                            <span className="sm-calc-total-value">
                                {nights > 0 ? fmtLKR(totalBudget) : "—"}
                            </span>
                        </div>
                        {nights > 0 && (
                            <div style={{ textAlign: "right", fontSize: 11, color: "rgba(62,39,35,0.4)", marginTop: 4 }}>
                                ≈ {fmtUSD(lkrToUsd(totalBudget))}
                            </div>
                        )}
                    </div>

                    {error && <div className="sm-error">{error}</div>}

                    <div className="sm-actions">
                        <button className="sm-cancel" onClick={onClose}>Cancel</button>
                        <button className="sm-confirm" onClick={handleSave}
                                disabled={loading || nights === 0}>
                            {loading ? "Saving…" : nights === 0 ? "Pick dates first" : "Confirm Booking"}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

function Skeleton() {
    return (
        <div>
            {[0, 1].map(s => (
                <div key={s} style={{ marginBottom: 36 }}>
                    <div style={{ height: 16, width: 140, background: "#F0E5D8", borderRadius: 6, marginBottom: 16 }} />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{ background: "#fff", border: "1px solid #E8D5BC", borderRadius: 18, overflow: "hidden", opacity: 0.55 }}>
                                <div style={{ height: 170, background: "#F0E5D8", animation: "htPulse 1.2s infinite" }} />
                                <div style={{ padding: 18 }}>
                                    <div style={{ height: 14, width: "65%", background: "#F0E5D8", borderRadius: 6, marginBottom: 10 }} />
                                    <div style={{ height: 11, width: "45%", background: "#F0E5D8", borderRadius: 6 }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function HotelCard({ hotel, quizDays, onBook, style }) {
    const match = getPersonalityReason(hotel);
    return (
        <div className="ht-card" style={style}>
            <HotelImage hotelId={hotel.hotel_id} name={hotel.name} />
            <div className="ht-card-body">
                <div className="ht-card-name">{hotel.name}</div>
                <div className="ht-card-loc">{hotel.location}</div>

                <p style={{ fontSize: 13, color: "rgba(62,39,35,0.55)", marginBottom: 12, lineHeight: 1.5, paddingLeft: 10, borderLeft: "2px solid #D4A373" }}>
                    {match.reason.charAt(0).toUpperCase() + match.reason.slice(1)}
                </p>

                <div className="ht-price-row">
                    <span className="ht-price">{fmtLKR(hotel.budget_per_night)}</span>
                    <span className="ht-price-label">/ night · ~{fmtUSD(lkrToUsd(hotel.budget_per_night))}</span>
                </div>
                <div className="ht-nights-calc">
                    Est. {fmtLKR(Math.round((hotel.budget_per_night || 0) * quizDays))} for {quizDays} nights
                </div>

                <button className="ht-btn-save" onClick={() => onBook(hotel)}>
                    Book & Set Dates →
                </button>
            </div>
        </div>
    );
}

export default function Hotels() {
    const navigate = useNavigate();
    const [tab,           setTab]          = useState("search");
    const [hotels,        setHotels]       = useState([]);
    const [saved,         setSaved]        = useState([]);
    const [loading,       setLoading]      = useState(false);
    const [error,         setError]        = useState("");
    const [locationsUsed, setLocsUsed]     = useState([]);
    const [saveTarget,    setSaveTarget]   = useState(null);
    const [quizDays,      setQuizDays]     = useState(3);
    const [hasSaved,      setHasSaved]     = useState(false);
    const [personalityType, setPersonalityType] = useState("");

    useEffect(() => {
        API.get("/itineraries/planner-data")
            .then(r => setQuizDays(r.data.default_days || 3))
            .catch(() => {});
        loadRecommendations();
        API.get("/hotels/saved")
            .then(res => { if (res.data?.saved_hotels?.length > 0) setHasSaved(true); })
            .catch(() => {});
    }, []);

    const loadRecommendations = () => {
        setLoading(true); setError("");
        API.get("/hotels")
            .then(res => {
                setHotels(res.data.hotels || []);
                setLocsUsed(res.data.locations_used || []);
                setPersonalityType(res.data.personality_type || "");
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

    const handleDelete = async (rowId) => {
        if (!window.confirm("Remove this hotel from your saved list?")) return;
        await API.delete(`/hotels/saved/${rowId}`).catch(() => {});
        loadSaved();
        API.get("/hotels/saved")
            .then(res => setHasSaved(res.data?.saved_hotels?.length > 0))
            .catch(() => {});
    };

    const grouped = groupByLocation(hotels);

    return (
        <Layout>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
                @keyframes htPulse { 0%,100%{opacity:1}50%{opacity:0.4} }
                @keyframes cardIn  { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)} }

                /* Hero */
                .ht-hero {
                    background: linear-gradient(135deg, #6B2318 0%, #8C3322 100%);
                    padding: 44px 32px 36px;
                    border-bottom: 1px solid rgba(255,255,255,0.08);
                }
                .ht-hero-inner { max-width: 980px; margin: 0 auto; }
                .ht-eyebrow {
                    font-size: 11px; font-weight: 700; letter-spacing: .16em;
                    text-transform: uppercase; color: rgba(255,255,255,0.45); margin-bottom: 10px;
                }
                .ht-title {
                    font-family: 'Playfair Display', serif;
                    font-size: 38px; font-weight: 400; color: #fff;
                    margin-bottom: 8px; line-height: 1.15;
                }
                .ht-sub {
                    font-size: 15px; color: rgba(255,255,255,0.5);
                    font-weight: 300; margin-bottom: 26px; max-width: 560px;
                }

                /* Tabs */
                .ht-tabs { display: flex; gap: 8px; }
                .ht-tab {
                    padding: 9px 22px; border-radius: 50px;
                    border: 1px solid rgba(255,255,255,0.25);
                    background: transparent; font-family: 'Inter', sans-serif;
                    font-size: 13px; font-weight: 600;
                    color: rgba(255,255,255,0.6); cursor: pointer;
                    transition: all .2s; min-height: 40px;
                }
                .ht-tab:hover { border-color: rgba(255,255,255,0.5); color: #fff; }
                .ht-tab.active { background: #fff; border-color: #fff; color: #8C3322; }

                /* Content */
                .ht-content { max-width: 980px; margin: 0 auto; padding: 36px 24px 100px; }
                .ht-error {
                    display: flex; align-items: center; gap: 8px;
                    background: rgba(140,51,34,0.07); border: 1px solid rgba(140,51,34,0.2);
                    border-radius: 10px; padding: 12px 16px; font-size: 14px;
                    color: #8C3322; margin-bottom: 24px;
                }
                .ht-nudge {
                    background: #fff; border: 1px solid #E8D5BC;
                    border-radius: 16px; padding: 40px; text-align: center;
                    box-shadow: 0 2px 14px rgba(62,39,35,0.08);
                }
                .ht-nudge h3 {
                    font-family: 'Playfair Display', serif;
                    font-size: 22px; margin-bottom: 10px; color: #3E2723;
                }
                .ht-nudge p { font-size: 14px; color: rgba(62,39,35,0.55); margin-bottom: 24px; }
                .ht-nudge-btn {
                    display: inline-block; padding: 13px 28px;
                    background: #8C3322; border-radius: 50px;
                    font-weight: 600; font-size: 14px; color: #fff;
                    cursor: pointer; border: none; min-height: 48px;
                }

                /* Filter chips */
                .ht-filter { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
                .ht-filter-label { font-size: 12.5px; color: rgba(62,39,35,0.55); font-weight: 600; }
                .ht-chip {
                    padding: 4px 12px; border-radius: 20px; font-size: 11.5px;
                    font-weight: 600; background: #FDF5EE; color: #8C3322;
                    border: 1px solid rgba(140,51,34,0.2);
                }
                .ht-personality-badge {
                    background: #FDF5EE; border: 1px solid #E8D5BC;
                    border-radius: 10px; padding: 8px 14px; font-size: 13px;
                    color: #3E2723; margin-bottom: 22px;
                    display: inline-flex; align-items: center; gap: 8px;
                }

                /* Location section */
                .ht-location-section { margin-bottom: 40px; }
                .ht-location-header {
                    display: flex; align-items: center; gap: 12px;
                    margin-bottom: 18px; padding-bottom: 12px;
                    border-bottom: 2px solid #E8D5BC;
                }
                .ht-location-pin {
                    width: 32px; height: 32px; border-radius: 50%;
                    background: #8C3322; display: flex; align-items: center;
                    justify-content: center; font-size: 14px; flex-shrink: 0;
                }
                .ht-location-name {
                    font-family: 'Playfair Display', serif;
                    font-size: 20px; color: #3E2723; font-weight: 500;
                }
                .ht-location-count {
                    font-size: 12px; color: rgba(62,39,35,0.45);
                    background: #F0E5D8; border-radius: 20px;
                    padding: 3px 10px; font-weight: 600;
                }
                .ht-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(280px,1fr)); gap: 18px; }

                /* Hotel card */
                .ht-card {
                    background: #FFFFFF; border: 1.5px solid #E8D5BC;
                    border-radius: 18px; overflow: hidden;
                    box-shadow: 0 2px 14px rgba(62,39,35,0.08);
                    color: #3E2723; animation: cardIn .35s ease both;
                    transition: box-shadow .2s, transform .2s;
                }
                .ht-card:hover { box-shadow: 0 10px 32px rgba(62,39,35,0.14); transform: translateY(-3px); }
                .ht-card-body { padding: 18px; }
                .ht-card-name { font-family: 'Playfair Display', serif; font-size: 16px; color: #3E2723; margin-bottom: 4px; }
                .ht-card-loc { font-size: 12px; color: rgba(62,39,35,0.5); margin-bottom: 12px; }
                .ht-price-row { display: flex; align-items: baseline; gap: 6px; margin-bottom: 4px; }
                .ht-price { font-family: 'Playfair Display', serif; font-size: 18px; color: #8C3322; font-weight: 400; }
                .ht-price-label { font-size: 11px; color: rgba(62,39,35,0.4); }
                .ht-nights-calc { font-size: 12px; color: rgba(62,39,35,0.45); margin-bottom: 14px; }
                .ht-btn-save {
                    width: 100%; padding: 12px; border: none; border-radius: 50px;
                    background: #8C3322; font-family: 'Inter', sans-serif;
                    font-size: 13.5px; font-weight: 700; color: #fff;
                    cursor: pointer; transition: opacity .2s; min-height: 44px;
                }
                .ht-btn-save:hover { opacity: 0.88; }

                /* Saved tab */
                .ht-saved-card {
                    background: #FFFFFF; border: 1.5px solid #E8D5BC;
                    border-radius: 18px; overflow: hidden;
                    box-shadow: 0 2px 14px rgba(62,39,35,0.08);
                    color: #3E2723; animation: cardIn .35s ease both;
                }
                .ht-saved-body { padding: 18px; }
                .ht-dates-row { display: flex; gap: 14px; font-size: 12px; color: rgba(62,39,35,0.5); margin-bottom: 10px; flex-wrap: wrap; }
                .ht-budget-badge {
                    background: #FDF5EE; border: 1px solid #E8D5BC;
                    border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;
                }
                .ht-budget-formula { font-size: 11.5px; color: rgba(62,39,35,0.45); margin-bottom: 4px; }
                .ht-budget-total { font-family: 'Playfair Display', serif; font-size: 19px; color: #8C3322; }
                .ht-btn-del {
                    padding: 8px 14px; border: 1px solid rgba(140,51,34,0.25);
                    border-radius: 50px; background: rgba(140,51,34,0.06);
                    font-size: 12.5px; color: #8C3322; cursor: pointer;
                    transition: background .2s; font-family: 'Inter', sans-serif;
                    font-weight: 500;
                }
                .ht-btn-del:hover { background: rgba(140,51,34,0.12); }

                /* Grand total bar */
                .ht-grand-total {
                    background: #8C3322; border-radius: 14px; padding: 18px 22px;
                    margin-bottom: 24px; display: flex; justify-content: space-between;
                    align-items: center; color: #fff;
                }
                .ht-grand-label { font-size: 13.5px; color: rgba(255,255,255,0.6); }
                .ht-grand-value { font-family: 'Playfair Display', serif; font-size: 22px; color: #D4A373; }
            `}</style>

            {/* Hero */}
            <div className="ht-hero">
                <div className="ht-hero-inner">
                    <p className="ht-eyebrow">Step 2 — Hotel Selection</p>
                    <h1 className="ht-title">Find your perfect stay</h1>
                    <p className="ht-sub">
                        Hotels matched to your personality across your chosen destinations.
                        Budget is calculated from your dates and number of guests.
                    </p>
                    <div className="ht-tabs">
                        <button
                            className={`ht-tab ${tab === "search" ? "active" : ""}`}
                            onClick={() => { setTab("search"); loadRecommendations(); }}
                        >
                            Recommended
                        </button>
                        <button
                            className={`ht-tab ${tab === "saved" ? "active" : ""}`}
                            onClick={() => { setTab("saved"); loadSaved(); }}
                        >
                            My Saved Hotels
                        </button>
                    </div>
                </div>
            </div>

            <div className="ht-content">
                {error && (
                    error.includes("quiz") ? (
                        <div className="ht-nudge">
                            <h3>Complete your personality quiz first 🧭</h3>
                            <p>We need your OCEAN scores to recommend hotels tailored to you.</p>
                            <button className="ht-nudge-btn" onClick={() => navigate("/quiz")}>Take the Quiz →</button>
                        </div>
                    ) : (
                        <div className="ht-error">⚠️ {error}</div>
                    )
                )}

                {/* RECOMMENDED TAB */}
                {tab === "search" && !error && (
                    <>
                        {personalityType && (
                            <div className="ht-personality-badge">
                                Matched to your personality: <strong>{personalityType}</strong>
                            </div>
                        )}

                        {locationsUsed.length > 0 && (
                            <div className="ht-filter">
                                <span className="ht-filter-label">Filtered by your locations:</span>
                                {locationsUsed.map(l => <span key={l} className="ht-chip">{l}</span>)}
                            </div>
                        )}

                        {loading ? <Skeleton /> : hotels.length === 0 ? (
                            <div style={{ background: "#fff", border: "1px solid #E8D5BC", borderRadius: 14, padding: "40px 28px", textAlign: "center" }}>
                                <p style={{ fontSize: 40, marginBottom: 14 }}>🏨</p>
                                <p style={{ fontSize: 15, marginBottom: 18, color: "rgba(62,39,35,0.55)" }}>No hotels found. Save some locations first.</p>
                                <button onClick={() => navigate("/locations")}
                                        style={{ padding: "12px 24px", background: "#8C3322", border: "none", borderRadius: 50, fontWeight: 700, fontSize: 14, color: "#fff", cursor: "pointer", minHeight: 48 }}>
                                    Go to Locations →
                                </button>
                            </div>
                        ) : (
                            <>
                                {grouped.map(([city, cityHotels], groupIdx) => (
                                    <div key={city} className="ht-location-section">
                                        <div className="ht-location-header">
                                            <div className="ht-location-pin">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                            </div>
                                            <span className="ht-location-name">{city}</span>
                                            <span className="ht-location-count">
                                                {cityHotels.length} hotel{cityHotels.length !== 1 ? "s" : ""}
                                            </span>
                                        </div>
                                        <div className="ht-grid">
                                            {cityHotels.map((hotel, i) => (
                                                <HotelCard
                                                    key={hotel.hotel_id}
                                                    hotel={hotel}
                                                    quizDays={quizDays}
                                                    onBook={setSaveTarget}
                                                    style={{ animationDelay: `${(groupIdx * 3 + i) * 0.05}s` }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </>
                )}

                {/* SAVED TAB */}
                {tab === "saved" && (
                    loading ? <Skeleton /> : saved.length === 0 ? (
                        <div style={{ background: "#fff", border: "1px solid #E8D5BC", borderRadius: 14, padding: "40px 28px", textAlign: "center" }}>
                            <p style={{ fontSize: 40, marginBottom: 14 }}>❤️</p>
                            <p style={{ fontSize: 15, color: "rgba(62,39,35,0.55)" }}>You haven't saved any hotels yet.</p>
                        </div>
                    ) : (
                        <>
                            <div className="ht-grand-total">
                                <div>
                                    <div className="ht-grand-label">Total hotel budget across all bookings</div>
                                    <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                                        {saved.length} hotel{saved.length !== 1 ? "s" : ""} booked
                                    </div>
                                </div>
                                <div className="ht-grand-value">
                                    {fmtLKR(saved.reduce((s, h) => s + h.total_budget, 0))}
                                </div>
                            </div>

                            <div className="ht-grid">
                                {saved.map((hotel, i) => (
                                    <div key={hotel.id} className="ht-saved-card" style={{ animationDelay: `${i * 0.05}s` }}>
                                        <HotelImage hotelId={hotel.hotel_id} name={hotel.name} />
                                        <div className="ht-saved-body">
                                            <div className="ht-card-name">{hotel.name}</div>
                                            <div className="ht-card-loc">{hotel.location}</div>
                                            <div className="ht-dates-row">
                                                {hotel.check_in  && <span>In: <strong>{hotel.check_in}</strong></span>}
                                                {hotel.check_out && <span>Out: <strong>{hotel.check_out}</strong></span>}
                                                {hotel.num_people > 0 && <span>{hotel.num_people} guest{hotel.num_people !== 1 ? "s" : ""}</span>}
                                            </div>
                                            <div className="ht-budget-badge">
                                                <div className="ht-budget-formula">
                                                    {hotel.budget_per_night > 0 && hotel.nights > 0
                                                        ? `${fmtLKR(hotel.budget_per_night)} × ${hotel.nights} nights × ${hotel.num_people} guest${hotel.num_people !== 1 ? "s" : ""}`
                                                        : "Total booking cost"}
                                                </div>
                                                <div className="ht-budget-total">
                                                    {fmtLKR(hotel.total_budget)}
                                                    <span style={{ fontSize: 11, color: "rgba(62,39,35,0.4)", fontWeight: 400, marginLeft: 6 }}>
                                                        ~{fmtUSD(lkrToUsd(hotel.total_budget))}
                                                    </span>
                                                </div>
                                            </div>
                                            <button className="ht-btn-del" onClick={() => handleDelete(hotel.id)}>
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
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

            {saveTarget && (
                <SaveModal
                    hotel={saveTarget}
                    onClose={() => setSaveTarget(null)}
                    onSaved={() => {
                        setHasSaved(true);
                        API.get("/hotels/saved").catch(() => {});
                    }}
                />
            )}
        </Layout>
    );
}
