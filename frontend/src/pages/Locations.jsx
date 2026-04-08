import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Navbar from "../components/Navbar";

// ─────────────────────────────────────────────────────────────────────────────
// Locations.jsx  –  Member 3 Location Suggestor, integrated into VibeLanka React
//
// Replaces member 3's standalone index.html.
// Uses your existing API instance (JWT auto-attached, port 8000).
//
// Endpoints used:
//   GET  /locations/me            → locations for current user's personality type
//   POST /locations/save-selection → save chosen destinations
//   GET  /locations/selection      → restore previously saved selection
// ─────────────────────────────────────────────────────────────────────────────

const PERSONALITY_META = {
    "adventurous explorer": { icon: "🧭", label: "Adventurous Explorer", desc: "Adventure seeker who loves discovering new places, wildlife, and dramatic landscapes." },
    "balanced traveler":    { icon: "⚖️", label: "Balanced Traveler",    desc: "A perfect mix of calm coastlines and cultural depth, paced just right for you."      },
    "friendly cultural":    { icon: "🤝", label: "Friendly Cultural",    desc: "Sacred sites, welcoming communities, and rich Sri Lankan traditions await."           },
    "organized sightseer":  { icon: "📍", label: "Organized Sightseer",  desc: "Well-structured city visits and UNESCO heritage sites, ideal for methodical explorers." },
    "calm & relaxed":       { icon: "🌊", label: "Calm & Relaxed",       desc: "Quiet beaches and laid-back coastal towns to recharge and unwind."                   },
};

function getIcon(name = "") {
    const n = name.toLowerCase();
    if (/national park|yala|wilpattu|kumana|udawalawe|minneriya/.test(n)) return "🐘";
    if (/beach|hikkaduwa|mirissa|tangalle|nilaveli|arugam|weligama|bentota|beruwala|kalutara|induruwa|balapitiya|kosgoda|ahungalla|ambalangoda|moragalla|negombo|unawatuna|passikuda|talalla/.test(n)) return "🏖️";
    if (/sigiriya|pidurangala|ella|ritigala|adam/.test(n)) return "🏔️";
    if (/anuradhapura|polonnaruwa|mihintale|tissamaharama|dambulla/.test(n)) return "🏛️";
    if (/kandy|peradeniya|nuwara eliya|habarana/.test(n)) return "🌿";
    if (/galle/.test(n)) return "⚓";
    if (/trincomalee/.test(n)) return "🌊";
    if (/kataragama/.test(n)) return "🪔";
    if (/colombo/.test(n)) return "🏙️";
    if (/ratnapura/.test(n)) return "💎";
    return "📍";
}

function getExpType(name = "") {
    const n = name.toLowerCase();
    if (/national park|wildlife|yala|wilpattu|kumana|udawalawe|minneriya/.test(n)) return "Wildlife Safari";
    if (/beach|hikkaduwa|mirissa|tangalle|nilaveli|arugam|weligama|unawatuna|bentota/.test(n)) return "Beach & Surf";
    if (/sigiriya|pidurangala|ella|ritigala/.test(n)) return "Hiking & Trekking";
    if (/anuradhapura|polonnaruwa|mihintale|dambulla|kataragama|peradeniya/.test(n)) return "Heritage & Culture";
    return "Sightseeing";
}

function Skeleton() {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
            {[...Array(6)].map((_, i) => (
                <div key={i} style={{ background: "#4d8a82", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 14, padding: 20, opacity: 0.5 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.2)", marginBottom: 14, animation: "pulse 1.2s infinite" }} />
                    <div style={{ height: 10, width: "50%", background: "rgba(255,255,255,0.15)", borderRadius: 6, marginBottom: 8 }} />
                    <div style={{ height: 18, width: "80%", background: "rgba(255,255,255,0.2)", borderRadius: 6, marginBottom: 10 }} />
                    <div style={{ height: 10, width: "100%", background: "rgba(255,255,255,0.12)", borderRadius: 6 }} />
                </div>
            ))}
        </div>
    );
}

export default function Locations() {
    const navigate = useNavigate();

    const [loading, setLoading]         = useState(true);
    const [locations, setLocations]     = useState([]);
    const [personalityType, setPersonalityType] = useState("");
    const [selected, setSelected]       = useState(new Set());
    const [activeProvince, setActiveProv] = useState("All");
    const [saving, setSaving]           = useState(false);
    const [saved, setSaved]             = useState(false);
    const [error, setError]             = useState("");

    // Load locations for the logged-in user's personality type
    useEffect(() => {
        setLoading(true);
        // First restore any previously saved selection
        API.get("/locations/selection").then(res => {
            if (res.data.selected_destinations?.length) {
                setSelected(new Set(res.data.selected_destinations));
            }
        }).catch(() => {});

        // Load matching locations
        API.get("/locations/me")
            .then(res => {
                setLocations(res.data.locations || []);
                setPersonalityType(res.data.personality_type || "");
            })
            .catch(err => {
                const msg = err?.response?.data?.detail || "Could not load locations.";
                setError(msg);
            })
            .finally(() => setLoading(false));
    }, []);

    const meta = PERSONALITY_META[personalityType] || {};

    // Province filter
    const provinces = ["All", ...Array.from(new Set(locations.map(l => l.province))).sort()];
    const visible = activeProvince === "All"
        ? locations
        : locations.filter(l => l.province === activeProvince);

    const toggleSelect = (locationName) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(locationName)) next.delete(locationName);
            else next.add(locationName);
            return next;
        });
        setSaved(false);
    };

    const handleSave = async () => {
        if (selected.size === 0) return;
        setSaving(true);
        setError("");
        try {
            await API.post("/locations/save-selection", {
                selected_destinations: Array.from(selected),
            });
            setSaved(true);
        } catch (err) {
            setError(err?.response?.data?.detail || "Could not save. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
                @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
                @keyframes fadeUp { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)} }
                @keyframes cardIn { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)} }

                .loc-root { min-height: 100vh; background: #e8f0ef; font-family: 'DM Sans', sans-serif; }

                /* ── Hero ── */
                .loc-hero { background: #2d4a47; padding: 40px 32px 32px; border-bottom: 1px solid rgba(255,255,255,0.08); }
                .loc-hero-inner { max-width: 960px; margin: 0 auto; }
                .loc-eyebrow { font-size: 10.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(232,240,239,0.45); margin-bottom: 10px; }
                .loc-title { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 500; color: #e8f0ef; letter-spacing: -0.3px; line-height: 1.05; margin-bottom: 8px; }
                .loc-sub { font-size: 13.5px; color: rgba(232,240,239,0.5); font-weight: 300; }
                .vibe-pill { display: inline-flex; align-items: center; gap: 8px; margin-top: 16px; background: rgba(255,204,0,0.12); border: 1px solid rgba(255,204,0,0.3); border-radius: 20px; padding: 7px 14px; font-size: 13px; font-weight: 600; color: #ffcc00; }

                /* ── Content ── */
                .loc-content { max-width: 960px; margin: 0 auto; padding: 32px 24px 80px; }

                /* ── Error ── */
                .loc-error { display: flex; align-items: center; gap: 8px; background: rgba(139,26,26,0.18); border: 1px solid rgba(139,26,26,0.35); border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #ffb4b4; margin-bottom: 24px; }
                .loc-quiz-nudge { background: #4d8a82; border: 1px solid rgba(255,255,255,0.18); border-radius: 14px; padding: 32px; text-align: center; color: #ffffff; }
                .loc-quiz-nudge h3 { font-family: 'Playfair Display', serif; font-size: 22px; margin-bottom: 10px; }
                .loc-quiz-nudge p { font-size: 13.5px; color: rgba(255,255,255,0.6); margin-bottom: 22px; }
                .loc-quiz-btn { display: inline-block; padding: 12px 24px; background: #ffcc00; border-radius: 10px; font-weight: 700; font-size: 13.5px; color: #1a2e2b; text-decoration: none; cursor: pointer; border: none; }

                /* ── Province filter ── */
                .prov-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
                .prov-chip { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid rgba(45,74,71,0.25); background: #ffffff; color: rgba(26,46,43,0.7); transition: all 0.18s; user-select: none; }
                .prov-chip:hover { border-color: #4d8a82; color: #2d4a47; }
                .prov-chip.active { background: #2d4a47; color: #e8f0ef; border-color: #2d4a47; }

                /* ── Cards grid ── */
                .loc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; margin-bottom: 28px; }

                .loc-card { background: #4d8a82; border: 1.5px solid rgba(255,255,255,0.16); border-radius: 14px; padding: 20px; cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s, transform 0.18s; color: #ffffff; position: relative; animation: cardIn 0.35s ease both; }
                .loc-card:hover { border-color: #ffcc00; box-shadow: 0 6px 24px rgba(29,58,54,0.2); transform: translateY(-2px); }
                .loc-card.selected { border-color: #ffcc00; box-shadow: 0 0 0 3px rgba(255,204,0,0.2), 0 6px 24px rgba(29,58,54,0.15); }
                .loc-card.selected::after { content: '✓'; position: absolute; top: 12px; right: 12px; width: 22px; height: 22px; border-radius: 50%; background: #ffcc00; color: #1a2e2b; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; line-height: 22px; text-align: center; }

                .card-icon { font-size: 26px; margin-bottom: 10px; display: block; }
                .card-province { display: inline-flex; align-items: center; font-size: 9px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: #ffcc00; background: rgba(255,204,0,0.1); border: 1px solid rgba(255,204,0,0.25); padding: 2px 8px; border-radius: 20px; margin-bottom: 7px; }
                .card-name { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 400; color: #ffffff; margin-bottom: 3px; line-height: 1.2; }
                .card-district { font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 10px; }
                .card-tag { display: inline-block; font-size: 10px; font-weight: 500; padding: 3px 8px; border-radius: 20px; background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.15); }

                /* ── Confirm bar ── */
                .confirm-bar { position: sticky; bottom: 24px; background: #2d4a47; border: 1.5px solid rgba(255,204,0,0.4); border-radius: 14px; padding: 16px 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px; box-shadow: 0 8px 32px rgba(29,58,54,0.35); animation: fadeUp 0.28s ease; }
                .confirm-left { display: flex; align-items: center; gap: 12px; }
                .confirm-count { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 400; color: #ffffff; }
                .confirm-sub { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 2px; }
                .confirm-actions { display: flex; gap: 10px; flex-shrink: 0; }
                .btn-save { padding: 11px 22px; border: none; border-radius: 10px; background: #ffcc00; font-family: 'DM Sans', sans-serif; font-size: 13.5px; font-weight: 700; color: #1a2e2b; cursor: pointer; transition: background 0.2s, transform 0.15s; display: flex; align-items: center; gap: 6px; }
                .btn-save:hover:not(:disabled) { background: #e6b800; transform: translateY(-1px); }
                .btn-save:disabled { opacity: 0.45; cursor: not-allowed; }
                .btn-clear { padding: 11px 18px; border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; background: transparent; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.6); cursor: pointer; transition: border-color 0.2s, color 0.2s; }
                .btn-clear:hover { border-color: rgba(255,255,255,0.5); color: #ffffff; }

                /* ── Success banner ── */
                .success-banner { background: rgba(255,204,0,0.12); border: 1px solid rgba(255,204,0,0.3); border-radius: 12px; padding: 16px 20px; display: flex; align-items: center; gap: 12px; margin-bottom: 20px; animation: fadeUp 0.3s ease; }
                .success-text { font-size: 14px; color: #ffcc00; font-weight: 600; }
                .success-sub  { font-size: 12px; color: rgba(255,204,0,0.7); margin-top: 2px; }

                /* ── Empty ── */
                .loc-empty { text-align: center; padding: 60px 24px; color: rgba(255,255,255,0.5); }
                .loc-empty svg { margin: 0 auto 16px; display: block; opacity: 0.3; }

                /* ── Count badge ── */
                .results-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
                .results-label { font-size: 13px; font-weight: 600; color: rgba(26,46,43,0.7); }
                .results-count { font-size: 12px; color: rgba(26,46,43,0.5); background: rgba(45,74,71,0.1); border-radius: 20px; padding: 3px 10px; }

                @media (max-width: 600px) {
                    .loc-title { font-size: 26px; }
                    .loc-content { padding: 24px 16px 60px; }
                    .confirm-bar { flex-direction: column; align-items: stretch; gap: 12px; }
                    .confirm-actions { justify-content: flex-end; }
                }
            `}</style>

            <div className="loc-root">
                <Navbar />

                {/* ── Hero ── */}
                <div className="loc-hero">
                    <div className="loc-hero-inner">
                        <p className="loc-eyebrow">Step 2 — Destination Selection</p>
                        <h1 className="loc-title">Find your perfect destination</h1>
                        <p className="loc-sub">
                            Based on your OCEAN personality, we've matched Sri Lankan destinations
                            that align with your travel vibe. Pick the ones that call to you.
                        </p>
                        {meta.label && (
                            <div className="vibe-pill">
                                <span>{meta.icon}</span>
                                <span>{meta.label}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="loc-content">

                    {error && !error.includes("quiz") && (
                        <div className="loc-error">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            {error}
                        </div>
                    )}

                    {/* Quiz not completed nudge */}
                    {error.includes("quiz") && (
                        <div className="loc-quiz-nudge">
                            <h3>Take your personality quiz first 🧭</h3>
                            <p>We need your personality profile to recommend the right destinations for you.</p>
                            <button className="loc-quiz-btn" onClick={() => navigate("/quiz")}>
                                Take the Quiz →
                            </button>
                        </div>
                    )}

                    {/* Success banner */}
                    {saved && (
                        <div className="success-banner">
                            <span style={{ fontSize: 22 }}>✅</span>
                            <div>
                                <div className="success-text">Destinations saved to your profile!</div>
                                <div className="success-sub">
                                    {selected.size} location{selected.size !== 1 ? "s" : ""} selected: {Array.from(selected).join(", ")}
                                </div>
                            </div>
                        </div>
                    )}

                    {loading && <Skeleton />}

                    {!loading && !error && locations.length > 0 && (
                        <>
                            {/* Province filter */}
                            <div className="prov-row">
                                {provinces.map(p => (
                                    <span
                                        key={p}
                                        className={`prov-chip ${activeProvince === p ? "active" : ""}`}
                                        onClick={() => setActiveProv(p)}
                                    >
                                        {p.replace(" Province", "")}
                                    </span>
                                ))}
                            </div>

                            <div className="results-header">
                                <span className="results-label">Matched destinations</span>
                                <span className="results-count">{visible.length} shown</span>
                            </div>

                            {/* Cards */}
                            <div className="loc-grid">
                                {visible.map((loc, i) => {
                                    const isSelected = selected.has(loc.location);
                                    return (
                                        <div
                                            key={loc.location}
                                            className={`loc-card ${isSelected ? "selected" : ""}`}
                                            style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}
                                            onClick={() => toggleSelect(loc.location)}
                                        >
                                            <span className="card-icon">{getIcon(loc.location)}</span>
                                            <div className="card-province">{(loc.province || "Sri Lanka").replace(" Province", "")}</div>
                                            <div className="card-name">{loc.location}</div>
                                            <div className="card-district">{loc.district || "Sri Lanka"}</div>
                                            <span className="card-tag">{getExpType(loc.location)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {!loading && !error && locations.length === 0 && (
                        <div className="loc-empty">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
                            No destinations found for your personality type. Please contact support.
                        </div>
                    )}

                    {/* Sticky confirm bar */}
                    {selected.size > 0 && (
                        <div className="confirm-bar">
                            <div className="confirm-left">
                                <div>
                                    <div className="confirm-count">
                                        {selected.size === 1
                                            ? Array.from(selected)[0]
                                            : `${selected.size} locations selected`}
                                    </div>
                                    <div className="confirm-sub">
                                        Tap save to add {selected.size === 1 ? "this location" : "these locations"} to your profile
                                    </div>
                                </div>
                            </div>
                            <div className="confirm-actions">
                                <button className="btn-clear" onClick={() => { setSelected(new Set()); setSaved(false); }}>
                                    Clear
                                </button>
                                <button className="btn-save" onClick={handleSave} disabled={saving}>
                                    {saving ? (
                                        <><span style={{ width:14,height:14,border:"2px solid rgba(26,46,43,0.25)",borderTopColor:"#1a2e2b",borderRadius:"50%",animation:"pulse 0.7s linear infinite",display:"inline-block" }} /> Saving…</>
                                    ) : saved ? "✅ Saved!" : "Save Selection →"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}