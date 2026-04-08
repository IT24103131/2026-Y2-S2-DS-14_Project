// Dashboard.jsx
// Changes from original:
//  1. Shows "Take your quiz" banner when quiz_completed === false
//  2. Removed "Generate AI Trip" button (that happens after location/hotel/guide selection)
//  3. Added a "Take Quiz" link on the empty state card

import { useEffect, useState, useContext } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import OCEANChart from "../components/OCEANChart";
import Navbar from "../components/Navbar";
import { AuthContext } from "../context/AuthContext";

const PERSONALITY_LABELS = {
    "balanced traveler":    "Balanced Traveller",
    "organized sightseer":  "Organized Sightseer",
    "adventurous explorer": "Adventurous Explorer",
    "friendly cultural":    "Friendly Cultural",
    "calm & relaxed":       "Calm & Relaxed",
};

export default function Dashboard() {
    const [personality, setPersonality] = useState(null);
    const { quizCompleted }             = useContext(AuthContext);

    useEffect(() => {
        API.get("/personality")
            .then(res => setPersonality(res.data))
            .catch(() => {});
    }, []);

    const oceanTraits = personality?.ocean ? Object.entries(personality.ocean) : [];

    const traitLabels = {
        openness:          "Openness",
        conscientiousness: "Conscientiousness",
        extraversion:      "Extraversion",
        agreeableness:     "Agreeableness",
        neuroticism:       "Neuroticism",
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
                .dash-root { min-height: 100vh; background: #e8f0ef; font-family: 'DM Sans', sans-serif; color: #1a2e2b; }
                .dash-content { max-width: 960px; margin: 0 auto; padding: 48px 32px 80px; }
                .page-header { margin-bottom: 36px; animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
                .page-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #4d8a82; margin-bottom: 10px; }
                .page-title { font-family: 'Playfair Display', serif; font-size: 40px; font-weight: 500; color: #1a2e2b; letter-spacing: -0.3px; line-height: 1.05; }
                .page-subtitle { font-size: 14px; color: rgba(26,46,43,0.5); font-weight: 300; margin-top: 8px; }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }

                /* ── Quiz banner ── */
                .quiz-banner { background: linear-gradient(135deg, #2d4a47, #4d8a82); border: 1px solid rgba(255,204,0,0.25); border-radius: 16px; padding: 24px 28px; display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 28px; box-shadow: 0 4px 20px rgba(29,58,54,0.15); animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both; flex-wrap: wrap; }
                .quiz-banner h3 { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 400; color: #ffffff; margin-bottom: 4px; }
                .quiz-banner p { font-size: 13px; color: rgba(255,255,255,0.55); }
                .quiz-banner-btn { padding: 11px 24px; background: #ffcc00; border: none; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 13.5px; font-weight: 700; color: #1a2e2b; cursor: pointer; text-decoration: none; display: inline-block; white-space: nowrap; box-shadow: 0 4px 14px rgba(255,204,0,0.3); transition: background 0.2s, transform 0.15s; }
                .quiz-banner-btn:hover { background: #e6b800; transform: translateY(-1px); }

                /* ── Cards ── */
                .card { background: #4d8a82; border: 1px solid rgba(255,255,255,0.18); border-radius: 16px; padding: 28px; box-shadow: 0 4px 24px rgba(29,58,54,0.15), 0 1px 4px rgba(29,58,54,0.08); animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both; color: #ffffff; }
                .card-sm { animation-delay: 0.1s; }
                .card-lg { animation-delay: 0.05s; margin-bottom: 24px; }
                .card-label { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.55); margin-bottom: 18px; display: flex; align-items: center; gap: 8px; }
                .card-label::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.15); }

                .personality-badge { display: inline-flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; padding: 12px 18px; margin-top: 16px; }
                .personality-badge-dot { width: 8px; height: 8px; border-radius: 50%; background: #7ab8b0; box-shadow: 0 0 8px rgba(122,184,176,0.6); flex-shrink: 0; }
                .personality-badge-text { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 400; color: #ffffff; }
                .personality-badge-sub { font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 3px; font-style: italic; }
                .card-desc { font-size: 13px; color: rgba(255,255,255,0.55); font-weight: 300; line-height: 1.6; }

                .trait-list { display: flex; flex-direction: column; gap: 13px; margin-top: 4px; }
                .trait-row { display: flex; align-items: center; gap: 12px; }
                .trait-key { font-size: 11px; font-weight: 500; letter-spacing: 0.07em; text-transform: uppercase; color: rgba(255,255,255,0.6); width: 130px; flex-shrink: 0; }
                .trait-bar-track { flex: 1; height: 5px; background: rgba(255,255,255,0.15); border-radius: 4px; overflow: hidden; }
                .trait-bar-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, #7ab8b0, #b2dbd6); transform-origin: left; animation: barGrow 0.9s cubic-bezier(0.16,1,0.3,1) both; animation-delay: 0.4s; }
                @keyframes barGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
                .trait-value { font-size: 12px; color: rgba(255,255,255,0.55); width: 36px; text-align: right; flex-shrink: 0; font-weight: 600; }

                .chart-wrapper { margin-top: 8px; }
                .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }

                .empty-state { text-align: center; padding: 48px 24px; color: rgba(255,255,255,0.5); }
                .empty-state svg { margin: 0 auto 16px; display: block; opacity: 0.35; }
                .empty-state p { font-size: 14px; margin-bottom: 20px; }
                .empty-state-btn { display: inline-block; padding: 11px 24px; background: #ffcc00; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 13.5px; font-weight: 700; color: #1a2e2b; text-decoration: none; box-shadow: 0 4px 14px rgba(255,204,0,0.3); transition: background 0.2s; }
                .empty-state-btn:hover { background: #e6b800; }

                @media (max-width: 680px) { .dash-grid { grid-template-columns: 1fr; } .dash-content { padding: 28px 16px 60px; } .page-title { font-size: 30px; } }
            `}</style>

            <div className="dash-root">
                <Navbar />
                <div className="dash-content">
                    <div className="page-header">
                        <p className="page-eyebrow">Overview</p>
                        <h1 className="page-title">Your Dashboard</h1>
                        <p className="page-subtitle">
                            Explore your personality profile and track your personalised travel journey
                        </p>
                    </div>

                    {/* ── Quiz not completed banner ── */}
                    {quizCompleted === false && !personality && (
                        <div className="quiz-banner">
                            <div>
                                <h3>Take your personality quiz ✨</h3>
                                <p>
                                    Complete the OCEAN quiz to unlock your personality profile and
                                    get matched to locations, hotels, and guides.
                                </p>
                            </div>
                            <Link to="/quiz" className="quiz-banner-btn">Start Quiz →</Link>
                        </div>
                    )}

                    {/* ── Personality loaded ── */}
                    {personality ? (
                        <>
                            <div className="dash-grid">
                                <div className="card card-sm">
                                    <div className="card-label">Personality Type</div>
                                    <p className="card-desc">
                                        Your dominant personality archetype based on the OCEAN model.
                                    </p>
                                    <div className="personality-badge">
                                        <span className="personality-badge-dot" />
                                        <div>
                                            <div className="personality-badge-text">
                                                {PERSONALITY_LABELS[personality.personality_type?.toLowerCase()]
                                                    || personality.personality_type}
                                            </div>
                                            <div className="personality-badge-sub">
                                                O: {personality.ocean?.openness?.toFixed(1)} ·
                                                C: {personality.ocean?.conscientiousness?.toFixed(1)} ·
                                                E: {personality.ocean?.extraversion?.toFixed(1)} ·
                                                A: {personality.ocean?.agreeableness?.toFixed(1)} ·
                                                N: {personality.ocean?.neuroticism?.toFixed(1)}
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
                                                    <div
                                                        className="trait-bar-fill"
                                                        style={{ width: `${Math.min(100, Math.max(0, val * 10))}%` }}
                                                    />
                                                </div>
                                                <span className="trait-value">{(val * 10).toFixed(0)}</span>
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
                        <div className="card card-lg">
                            <div className="empty-state">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                                </svg>
                                {quizCompleted === false ? (
                                    <>
                                        <p>Complete the quiz to see your personality profile here.</p>
                                        <Link to="/quiz" className="empty-state-btn">Take the Quiz →</Link>
                                    </>
                                ) : (
                                    <p>Loading your personality profile…</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}