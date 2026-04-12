import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import OCEANChart from "../components/OCEANChart";
import Navbar from "../components/Navbar";

const PERSONALITY_LABELS = {
    "balanced traveler":    "Balanced Traveller",
    "organized sightseer":  "Organized Sightseer",
    "adventurous explorer": "Adventurous Explorer",
    "friendly cultural":    "Friendly Cultural",
    "calm & relaxed":       "Calm & Relaxed",
};

export default function Dashboard() {
    const [personality,  setPersonality]  = useState(null);
    const [journeyStatus, setJourneyStatus] = useState({
        locations: false,
        hotel:     false,
        guide:     false,
    });
    const navigate = useNavigate();

    useEffect(() => {
        // Load personality
        API.get("/personality")
            .then(res => setPersonality(res.data))
            .catch(() => {});

        // Check completion of each step
        Promise.allSettled([
            API.get("/locations/selection"),   // member 3 — saved locations
            API.get("/hotels/saved"),           // member 4 — saved hotel
            API.get("/guides/booking"),         // member 4b — saved guide
        ]).then(([locRes, hotelRes, guideRes]) => {
            setJourneyStatus({
                locations: locRes.status === "fulfilled" &&
                    locRes.value.data?.selected_destinations?.length > 0,
                hotel:     hotelRes.status === "fulfilled" &&
                    hotelRes.value.data?.saved_hotels?.length > 0,
                guide:     guideRes.status === "fulfilled" &&
                    guideRes.value.data?.current_status === "confirmed",
            });
        });
    }, []);

    const oceanTraits = personality?.ocean ? Object.entries(personality.ocean) : [];
    const traitLabels = {
        openness: "Openness", conscientiousness: "Conscientiousness",
        extraversion: "Extraversion", agreeableness: "Agreeableness", neuroticism: "Neuroticism",
    };

    // Journey steps — each unlocks after the previous is done
    const STEPS = [
        {
            num:       1,
            label:     "Select Locations",
            sub:       "Choose destinations that match your personality",
            icon:      "📍",
            done:      journeyStatus.locations,
            path:      "/locations",
            locked:    false,
            btnLabel:  journeyStatus.locations ? "Edit Locations" : "Select Locations →",
        },
        {
            num:       2,
            label:     "Choose Your Hotel",
            sub:       "AI-matched hotels based on your OCEAN profile",
            icon:      "🏨",
            done:      journeyStatus.hotel,
            path:      "/hotels",
            locked:    !journeyStatus.locations,
            btnLabel:  journeyStatus.hotel ? "Edit Hotel" : "Browse Hotels →",
        },
        {
            num:       3,
            label:     "Select Your Guide",
            sub:       "Find a guide that matches your travel vibe",
            icon:      "🧭",
            done:      journeyStatus.guide,
            path:      "/guides",
            locked:    !journeyStatus.hotel,
            btnLabel:  journeyStatus.guide ? "Edit Guide" : "Find a Guide →",
        },
        {
            num:       4,
            label:     "View Your Itinerary",
            sub:       "Optimised route plan with map, budget & timeline",
            icon:      "🗺️",
            done:      false,
            path:      "/itineraries/plan",
            locked:    !journeyStatus.guide,
            btnLabel:  "Generate Itinerary →",
        },
    ];

    // Which step is active (first not done)
    const activeStep = STEPS.findIndex(s => !s.done && !s.locked);

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

                .dash-root { min-height:100vh; background:#e8f0ef; font-family:'DM Sans',sans-serif; color:#1a2e2b; }
                .dash-content { max-width:960px; margin:0 auto; padding:48px 32px 80px; }

                .page-header { margin-bottom:36px; animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
                .page-eyebrow { font-size:11px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; color:#4d8a82; margin-bottom:10px; }
                .page-title { font-family:'Playfair Display',serif; font-size:40px; font-weight:500; color:#1a2e2b; letter-spacing:-0.3px; line-height:1.05; }
                .page-subtitle { font-size:14px; color:rgba(26,46,43,0.5); font-weight:300; margin-top:8px; }
                @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }

                .card { background:#4d8a82; border:1px solid rgba(255,255,255,0.18); border-radius:16px; padding:28px; box-shadow:0 4px 24px rgba(29,58,54,0.15),0 1px 4px rgba(29,58,54,0.08); animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both; color:#ffffff; }
                .card-sm { animation-delay:0.1s; }
                .card-lg { animation-delay:0.05s; margin-bottom:24px; }
                .card-label { font-size:10px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:rgba(255,255,255,0.55); margin-bottom:18px; display:flex; align-items:center; gap:8px; }
                .card-label::after { content:''; flex:1; height:1px; background:rgba(255,255,255,0.15); }

                .personality-badge { display:inline-flex; align-items:center; gap:10px; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.2); border-radius:10px; padding:12px 18px; margin-top:16px; }
                .personality-badge-dot { width:8px; height:8px; border-radius:50%; background:#7ab8b0; box-shadow:0 0 8px rgba(122,184,176,0.6); flex-shrink:0; }
                .personality-badge-text { font-family:'Playfair Display',serif; font-size:20px; font-weight:400; color:#ffffff; }
                .personality-badge-sub { font-size:11px; color:rgba(255,255,255,0.5); margin-top:3px; font-style:italic; }

                .trait-list { display:flex; flex-direction:column; gap:13px; margin-top:4px; }
                .trait-row { display:flex; align-items:center; gap:12px; }
                .trait-key { font-size:11px; font-weight:500; letter-spacing:0.07em; text-transform:uppercase; color:rgba(255,255,255,0.6); width:130px; flex-shrink:0; }
                .trait-bar-track { flex:1; height:5px; background:rgba(255,255,255,0.15); border-radius:4px; overflow:hidden; }
                .trait-bar-fill { height:100%; border-radius:4px; background:linear-gradient(90deg,#7ab8b0,#b2dbd6); transform-origin:left; animation:barGrow 0.9s cubic-bezier(0.16,1,0.3,1) both; animation-delay:0.4s; }
                @keyframes barGrow { from{transform:scaleX(0)} to{transform:scaleX(1)} }
                .trait-value { font-size:12px; color:rgba(255,255,255,0.55); width:36px; text-align:right; flex-shrink:0; font-weight:600; }

                .chart-wrapper { margin-top:8px; }
                .dash-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; }
                .card-desc { font-size:13px; color:rgba(255,255,255,0.55); font-weight:300; line-height:1.6; }

                /* Journey steps */
                .journey-section { margin-top:8px; }
                .journey-heading { font-family:'Playfair Display',serif; font-size:22px; font-weight:400; color:#1a2e2b; margin-bottom:6px; }
                .journey-sub { font-size:13.5px; color:rgba(26,46,43,0.5); margin-bottom:20px; }
                .journey-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }

                .step-card { border-radius:14px; padding:20px; position:relative; overflow:hidden; transition:box-shadow 0.2s,transform 0.2s; }
                .step-card.done { background:#2d4a47; border:1px solid rgba(122,184,176,0.3); box-shadow:0 4px 16px rgba(29,58,54,0.15); }
                .step-card.active { background:#4d8a82; border:1.5px solid rgba(255,204,0,0.5); box-shadow:0 4px 20px rgba(77,138,130,0.25); }
                .step-card.locked { background:rgba(45,74,71,0.08); border:1px solid rgba(45,74,71,0.12); opacity:0.55; }
                .step-card.pending { background:#4d8a82; border:1px solid rgba(255,255,255,0.15); }
                .step-card:not(.locked):hover { transform:translateY(-2px); box-shadow:0 8px 28px rgba(29,58,54,0.2); }

                .step-num { font-size:10px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:rgba(255,255,255,0.45); margin-bottom:10px; }
                .step-icon { font-size:28px; margin-bottom:10px; }
                .step-label { font-family:'Playfair Display',serif; font-size:16px; font-weight:400; color:#fff; margin-bottom:5px; line-height:1.25; }
                .step-sublabel { font-size:11.5px; color:rgba(255,255,255,0.5); line-height:1.5; margin-bottom:14px; }
                .step-locked-label { font-size:11.5px; color:rgba(26,46,43,0.4); line-height:1.5; margin-bottom:14px; }

                .step-done-badge { display:inline-flex; align-items:center; gap:5px; background:rgba(52,211,153,0.15); border:1px solid rgba(52,211,153,0.3); border-radius:20px; padding:4px 10px; font-size:11px; font-weight:600; color:#34d399; margin-bottom:10px; }
                .step-btn { width:100%; padding:"10px 0"; border:none; border-radius:9px; font-family:'DM Sans',sans-serif; font-size:12.5px; font-weight:700; cursor:pointer; transition:opacity 0.2s; display:block; text-align:center; text-decoration:none; }
                .step-btn.primary { background:#ffcc00; color:#1a2e2b; }
                .step-btn.primary:hover { opacity:0.88; }
                .step-btn.secondary { background:rgba(255,255,255,0.12); color:rgba(255,255,255,0.7); }
                .step-btn.locked-btn { background:rgba(26,46,43,0.08); color:rgba(26,46,43,0.3); cursor:not-allowed; }

                .step-connector { position:absolute; right:-1px; top:50%; transform:translateY(-50%); width:14px; height:14px; background:#e8f0ef; border:2px solid rgba(45,74,71,0.15); border-radius:50%; z-index:2; }

                @media(max-width:900px) { .journey-grid{grid-template-columns:1fr 1fr} }
                @media(max-width:580px) { .journey-grid{grid-template-columns:1fr} .dash-grid{grid-template-columns:1fr} .dash-content{padding:28px 16px 60px} .page-title{font-size:30px} }
            `}</style>

            <div className="dash-root">
                <Navbar />
                <div className="dash-content">

                    <div className="page-header">
                        <p className="page-eyebrow">Overview</p>
                        <h1 className="page-title">Your Dashboard</h1>
                        <p className="page-subtitle">Your personality profile and personalised travel journey</p>
                    </div>

                    {/* ── OCEAN personality cards ─────────────────────────── */}
                    {personality ? (
                        <>
                            <div className="dash-grid">
                                <div className="card card-sm">
                                    <div className="card-label">Personality Type</div>
                                    <p className="card-desc">Your dominant archetype based on the OCEAN model.</p>
                                    <div className="personality-badge">
                                        <span className="personality-badge-dot" />
                                        <div>
                                            <div className="personality-badge-text">
                                                {PERSONALITY_LABELS[personality.personality_type?.toLowerCase()] || personality.personality_type}
                                            </div>
                                            <div className="personality-badge-sub">
                                                O:{personality.ocean?.openness?.toFixed(1)} · C:{personality.ocean?.conscientiousness?.toFixed(1)} · E:{personality.ocean?.extraversion?.toFixed(1)} · A:{personality.ocean?.agreeableness?.toFixed(1)} · N:{personality.ocean?.neuroticism?.toFixed(1)}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="card card-sm">
                                    <div className="card-label">OCEAN Breakdown</div>
                                    <div className="trait-list">
                                        {oceanTraits.map(([key, val]) => (
                                            <div className="trait-row" key={key}>
                                                <span className="trait-key">{traitLabels[key] || key}</span>
                                                <div className="trait-bar-track">
                                                    <div className="trait-bar-fill" style={{ width:`${Math.min(100,Math.max(0,val*10))}%` }} />
                                                </div>
                                                <span className="trait-value">{(val*10).toFixed(0)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="card card-lg">
                                <div className="card-label">OCEAN Radar Chart</div>
                                <div className="chart-wrapper">
                                    <OCEANChart ocean={personality.ocean} />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="card card-lg" style={{ marginBottom:24 }}>
                            <div style={{ textAlign:"center", padding:"48px 24px", color:"rgba(255,255,255,0.45)", fontSize:14 }}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin:"0 auto 16px", display:"block", opacity:0.4 }}>
                                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                                </svg>
                                Loading your personality profile…
                            </div>
                        </div>
                    )}

                    {/* ── JOURNEY STEPS ────────────────────────────────────── */}
                    <div className="journey-section">
                        <h2 className="journey-heading">Plan Your Journey</h2>
                        <p className="journey-sub">
                            Complete each step in order to build your perfect personalised Sri Lanka trip.
                        </p>

                        <div className="journey-grid">
                            {STEPS.map((step, i) => {
                                const isActive = !step.done && !step.locked;
                                const cardClass = step.done ? "done" : step.locked ? "locked" : isActive ? "active" : "pending";

                                return (
                                    <div key={step.num} className={`step-card ${cardClass}`} style={{ position:"relative" }}>
                                        {/* Connector dot between cards (not on last) */}
                                        {i < STEPS.length - 1 && !step.locked && (
                                            <div className="step-connector" />
                                        )}

                                        <div className="step-num">Step {step.num}</div>
                                        <div className="step-icon">{step.icon}</div>
                                        <div className="step-label">{step.label}</div>

                                        {step.done ? (
                                            <div className="step-done-badge">✓ Completed</div>
                                        ) : step.locked ? (
                                            <div className="step-locked-btn" style={{ fontSize:11.5, color:"rgba(26,46,43,0.4)", marginBottom:14, lineHeight:1.5 }}>
                                                🔒 Complete previous step first
                                            </div>
                                        ) : (
                                            <div className="step-sublabel">{step.sub}</div>
                                        )}

                                        {step.locked ? (
                                            <div className="step-btn locked-btn" style={{ padding:"10px 0", borderRadius:9, fontFamily:"'DM Sans',sans-serif", fontSize:12.5, fontWeight:700, display:"block", textAlign:"center", background:"rgba(26,46,43,0.08)", color:"rgba(26,46,43,0.3)", cursor:"not-allowed" }}>
                                                {step.btnLabel}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => navigate(step.path)}
                                                style={{ width:"100%", padding:"10px 0", border:"none", borderRadius:9, fontFamily:"'DM Sans',sans-serif", fontSize:12.5, fontWeight:700, cursor:"pointer", transition:"opacity 0.2s", background: step.done ? "rgba(255,255,255,0.12)" : isActive ? "#ffcc00" : "rgba(255,255,255,0.12)", color: step.done ? "rgba(255,255,255,0.7)" : isActive ? "#1a2e2b" : "rgba(255,255,255,0.7)" }}>
                                                {step.btnLabel}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Progress bar */}
                        <div style={{ marginTop:20, background:"rgba(45,74,71,0.12)", borderRadius:10, padding:"14px 20px", display:"flex", alignItems:"center", gap:16 }}>
                            <div style={{ flex:1, height:6, background:"rgba(45,74,71,0.15)", borderRadius:3, overflow:"hidden" }}>
                                <div style={{
                                    height:"100%", borderRadius:3,
                                    background:"linear-gradient(90deg,#7ab8b0,#ffcc00)",
                                    width:`${(Object.values(journeyStatus).filter(Boolean).length / 3) * 100}%`,
                                    transition:"width 0.5s ease",
                                }} />
                            </div>
                            <span style={{ fontSize:12, fontWeight:600, color:"#2d4a47", whiteSpace:"nowrap" }}>
                                {Object.values(journeyStatus).filter(Boolean).length} / 3 steps done
                            </span>
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
}