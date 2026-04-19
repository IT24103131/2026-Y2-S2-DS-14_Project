import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import OCEANChart from "../components/OCEANChart";
import Layout from "../components/Layout";

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard.jsx — uses shared Layout sidebar
// Design system: primary-rust #8C3322 · bg-cream #F9F6F0 · surface-white #FFF
//                text-dark #3E2723 · accent-green #4A5D23 · accent-gold #D4A373
// ─────────────────────────────────────────────────────────────────────────────

function getUsername() {
    try {
        const token = localStorage.getItem("token");
        if (!token) return "Traveller";
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.sub || payload.username || payload.name || "Traveller";
    } catch {
        return "Traveller";
    }
}

const PERSONALITY_LABELS = {
    "balanced traveler":    "Balanced Traveller",
    "organized sightseer":  "Organised Sightseer",
    "adventurous explorer": "Adventurous Explorer",
    "friendly cultural":    "Friendly Cultural",
    "calm & relaxed":       "Calm & Relaxed",
};

const TRAIT_COLORS = {
    openness:          "#8C3322",
    conscientiousness: "#4A5D23",
    extraversion:      "#D4A373",
    agreeableness:     "#2E6B5E",
    neuroticism:       "#7A5C3A",
};

export default function Dashboard() {
    const navigate = useNavigate();

    const [personality,   setPersonality]   = useState(null);
    const [journeyStatus, setJourneyStatus] = useState({ locations: false, hotel: false, guide: false });

    const username = getUsername();

    useEffect(() => {
        API.get("/personality").then(res => setPersonality(res.data)).catch(() => {});
        Promise.allSettled([
            API.get("/locations/selection"),
            API.get("/hotels/saved"),
            API.get("/guides/booking"),
        ]).then(([locRes, hotelRes, guideRes]) => {
            setJourneyStatus({
                locations: locRes.status === "fulfilled" && locRes.value.data?.selected_destinations?.length > 0,
                hotel:     hotelRes.status === "fulfilled" && hotelRes.value.data?.saved_hotels?.length > 0,
                guide:     guideRes.status === "fulfilled" && guideRes.value.data?.current_status === "confirmed",
            });
        });
    }, []);

    const oceanTraits = personality?.ocean ? Object.entries(personality.ocean) : [];
    const traitLabels = {
        openness: "Openness", conscientiousness: "Conscientiousness",
        extraversion: "Extraversion", agreeableness: "Agreeableness", neuroticism: "Neuroticism",
    };

    const doneCount = Object.values(journeyStatus).filter(Boolean).length;

    const STEPS = [
        {
            num: 1, label: "Select Locations",
            desc: "Choose destinations that match your personality profile.",
            done: journeyStatus.locations, locked: false,
            path: "/locations",
            btnLabel: journeyStatus.locations ? "Edit Locations" : "Get Started",
        },
        {
            num: 2, label: "Choose Your Hotel",
            desc: "AI-matched hotels curated from your OCEAN scores.",
            done: journeyStatus.hotel, locked: !journeyStatus.locations,
            path: "/hotels",
            btnLabel: journeyStatus.hotel ? "Edit Hotel" : "Browse Hotels",
        },
        {
            num: 3, label: "Find a Guide",
            desc: "Local guides who match your travel style and language.",
            done: journeyStatus.guide, locked: !journeyStatus.hotel,
            path: "/guides",
            btnLabel: journeyStatus.guide ? "Edit Guide" : "Find a Guide",
        },
        {
            num: 4, label: "Build Itinerary",
            desc: "Optimised route with map, daily plan and budget breakdown.",
            done: false, locked: !journeyStatus.guide,
            path: "/itineraries/plan",
            btnLabel: "Generate Itinerary",
        },
    ];

    return (
        <Layout>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap');

                .db-content { max-width: 1040px; margin: 0 auto; padding: 52px 40px 100px; position: relative; z-index: 1; }

                .db-page-header { margin-bottom: 48px; }
                .db-page-eyebrow { font-size: 12px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #8C3322; margin-bottom: 10px; }
                .db-page-title {
                    font-family: 'Playfair Display', serif;
                    font-size: 46px; font-weight: 500; color: #3E2723;
                    letter-spacing: -0.5px; line-height: 1.1; margin-bottom: 12px;
                }
                .db-page-sub { font-size: 18px; color: rgba(62,39,35,0.5); font-weight: 300; line-height: 1.6; max-width: 560px; }

                .db-section { margin-bottom: 52px; }
                .db-section-title {
                    font-family: 'Playfair Display', serif;
                    font-size: 28px; font-weight: 500; color: #3E2723;
                    margin-bottom: 6px; letter-spacing: -0.2px;
                }
                .db-section-sub { font-size: 16px; color: rgba(62,39,35,0.5); margin-bottom: 24px; line-height: 1.55; }

                .db-card {
                    background: #fff;
                    border: 1px solid #E8D5BC;
                    border-radius: 20px;
                    padding: 32px;
                    box-shadow: 0 2px 14px rgba(62,39,35,0.08);
                }
                .db-card-label {
                    font-size: 11px; font-weight: 700; letter-spacing: 0.14em;
                    text-transform: uppercase; color: rgba(62,39,35,0.38);
                    margin-bottom: 20px; display: flex; align-items: center; gap: 8px;
                }
                .db-card-label::after { content: ''; flex: 1; height: 1px; background: #F0E5D8; }

                .db-profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }

                .db-ptype-pill {
                    display: inline-flex; align-items: center; gap: 10px;
                    background: #FDF5EE; border: 1.5px solid #D4A373;
                    border-radius: 12px; padding: 14px 20px; margin-top: 16px;
                }
                .db-ptype-dot { width: 10px; height: 10px; border-radius: 50%; background: #8C3322; flex-shrink: 0; }
                .db-ptype-name {
                    font-family: 'Playfair Display', serif;
                    font-size: 22px; color: #3E2723; font-weight: 500;
                }
                .db-ptype-sub { font-size: 12px; color: rgba(62,39,35,0.45); margin-top: 3px; }

                .db-trait-list { display: flex; flex-direction: column; gap: 14px; margin-top: 8px; }
                .db-trait-row { display: flex; align-items: center; gap: 14px; }
                .db-trait-key { font-size: 12.5px; font-weight: 500; color: rgba(62,39,35,0.6); width: 148px; flex-shrink: 0; }
                .db-trait-track { flex: 1; height: 7px; background: #F0E5D8; border-radius: 6px; overflow: hidden; }
                .db-trait-fill { height: 100%; border-radius: 6px; transition: width 0.9s cubic-bezier(0.16,1,0.3,1); }
                .db-trait-val { font-size: 12px; color: rgba(62,39,35,0.45); width: 30px; text-align: right; flex-shrink: 0; font-weight: 600; }

                .db-steps-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
                .db-step {
                    background: #fff; border: 1.5px solid #E8D5BC;
                    border-radius: 18px; padding: 26px 22px;
                    position: relative; overflow: hidden;
                    transition: box-shadow 0.2s, transform 0.2s;
                }
                .db-step:hover:not(.db-step-locked) { box-shadow: 0 8px 28px rgba(62,39,35,0.12); transform: translateY(-3px); }
                .db-step-done { border-color: #C8DFC4; background: #FAFFF9; }
                .db-step-active { border-color: #D4A373; border-width: 2px; box-shadow: 0 4px 20px rgba(212,163,115,0.2); }
                .db-step-locked { opacity: 0.45; }

                .db-step-num {
                    width: 28px; height: 28px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 12px; font-weight: 700;
                    margin-bottom: 14px; flex-shrink: 0;
                }
                .db-step-num-done    { background: #4A5D23; color: #fff; }
                .db-step-num-active  { background: #8C3322; color: #fff; }
                .db-step-num-locked  { background: #E8D5BC; color: rgba(62,39,35,0.4); }
                .db-step-num-pending { background: #F0E5D8; color: rgba(62,39,35,0.6); }

                .db-step-label {
                    font-family: 'Playfair Display', serif;
                    font-size: 18px; font-weight: 500; color: #3E2723;
                    margin-bottom: 8px; line-height: 1.25;
                }
                .db-step-desc { font-size: 14px; color: rgba(62,39,35,0.5); line-height: 1.55; margin-bottom: 18px; }
                .db-step-done-badge {
                    display: inline-flex; align-items: center; gap: 5px;
                    background: #EEF5EC; border: 1px solid #C8DFC4;
                    border-radius: 20px; padding: 4px 11px;
                    font-size: 12px; font-weight: 600; color: #4A5D23;
                    margin-bottom: 14px;
                }
                .db-step-btn {
                    width: 100%; padding: 13px 16px; border: none; border-radius: 50px;
                    font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600;
                    cursor: pointer; text-decoration: none; text-align: center;
                    display: block; transition: opacity 0.2s, transform 0.1s;
                    min-height: 48px;
                }
                .db-step-btn-primary { background: #8C3322; color: #fff; }
                .db-step-btn-primary:hover { opacity: 0.88; }
                .db-step-btn-done   { background: #F0E5D8; color: rgba(62,39,35,0.65); }
                .db-step-btn-locked { background: #F0E5D8; color: rgba(62,39,35,0.3); cursor: not-allowed; }

                .db-step-connector {
                    position: absolute; right: -9px; top: 38px;
                    width: 18px; height: 18px; background: #F9F6F0;
                    border: 2px solid #E8D5BC; border-radius: 50%; z-index: 2;
                }

                .db-progress-bar-wrap {
                    margin-top: 22px; background: #fff; border: 1px solid #E8D5BC;
                    border-radius: 14px; padding: 18px 24px;
                    display: flex; align-items: center; gap: 18px;
                }
                .db-progress-track { flex: 1; height: 8px; background: #F0E5D8; border-radius: 6px; overflow: hidden; }
                .db-progress-fill { height: 100%; border-radius: 6px; background: linear-gradient(90deg,#8C3322,#D4A373); transition: width 0.5s ease; }
                .db-progress-label { font-size: 14px; font-weight: 600; color: #8C3322; white-space: nowrap; }

                @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
                .db-anim-1 { animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) 0.05s both; }
                .db-anim-2 { animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) 0.12s both; }
                .db-anim-3 { animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) 0.2s both; }
                .db-anim-4 { animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) 0.28s both; }

                @media (max-width: 900px) {
                    .db-content { padding: 32px 20px 80px; }
                    .db-page-title { font-size: 34px; }
                    .db-page-sub { font-size: 16px; }
                    .db-profile-grid { grid-template-columns: 1fr; }
                    .db-steps-grid { grid-template-columns: 1fr 1fr; }
                }
                @media (max-width: 560px) {
                    .db-steps-grid { grid-template-columns: 1fr; }
                    .db-content { padding: 24px 16px 80px; }
                    .db-page-title { font-size: 28px; }
                    .db-section-title { font-size: 22px; }
                }
            `}</style>

            {/* Global watermark handles background now */}

            <div className="db-content">

                {/* Page header */}
                <header className="db-page-header db-anim-1">
                    <p className="db-page-eyebrow">Your Dashboard</p>
                    <h1 className="db-page-title">
                        Welcome back,<br />
                        <em style={{ fontStyle: "italic", color: "#8C3322" }}>{username}</em>
                    </h1>
                    <p className="db-page-sub">
                        Your personalised Sri Lanka journey, crafted around who you are.
                    </p>
                </header>

                {/* OCEAN Profile section */}
                <section className="db-section db-anim-2">
                    <h2 className="db-section-title">Your Personality Profile</h2>
                    <p className="db-section-sub">
                        Discovered through the 50-item OCEAN quiz. Every recommendation is built on this.
                    </p>

                    {personality ? (
                        <div className="db-profile-grid">
                            {/* Personality type + trait bars */}
                            <div className="db-card">
                                <div className="db-card-label">Personality Type</div>
                                <p style={{ fontSize: 16, color: "rgba(62,39,35,0.55)", lineHeight: 1.6 }}>
                                    Your dominant archetype based on the OCEAN model.
                                </p>
                                <div className="db-ptype-pill">
                                    <span className="db-ptype-dot" />
                                    <div>
                                        <div className="db-ptype-name">
                                            {PERSONALITY_LABELS[personality.personality_type?.toLowerCase()] || personality.personality_type}
                                        </div>
                                        <div className="db-ptype-sub">OCEAN Personality Cluster</div>
                                    </div>
                                </div>

                                <div style={{ height: 1, background: "#F0E5D8", margin: "24px 0" }} />

                                <div className="db-card-label" style={{ marginBottom: 14 }}>Trait Scores</div>
                                <div className="db-trait-list">
                                    {oceanTraits.map(([key, val]) => (
                                        <div className="db-trait-row" key={key}>
                                            <span className="db-trait-key">{traitLabels[key] || key}</span>
                                            <div className="db-trait-track">
                                                <div
                                                    className="db-trait-fill"
                                                    style={{
                                                        width: `${Math.min(100, Math.max(0, val * 10))}%`,
                                                        background: TRAIT_COLORS[key] || "#8C3322",
                                                    }}
                                                />
                                            </div>
                                            <span className="db-trait-val">{(val * 10).toFixed(0)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Radar chart */}
                            <div className="db-card">
                                <div className="db-card-label">OCEAN Radar</div>
                                <OCEANChart ocean={personality.ocean} />
                            </div>
                        </div>
                    ) : (
                        <div className="db-card" style={{ textAlign: "center", padding: "52px 32px" }}>
                            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#F0E5D8", margin: "0 auto 18px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8C3322" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                                </svg>
                            </div>
                            <p style={{ fontSize: 18, color: "#3E2723", fontFamily: "'Playfair Display',serif", marginBottom: 8 }}>
                                No personality profile yet
                            </p>
                            <p style={{ fontSize: 15, color: "rgba(62,39,35,0.5)", marginBottom: 24 }}>
                                Complete the OCEAN quiz to unlock personalised recommendations.
                            </p>
                            <button
                                onClick={() => navigate("/quiz")}
                                style={{ padding: "14px 28px", background: "#8C3322", border: "none", borderRadius: 50, color: "#fff", fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
                                Take the Quiz
                            </button>
                        </div>
                    )}
                </section>

                {/* Journey Steps section */}
                <section className="db-section db-anim-3">
                    <h2 className="db-section-title">Plan Your Journey</h2>
                    <p className="db-section-sub">
                        Complete each step to build your perfect personalised Sri Lanka experience.
                    </p>

                    <div className="db-steps-grid">
                        {STEPS.map((step, i) => {
                            const isActiveStep = !step.done && !step.locked;
                            const numClass = step.done ? "db-step-num-done" : step.locked ? "db-step-num-locked" : isActiveStep ? "db-step-num-active" : "db-step-num-pending";
                            const cardClass = step.done ? "db-step-done" : step.locked ? "db-step-locked" : isActiveStep ? "db-step-active" : "";

                            return (
                                <div key={step.num} className={`db-step ${cardClass}`} style={{ animationDelay: `${0.3 + i * 0.07}s`, animation: "fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both" }}>
                                    {i < STEPS.length - 1 && !step.locked && (
                                        <div className="db-step-connector" />
                                    )}

                                    <div className={`db-step-num ${numClass}`}>
                                        {step.done ? (
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                        ) : step.num}
                                    </div>

                                    <div className="db-step-label">{step.label}</div>

                                    {step.done ? (
                                        <div className="db-step-done-badge">
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                            Completed
                                        </div>
                                    ) : (
                                        <div className="db-step-desc">
                                            {step.locked ? "Complete the previous step to unlock this." : step.desc}
                                        </div>
                                    )}

                                    {step.locked ? (
                                        <div className="db-step-btn db-step-btn-locked" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            {step.btnLabel}
                                        </div>
                                    ) : (
                                        <button
                                            className={`db-step-btn ${isActiveStep ? "db-step-btn-primary" : "db-step-btn-done"}`}
                                            onClick={() => navigate(step.path)}
                                        >
                                            {step.btnLabel}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Progress bar */}
                    <div className="db-progress-bar-wrap db-anim-4">
                        <div style={{ flex: 0 }}>
                            <div style={{ fontSize: 14, color: "rgba(62,39,35,0.5)", marginBottom: 2 }}>Overall Progress</div>
                            <div style={{ fontSize: 22, fontFamily: "'Playfair Display',serif", color: "#3E2723", fontWeight: 500 }}>
                                {doneCount} <span style={{ fontSize: 14, color: "rgba(62,39,35,0.4)", fontFamily: "'Inter',sans-serif", fontWeight: 400 }}>of 3 steps</span>
                            </div>
                        </div>
                        <div className="db-progress-track">
                            <div className="db-progress-fill" style={{ width: `${(doneCount / 3) * 100}%` }} />
                        </div>
                        <div className="db-progress-label">{Math.round((doneCount / 3) * 100)}%</div>
                    </div>
                </section>

            </div>
        </Layout>
    );
}
