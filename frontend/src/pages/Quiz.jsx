import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";
import Layout from "../components/Layout";

// ─────────────────────────────────────────────────────────────────────────────
// Quiz.jsx — Vibe Lanka design system
// Uses Layout sidebar wrapper, rust hero, white cards, rust/gold accents
// ─────────────────────────────────────────────────────────────────────────────

const OCEAN_QUESTIONS = [
    { id: "EXT1", trait: "Extraversion",       text: "Am the life of the party.",        reverse: false },
    { id: "EXT2", trait: "Extraversion",       text: "Don't talk a lot.",                reverse: true  },
    { id: "AGR1", trait: "Agreeableness",      text: "Feel little concern for others.",  reverse: true  },
    { id: "AGR2", trait: "Agreeableness",      text: "Am interested in people.",         reverse: false },
    { id: "CSN1", trait: "Conscientiousness",  text: "Am always prepared.",              reverse: false },
    { id: "CSN2", trait: "Conscientiousness",  text: "Leave my belongings around.",      reverse: true  },
    { id: "EST4", trait: "Emotional Stability",text: "Get stressed out easily.",         reverse: false },
    { id: "OPN5", trait: "Openness",           text: "Have a rich vocabulary.",          reverse: false },
];

const DURATION_OPTIONS = [
    { label: "Short",   subLabel: "1–5 days",   value: "Short (1-5 days)"   },
    { label: "Medium",  subLabel: "6–10 days",  value: "Medium (6-10 days)" },
    { label: "Long",    subLabel: "11+ days",   value: "Long (11+ days)"    },
];

const BUDGET_OPTIONS = [
    { label: "Budget",    subLabel: "Economy travel",     value: "budget"    },
    { label: "Mid-range", subLabel: "Comfortable travel", value: "mid-range" },
    { label: "Luxury",    subLabel: "Premium experience", value: "luxury"    },
];

const TRAIT_ICONS = {
    "Extraversion":       "🗣️",
    "Agreeableness":      "🤝",
    "Conscientiousness":  "📋",
    "Emotional Stability":"🧘",
    "Openness":           "💡",
};

function applyReverse(val) { return 6 - val; }

function computePersonalityAndScores(raw) {
    const EXT1 = raw.EXT1;
    const EXT2 = applyReverse(raw.EXT2);
    const AGR1 = applyReverse(raw.AGR1);
    const AGR2 = raw.AGR2;
    const CSN1 = raw.CSN1;
    const CSN2 = applyReverse(raw.CSN2);
    const EST4 = raw.EST4;
    const OPN5 = raw.OPN5;

    const traitScores = {
        "adventurous explorer": (EXT1 + OPN5) / 2,
        "friendly cultural":    (AGR1 + AGR2) / 2,
        "organized sightseer":  (CSN1 + CSN2) / 2,
        "calm & relaxed":        6 - EST4,
    };

    const [bestType, bestScore] = Object.entries(traitScores)
        .reduce(([bk, bv], [k, v]) => v > bv ? [k, v] : [bk, bv], ["", -Infinity]);

    const personality_type = bestScore < 3.2 ? "balanced traveler" : bestType;

    const E_avg = (EXT1 + EXT2) / 2;
    const A_avg = (AGR1 + AGR2) / 2;
    const C_avg = (CSN1 + CSN2) / 2;
    const N_raw = EST4;
    const O_raw = OPN5;

    const to10 = (v1to5) => ((v1to5 - 1) / 4) * 10;

    return {
        personality_type,
        openness_score:          parseFloat(to10(O_raw).toFixed(2)),
        conscientiousness_score: parseFloat(to10(C_avg).toFixed(2)),
        extraversion_score:      parseFloat(to10(E_avg).toFixed(2)),
        agreeableness_score:     parseFloat(to10(A_avg).toFixed(2)),
        neuroticism_score:       parseFloat(to10(N_raw).toFixed(2)),
    };
}

const INITIAL_SCORES = Object.fromEntries(OCEAN_QUESTIONS.map(q => [q.id, 3]));

const PERSONALITY_INFO = {
    "adventurous explorer": {
        emoji: "🧗",
        desc: "High-energy destinations — wildlife, surf towns, and dramatic landscapes chosen for your adventurous spirit.",
    },
    "balanced traveler": {
        emoji: "⚖️",
        desc: "A perfect mix of calm coastlines and cultural depth, paced just right for you.",
    },
    "friendly cultural": {
        emoji: "🏛️",
        desc: "Sacred sites, welcoming communities, and rich Sri Lankan traditions matched to your cultural curiosity.",
    },
    "organized sightseer": {
        emoji: "📍",
        desc: "Well-structured city visits and UNESCO heritage sites, ideal for the methodical explorer.",
    },
    "calm & relaxed": {
        emoji: "🌊",
        desc: "Quiet beaches and laid-back coastal towns selected to help you recharge and unwind.",
    },
};

export default function Quiz() {
    const navigate = useNavigate();
    useContext(AuthContext);

    const [scores, setScores]     = useState(INITIAL_SCORES);
    const [duration, setDuration] = useState("");
    const [budget, setBudget]     = useState("");
    const [step, setStep]         = useState("quiz");
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState("");
    const [result, setResult]     = useState(null);

    const handleOceanNext = () => { setError(""); setStep("logistics"); };

    const handleSubmit = async () => {
        if (!duration) { setError("Please select your trip duration."); return; }
        if (!budget)   { setError("Please select your budget preference."); return; }
        setError("");
        setLoading(true);

        try {
            const computed = computePersonalityAndScores(scores);

            const payload = {
                openness_score:          computed.openness_score,
                conscientiousness_score: computed.conscientiousness_score,
                extraversion_score:      computed.extraversion_score,
                agreeableness_score:     computed.agreeableness_score,
                neuroticism_score:       computed.neuroticism_score,
                personality_type:        computed.personality_type,
                duration,
            };

            await API.post("/personality", payload);

            setResult({ ...computed, budget });
            setStep("result");
        } catch (err) {
            setError(err?.response?.data?.detail || "Could not save. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleRetake = () => {
        setScores(INITIAL_SCORES);
        setDuration("");
        setBudget("");
        setResult(null);
        setError("");
        setStep("quiz");
    };

    const info = result ? (PERSONALITY_INFO[result.personality_type] || PERSONALITY_INFO["balanced traveler"]) : null;

    return (
        <Layout>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

                /* Hero */
                .qz-hero {
                    background: #8C3322;
                    padding: 40px 32px 32px;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .qz-hero-inner { max-width: 820px; margin: 0 auto; }
                .qz-eyebrow {
                    font-size: 11px; font-weight: 700; letter-spacing: 0.14em;
                    text-transform: uppercase; color: rgba(255,255,255,0.5);
                    margin-bottom: 10px;
                }
                .qz-title {
                    font-family: 'Playfair Display', serif;
                    font-size: 36px; font-weight: 500; color: #fff;
                    letter-spacing: -0.3px; line-height: 1.05; margin-bottom: 8px;
                }
                .qz-sub {
                    font-size: 15px; color: rgba(255,255,255,0.55);
                    font-weight: 300; margin-bottom: 22px;
                }
                .qz-steps { display: flex; gap: 8px; }
                .qz-step-dot { height: 4px; border-radius: 4px; transition: background 0.3s; }

                /* Content */
                .qz-content { max-width: 820px; margin: 0 auto; padding: 36px 24px 80px; }

                /* Error */
                .qz-error {
                    display: flex; align-items: center; gap: 8px;
                    background: rgba(140,51,34,0.08);
                    border: 1px solid rgba(140,51,34,0.25);
                    border-radius: 10px; padding: 11px 14px;
                    font-size: 14px; color: #8C3322; margin-bottom: 20px;
                }

                /* Question cards grid */
                .qz-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
                    gap: 14px; margin-bottom: 28px;
                }

                .qz-card {
                    background: #FFFFFF;
                    border: 1px solid #E8D5BC;
                    border-radius: 18px; padding: 20px 22px;
                    box-shadow: 0 2px 14px rgba(62,39,35,0.08);
                    color: #3E2723;
                }
                .qz-card-trait {
                    font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
                    text-transform: uppercase; color: rgba(62,39,35,0.4);
                    margin-bottom: 6px; display: flex; align-items: center; gap: 5px;
                }
                .qz-card-text {
                    font-size: 15px; font-weight: 400;
                    color: #3E2723; margin-bottom: 16px; line-height: 1.4;
                }
                .qz-scale { display: flex; align-items: center; gap: 6px; }
                .qz-scale-lbl { font-size: 10px; color: rgba(62,39,35,0.4); min-width: 60px; }
                .qz-scale-lbl.right { text-align: right; }
                .qz-radios { display: flex; gap: 8px; flex: 1; justify-content: center; }
                .qz-radio-item { display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; }
                .qz-radio-item input { width: 17px; height: 17px; accent-color: #8C3322; cursor: pointer; }
                .qz-radio-val { font-size: 11px; font-weight: 600; color: rgba(62,39,35,0.35); transition: color 0.15s; }
                .qz-radio-val.on { color: #8C3322; }

                /* Logistics */
                .qz-section-title {
                    font-family: 'Playfair Display', serif;
                    font-size: 24px; font-weight: 400; color: #3E2723; margin-bottom: 6px;
                }
                .qz-section-sub { font-size: 14px; color: rgba(62,39,35,0.5); margin-bottom: 18px; }
                .qz-options-row {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 12px; margin-bottom: 28px;
                }
                .qz-opt {
                    display: flex; align-items: center; gap: 12px;
                    padding: 16px 18px;
                    background: #FFFFFF;
                    border: 1.5px solid #E8D5BC;
                    border-radius: 12px; cursor: pointer;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    color: #3E2723;
                }
                .qz-opt:hover { border-color: #D4A373; }
                .qz-opt.selected {
                    border-color: #8C3322;
                    background: rgba(140,51,34,0.04);
                    box-shadow: 0 0 0 3px rgba(140,51,34,0.1);
                }
                .qz-opt input { accent-color: #8C3322; width: 16px; height: 16px; cursor: pointer; flex-shrink: 0; }
                .qz-opt-label { font-size: 15px; font-weight: 600; color: #3E2723; }
                .qz-opt-sub { font-size: 12px; color: rgba(62,39,35,0.5); margin-top: 2px; }

                /* Buttons */
                .qz-nav { display: flex; gap: 12px; }
                .qz-btn-back {
                    flex: 1; padding: 14px;
                    border: 1.5px solid #E8D5BC; border-radius: 50px;
                    background: #fff; font-family: 'Inter', sans-serif;
                    font-size: 15px; font-weight: 500;
                    color: rgba(62,39,35,0.6); cursor: pointer;
                    transition: border-color 0.2s, color 0.2s;
                    min-height: 48px;
                }
                .qz-btn-back:hover { border-color: #8C3322; color: #8C3322; }
                .qz-btn-next {
                    flex: 2; padding: 14px; border: none; border-radius: 50px;
                    background: #8C3322; font-family: 'Inter', sans-serif;
                    font-size: 15px; font-weight: 600; color: #fff;
                    cursor: pointer; box-shadow: 0 4px 14px rgba(140,51,34,0.3);
                    transition: opacity 0.2s, transform 0.15s;
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                    min-height: 48px;
                }
                .qz-btn-next:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
                .qz-btn-next:disabled { opacity: 0.45; cursor: not-allowed; }
                .qz-btn-submit {
                    flex: 2; padding: 14px; border: none; border-radius: 50px;
                    background: #8C3322; font-family: 'Inter', sans-serif;
                    font-size: 15px; font-weight: 700; color: #fff;
                    cursor: pointer; box-shadow: 0 4px 14px rgba(140,51,34,0.3);
                    transition: opacity 0.2s, transform 0.15s;
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                    min-height: 48px;
                }
                .qz-btn-submit:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
                .qz-btn-submit:disabled { opacity: 0.45; cursor: not-allowed; }
                .qz-spinner {
                    width: 15px; height: 15px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: #fff;
                    border-radius: 50%; animation: spin 0.7s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* Result */
                .qz-result { max-width: 600px; margin: 0 auto; animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
                @keyframes fadeUp { from { opacity:0;transform:translateY(18px); } to { opacity:1;transform:translateY(0); } }
                .qz-result-card {
                    background: #FFFFFF;
                    border: 1px solid #E8D5BC;
                    border-radius: 20px; padding: 48px 36px;
                    text-align: center;
                    box-shadow: 0 2px 14px rgba(62,39,35,0.08);
                    color: #3E2723;
                }
                .qz-result-emoji { font-size: 56px; margin-bottom: 18px; }
                .qz-result-eyebrow {
                    font-size: 11px; font-weight: 700; letter-spacing: 0.14em;
                    text-transform: uppercase; color: rgba(62,39,35,0.4); margin-bottom: 12px;
                }
                .qz-result-headline {
                    font-family: 'Playfair Display', serif;
                    font-size: 28px; font-weight: 500; color: #3E2723;
                    letter-spacing: -0.3px; margin-bottom: 10px;
                }
                .qz-result-type {
                    display: inline-block;
                    font-family: 'Playfair Display', serif;
                    font-size: 22px; color: #8C3322;
                    background: rgba(140,51,34,0.06);
                    border: 2px solid rgba(140,51,34,0.2);
                    border-radius: 14px; padding: 16px 28px;
                    margin: 6px 0 18px; letter-spacing: 0.01em;
                    text-transform: capitalize;
                }
                .qz-result-desc {
                    font-size: 15px; color: rgba(62,39,35,0.6);
                    line-height: 1.7; max-width: 380px; margin: 0 auto 28px;
                }
                .qz-result-info {
                    font-size: 13.5px; color: rgba(62,39,35,0.55);
                    line-height: 1.7; background: #FDF5EE;
                    border: 1px solid #E8D5BC;
                    border-radius: 12px; padding: 14px 18px; margin-bottom: 28px; text-align: left;
                }
                .qz-result-info strong { color: #8C3322; }
                .qz-result-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
                .qz-act-secondary {
                    padding: 12px 22px; border-radius: 50px;
                    border: 1.5px solid #E8D5BC; background: #fff;
                    font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500;
                    color: rgba(62,39,35,0.6); cursor: pointer;
                    transition: border-color 0.2s, color 0.2s;
                    min-height: 48px;
                }
                .qz-act-secondary:hover { border-color: #8C3322; color: #8C3322; }
                .qz-act-primary {
                    padding: 12px 22px; border-radius: 50px; border: none;
                    background: #8C3322; font-family: 'Inter', sans-serif;
                    font-size: 14px; font-weight: 600; color: #fff; cursor: pointer;
                    box-shadow: 0 4px 14px rgba(140,51,34,0.3);
                    transition: opacity 0.2s, transform 0.15s;
                    display: flex; align-items: center; gap: 6px;
                    min-height: 48px;
                }
                .qz-act-primary:hover { opacity: 0.88; transform: translateY(-1px); }

                @media (max-width: 600px) {
                    .qz-grid { grid-template-columns: 1fr; }
                    .qz-content { padding: 24px 16px 60px; }
                    .qz-title { font-size: 26px; }
                    .qz-result-card { padding: 36px 20px; }
                    .qz-result-type { font-size: 18px; }
                }
            `}</style>

            {/* Hero */}
            <div className="qz-hero">
                <div className="qz-hero-inner">
                    <p className="qz-eyebrow">
                        {step === "quiz"      && "Step 1 of 2 — Personality"}
                        {step === "logistics" && "Step 2 of 2 — Trip Details"}
                        {step === "result"    && "Complete"}
                    </p>
                    <h1 className="qz-title">
                        {step === "result"
                            ? "Your Travel Personality"
                            : "Discover Your Travel Personality"}
                    </h1>
                    <p className="qz-sub">
                        {step === "quiz"      && "Rate how accurately each statement describes you (1 = inaccurate, 5 = accurate)."}
                        {step === "logistics" && "Tell us about your trip plans so we can personalise your itinerary."}
                        {step === "result"    && "Based on your OCEAN personality profile."}
                    </p>
                    {step !== "result" && (
                        <div className="qz-steps">
                            <div className="qz-step-dot" style={{ width: 48, background: "#D4A373" }} />
                            <div className="qz-step-dot" style={{ width: 48, background: step === "logistics" ? "#D4A373" : "rgba(255,255,255,0.2)" }} />
                        </div>
                    )}
                </div>
            </div>

            <div className="qz-content">
                {error && (
                    <div className="qz-error">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        {error}
                    </div>
                )}

                {/* STEP 1: 8 OCEAN Questions */}
                {step === "quiz" && (
                    <>
                        <div className="qz-grid">
                            {OCEAN_QUESTIONS.map((q, idx) => (
                                <div key={q.id} className="qz-card">
                                    <div className="qz-card-trait">
                                        <span>{TRAIT_ICONS[q.trait]}</span>
                                        <span>{q.trait}{q.reverse ? " ↩" : ""}</span>
                                    </div>
                                    <p className="qz-card-text">{idx + 1}. {q.text}</p>
                                    <div className="qz-scale">
                                        <span className="qz-scale-lbl">Inaccurate</span>
                                        <div className="qz-radios">
                                            {[1, 2, 3, 4, 5].map(val => (
                                                <label key={val} className="qz-radio-item">
                                                    <input
                                                        type="radio"
                                                        name={q.id}
                                                        checked={scores[q.id] === val}
                                                        onChange={() => setScores(s => ({ ...s, [q.id]: val }))}
                                                    />
                                                    <span className={`qz-radio-val ${scores[q.id] === val ? "on" : ""}`}>{val}</span>
                                                </label>
                                            ))}
                                        </div>
                                        <span className="qz-scale-lbl right">Accurate</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="qz-nav">
                            <button className="qz-btn-next" onClick={handleOceanNext}>
                                Continue → Trip Details
                            </button>
                        </div>
                    </>
                )}

                {/* STEP 2: Duration + Budget */}
                {step === "logistics" && (
                    <>
                        <div style={{ marginBottom: 32 }}>
                            <p className="qz-section-title">9. How long is your trip?</p>
                            <p className="qz-section-sub">This determines how many destinations we include in your itinerary.</p>
                            <div className="qz-options-row">
                                {DURATION_OPTIONS.map(opt => (
                                    <label key={opt.value} className={`qz-opt ${duration === opt.value ? "selected" : ""}`}>
                                        <input type="radio" name="duration" checked={duration === opt.value} onChange={() => setDuration(opt.value)} />
                                        <div>
                                            <div className="qz-opt-label">{opt.label}</div>
                                            <div className="qz-opt-sub">{opt.subLabel}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>

                            <p className="qz-section-title">10. What is your budget preference?</p>
                            <p className="qz-section-sub">Helps us recommend suitable hotels and guides.</p>
                            <div className="qz-options-row">
                                {BUDGET_OPTIONS.map(opt => (
                                    <label key={opt.value} className={`qz-opt ${budget === opt.value ? "selected" : ""}`}>
                                        <input type="radio" name="budget" checked={budget === opt.value} onChange={() => setBudget(opt.value)} />
                                        <div>
                                            <div className="qz-opt-label">{opt.label}</div>
                                            <div className="qz-opt-sub">{opt.subLabel}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="qz-nav">
                            <button className="qz-btn-back" onClick={() => { setError(""); setStep("quiz"); }}>
                                ← Back
                            </button>
                            <button className="qz-btn-submit" onClick={handleSubmit} disabled={loading}>
                                {loading
                                    ? <><span className="qz-spinner" /> Analyzing…</>
                                    : "Discover My Personality ✨"
                                }
                            </button>
                        </div>
                    </>
                )}

                {/* RESULT */}
                {step === "result" && result && (
                    <div className="qz-result">
                        <div className="qz-result-card">
                            <div className="qz-result-emoji">{info.emoji}</div>
                            <p className="qz-result-eyebrow">Analysis Complete 🎉</p>
                            <h2 className="qz-result-headline">Your Travel Personality</h2>
                            <div className="qz-result-type">{result.personality_type}</div>
                            <p className="qz-result-desc">{info.desc}</p>

                            <div className="qz-result-info">
                                <strong>What's next?</strong><br />
                                Your personality profile has been saved. Head to your dashboard to
                                view your full OCEAN breakdown and radar chart. From there you'll be
                                able to browse matched locations, hotels, and guides — then build
                                your complete personalised itinerary.
                            </div>

                            <div className="qz-result-actions">
                                <button className="qz-act-secondary" onClick={handleRetake}>
                                    Retake Quiz
                                </button>
                                <button className="qz-act-primary" onClick={() => navigate("/dashboard")}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                                    View Dashboard
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
