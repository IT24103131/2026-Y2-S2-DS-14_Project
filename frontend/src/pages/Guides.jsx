import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Layout from "../components/Layout";
import NextStepBanner from "../components/NextStepBanner";
import { fmtLKR, lkrToUsd, fmtUSD } from "../utils/currency";

// ─────────────────────────────────────────────────────────────────────────────
// Guides.jsx — Vibe Lanka design system
// Layout wrapper, rust hero, white guide cards, gold match badge
// ─────────────────────────────────────────────────────────────────────────────

const LANGUAGES = [
    { key: "Sinhala", icon: "🌿" },
    { key: "Tamil",   icon: "🌺" },
    { key: "English", icon: "🌐" },
    { key: "All",     icon: "✨" },
];

const TIER_LABEL = { Top: "⭐ Top Guide", Good: "✓ Good Match", Average: "Match" };

function GuideCard({ guide, onBook, isBooking }) {
    const matchPct = guide.confidence || guide.ocean_similarity || 0;
    return (
        <div style={{
            background: "#FFFFFF",
            border: "1.5px solid #E8D5BC",
            borderRadius: 18, overflow: "hidden",
            boxShadow: "0 2px 14px rgba(62,39,35,0.08)",
            color: "#3E2723",
            animation: "cardIn 0.35s ease both",
            transition: "box-shadow 0.2s, transform 0.2s",
        }}
             onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 10px 30px rgba(62,39,35,0.14)"; }}
             onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 14px rgba(62,39,35,0.08)"; }}
        >
            <div style={{ padding: 22 }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div>
                        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 400, color: "#3E2723", marginBottom: 4 }}>{guide.name}</div>
                        <div style={{ fontSize: 12, color: "rgba(62,39,35,0.5)" }}>📍 {guide.base_location}</div>
                    </div>
                    <span style={{ background: "#FDF5EE", color: "#8C3322", fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 8, border: "1px solid #E8D5BC" }}>
                        {TIER_LABEL[guide.tier_label] || "Match"}
                    </span>
                </div>

                {/* Vibe badge */}
                {guide.vibe_label && (
                    <div style={{ marginBottom: 14 }}>
                        <span style={{ background: "rgba(140,51,34,0.06)", color: "#8C3322", fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 8, border: "1px solid rgba(140,51,34,0.15)", textTransform: "capitalize" }}>
                            {guide.vibe_label}
                        </span>
                    </div>
                )}

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                    {[
                        { val: `⭐ ${guide.rating}`, label: "Rating" },
                        { val: fmtLKR(guide.daily_rate), label: "Per Day" },
                        { val: `${matchPct.toFixed(0)}%`, label: "Match", color: "#D4A373" },
                    ].map(({ val, label, color }) => (
                        <div key={label} style={{ background: "rgba(62,39,35,0.04)", borderRadius: 10, padding: "10px 8px", textAlign: "center", border: "1px solid #E8D5BC" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: color || "#3E2723" }}>{val}</div>
                            <div style={{ fontSize: 10, color: "rgba(62,39,35,0.45)", marginTop: 2 }}>{label}</div>
                        </div>
                    ))}
                </div>

                {/* Language + budget */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 18 }}>
                    <span style={{ background: "#FDF5EE", color: "rgba(62,39,35,0.75)", fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 8, border: "1px solid #E8D5BC" }}>
                        🗣 {guide.language_spoken}
                    </span>
                    {guide.estimated_budget > 0 && (
                        <span style={{ background: "#FDF5EE", color: "rgba(62,39,35,0.75)", fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 8, border: "1px solid #E8D5BC" }}>
                            💰 {fmtLKR(guide.estimated_budget)} / ~{fmtUSD(lkrToUsd(guide.estimated_budget))} total
                        </span>
                    )}
                </div>

                {/* Book button */}
                <button onClick={() => onBook(guide)} disabled={isBooking}
                        style={{ width: "100%", background: "#8C3322", border: "none", borderRadius: 50, padding: "13px", fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14, color: "#fff", cursor: isBooking ? "not-allowed" : "pointer", opacity: isBooking ? 0.5 : 1, transition: "opacity 0.2s", minHeight: 48 }}>
                    {isBooking ? "Booking…" : "Book This Guide →"}
                </button>
            </div>
        </div>
    );
}

function Skeleton() {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
            {[...Array(3)].map((_, i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid #E8D5BC", borderRadius: 18, padding: 22, opacity: 0.5 }}>
                    <div style={{ height: 17, width: "70%", background: "#F0E5D8", borderRadius: 6, marginBottom: 10 }} />
                    <div style={{ height: 11, width: "50%", background: "#F0E5D8", borderRadius: 6, marginBottom: 20 }} />
                    <div style={{ height: 56, background: "#F0E5D8", borderRadius: 10, marginBottom: 14 }} />
                    <div style={{ height: 40, background: "#F0E5D8", borderRadius: 10 }} />
                </div>
            ))}
        </div>
    );
}

export default function Guides() {
    const navigate = useNavigate();
    const [language, setLanguage]           = useState("");
    const [guides, setGuides]               = useState([]);
    const [loading, setLoading]             = useState(false);
    const [booking, setBooking]             = useState(false);
    const [error, setError]                 = useState("");
    const [message, setMessage]             = useState("");
    const [searched, setSearched]           = useState(false);
    const [activeBooking, setActiveBooking] = useState(null);
    const [checkingBooking, setChecking]    = useState(true);
    const [hasBooked, setHasBooked]         = useState(false);

    useEffect(() => {
        API.get("/guides/booking")
            .then(res => {
                setActiveBooking(res.data);
                if (res.data?.current_status === "confirmed") setHasBooked(true);
            })
            .catch(() => setActiveBooking(null))
            .finally(() => setChecking(false));
    }, []);

    const handleSearch = async () => {
        if (!language) { setError("Please select a language."); return; }
        setError(""); setMessage(""); setGuides([]); setSearched(false); setLoading(true);
        try {
            const res = await API.get(`/guides/recommend?language=${encodeURIComponent(language)}`);
            setGuides(res.data.guides || []);
            setMessage(res.data.message || "");
            setSearched(true);
        } catch (err) {
            setError(err?.response?.data?.detail || "Could not load guides.");
            setSearched(true);
        } finally {
            setLoading(false);
        }
    };

    const handleBook = async (guide) => {
        setBooking(true);
        setError("");
        try {
            await API.post("/guides/book", {
                guide_id:         guide.guide_id,
                name:             guide.name,
                language:         guide.language_spoken,
                estimated_budget: guide.estimated_budget,
            });
            setHasBooked(true);
            navigate("/guides/mybooking");
        } catch (err) {
            setError(err?.response?.data?.detail || "Booking failed.");
            setBooking(false);
        }
    };

    return (
        <Layout>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
                @keyframes cardIn { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)} }

                .gd-hero {
                    background: #8C3322;
                    padding: 40px 32px 32px;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .gd-hero-inner { max-width: 960px; margin: 0 auto; }
                .gd-eyebrow {
                    font-size: 11px; font-weight: 700; letter-spacing: 0.14em;
                    text-transform: uppercase; color: rgba(255,255,255,0.5); margin-bottom: 10px;
                }
                .gd-title {
                    font-family: 'Playfair Display', serif;
                    font-size: 36px; font-weight: 500; color: #fff;
                    letter-spacing: -0.3px; margin-bottom: 8px;
                }
                .gd-sub { font-size: 15px; color: rgba(255,255,255,0.55); font-weight: 300; margin-bottom: 24px; }

                .gd-lang-row { display: flex; gap: 10px; flex-wrap: wrap; }
                .gd-lang-btn {
                    padding: 10px 20px; border-radius: 50px;
                    border: 1px solid rgba(255,255,255,0.25);
                    background: transparent; font-family: 'Inter', sans-serif;
                    font-size: 13px; font-weight: 600;
                    color: rgba(255,255,255,0.65); cursor: pointer;
                    transition: all 0.2s;
                    min-height: 44px;
                }
                .gd-lang-btn:hover { border-color: rgba(255,255,255,0.6); color: #fff; }
                .gd-lang-btn.active {
                    background: #fff; border-color: #fff; color: #8C3322;
                }

                .gd-content { max-width: 960px; margin: 0 auto; padding: 32px 24px 80px; }

                .gd-error {
                    display: flex; align-items: center; gap: 8px;
                    background: rgba(140,51,34,0.07); border: 1px solid rgba(140,51,34,0.2);
                    border-radius: 10px; padding: 12px 16px; font-size: 14px;
                    color: #8C3322; margin-bottom: 24px;
                }

                .gd-banner {
                    background: #FDF5EE; border: 1.5px solid #D4A373;
                    border-radius: 14px; padding: 20px 24px; margin-bottom: 24px;
                    display: flex; align-items: flex-start; gap: 14px;
                    box-shadow: 0 2px 14px rgba(62,39,35,0.08);
                }
                .gd-banner-title { font-size: 15px; font-weight: 700; color: #8C3322; margin-bottom: 4px; }
                .gd-banner-sub { font-size: 13.5px; color: rgba(62,39,35,0.65); }

                .gd-search-btn {
                    display: block; margin: 24px auto 0;
                    padding: 14px 44px;
                    background: #fff; border: none; border-radius: 50px;
                    font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 700;
                    color: #8C3322; cursor: pointer;
                    box-shadow: 0 4px 14px rgba(255,255,255,0.2);
                    transition: opacity 0.2s, transform 0.15s;
                    min-height: 52px;
                }
                .gd-search-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
                .gd-search-btn:disabled { opacity: 0.45; cursor: not-allowed; }

                .gd-nudge {
                    background: #fff; border: 1px solid #E8D5BC;
                    border-radius: 14px; padding: 36px; text-align: center;
                    box-shadow: 0 2px 14px rgba(62,39,35,0.08);
                }
                .gd-nudge h3 {
                    font-family: 'Playfair Display', serif;
                    font-size: 22px; margin-bottom: 10px; color: #3E2723;
                }
                .gd-nudge p { font-size: 14px; color: rgba(62,39,35,0.55); margin-bottom: 22px; }
                .gd-nudge-btn {
                    display: inline-block; padding: 13px 28px;
                    background: #8C3322; border-radius: 50px;
                    font-weight: 600; font-size: 14px; color: #fff;
                    cursor: pointer; border: none; min-height: 48px;
                }

                .gd-results-header {
                    display: flex; align-items: center; justify-content: space-between;
                    margin-bottom: 16px;
                }
                .gd-results-label { font-size: 14px; font-weight: 600; color: rgba(62,39,35,0.65); }
                .gd-results-count {
                    font-size: 12px; color: rgba(62,39,35,0.45);
                    background: #F0E5D8; border-radius: 20px; padding: 3px 10px;
                }

                .gd-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(280px,1fr)); gap: 16px; }

                .gd-empty {
                    text-align: center; padding: 56px 24px;
                    color: rgba(62,39,35,0.45);
                    background: #fff; border: 1px solid #E8D5BC;
                    border-radius: 14px;
                }

                @media(max-width:600px){
                    .gd-title{font-size:26px}
                    .gd-content{padding:24px 16px 60px}
                }
            `}</style>

            {/* Hero */}
            <div className="gd-hero">
                <div className="gd-hero-inner">
                    <p className="gd-eyebrow">Step 4 — Guide Selection</p>
                    <h1 className="gd-title">Find your perfect guide</h1>
                    <p className="gd-sub">
                        Our AI matches guides to your personality profile and chosen destinations.
                        Select your preferred language to get started.
                    </p>
                    <div className="gd-lang-row">
                        {LANGUAGES.map(({ key, icon }) => (
                            <button key={key} className={`gd-lang-btn ${language === key ? "active" : ""}`}
                                    onClick={() => { setLanguage(key); setError(""); }}>
                                {icon} {key}
                            </button>
                        ))}
                    </div>
                    <button className="gd-search-btn" onClick={handleSearch}
                            disabled={loading || !language || checkingBooking}>
                        {loading ? "Finding guides…" : "✨ Find My Guide"}
                    </button>
                </div>
            </div>

            <div className="gd-content">

                {/* Active booking warning */}
                {activeBooking && activeBooking.current_status === "confirmed" && (
                    <div className="gd-banner">
                        <span style={{ fontSize: 24 }}>🔒</span>
                        <div>
                            <div className="gd-banner-title">You already have an active booking!</div>
                            <div className="gd-banner-sub">
                                You've booked <strong>{activeBooking.name}</strong> based in{" "}
                                <strong>{activeBooking.base_location}</strong>.
                                Cancel your current booking to select a different guide.
                                <br /><br />
                                <button style={{ background: "#8C3322", border: "none", borderRadius: 50, padding: "10px 20px", fontWeight: 700, fontSize: 13, color: "#fff", cursor: "pointer", minHeight: 44 }}
                                        onClick={() => navigate("/guides/mybooking")}>
                                    Manage My Booking →
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    error.includes("quiz") ? (
                        <div className="gd-nudge">
                            <h3>Complete your personality quiz first 🧭</h3>
                            <p>We need your OCEAN profile to recommend the right guides for you.</p>
                            <button className="gd-nudge-btn" onClick={() => navigate("/quiz")}>Take the Quiz →</button>
                        </div>
                    ) : (
                        <div className="gd-error">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            {error}
                        </div>
                    )
                )}

                {loading && <Skeleton />}

                {!loading && searched && guides.length > 0 && (
                    <>
                        <div className="gd-results-header">
                            <span className="gd-results-label">{message || "Top matches for you"}</span>
                            <span className="gd-results-count">{guides.length} guide{guides.length !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="gd-grid">
                            {guides.map((guide, i) => (
                                <div key={guide.guide_id} style={{ position: "relative" }}>
                                    {i === 0 && (
                                        <div style={{ position: "absolute", top: -12, left: 16, zIndex: 10, background: "#8C3322", color: "#D4A373", fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 8 }}>
                                            ⭐ Best Match
                                        </div>
                                    )}
                                    <GuideCard guide={guide} onBook={handleBook} isBooking={booking} />
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {!loading && searched && guides.length === 0 && !error && (
                    <div className="gd-empty">
                        <p style={{ fontSize: 40, marginBottom: 12 }}>😔</p>
                        <p style={{ fontSize: 15, marginTop: 12, color: "rgba(62,39,35,0.55)" }}>
                            No available guides found for the selected language. Try a different option.
                        </p>
                    </div>
                )}
            </div>

            <NextStepBanner
                step={3}
                done={hasBooked}
                nextPath="/itineraries/plan"
                nextLabel="Create Your Itinerary →"
                nextSub="Step 4 of 4 — Final step!"
                locked={!hasBooked}
                lockedMsg="Book a guide first"
            />
        </Layout>
    );
}
