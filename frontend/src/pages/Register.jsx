import { useState } from "react";
import API from "../services/api";
import { useNavigate } from "react-router-dom";

// Common country codes for international travellers
const COUNTRY_CODES = [
    { code: "+1",   label: "🇺🇸 +1 (US/Canada)" },
    { code: "+44",  label: "🇬🇧 +44 (UK)" },
    { code: "+61",  label: "🇦🇺 +61 (Australia)" },
    { code: "+49",  label: "🇩🇪 +49 (Germany)" },
    { code: "+33",  label: "🇫🇷 +33 (France)" },
    { code: "+39",  label: "🇮🇹 +39 (Italy)" },
    { code: "+34",  label: "🇪🇸 +34 (Spain)" },
    { code: "+31",  label: "🇳🇱 +31 (Netherlands)" },
    { code: "+46",  label: "🇸🇪 +46 (Sweden)" },
    { code: "+47",  label: "🇳🇴 +47 (Norway)" },
    { code: "+45",  label: "🇩🇰 +45 (Denmark)" },
    { code: "+41",  label: "🇨🇭 +41 (Switzerland)" },
    { code: "+43",  label: "🇦🇹 +43 (Austria)" },
    { code: "+32",  label: "🇧🇪 +32 (Belgium)" },
    { code: "+351", label: "🇵🇹 +351 (Portugal)" },
    { code: "+81",  label: "🇯🇵 +81 (Japan)" },
    { code: "+82",  label: "🇰🇷 +82 (South Korea)" },
    { code: "+86",  label: "🇨🇳 +86 (China)" },
    { code: "+91",  label: "🇮🇳 +91 (India)" },
    { code: "+94",  label: "🇱🇰 +94 (Sri Lanka)" },
    { code: "+65",  label: "🇸🇬 +65 (Singapore)" },
    { code: "+60",  label: "🇲🇾 +60 (Malaysia)" },
    { code: "+66",  label: "🇹🇭 +66 (Thailand)" },
    { code: "+62",  label: "🇮🇩 +62 (Indonesia)" },
    { code: "+63",  label: "🇵🇭 +63 (Philippines)" },
    { code: "+84",  label: "🇻🇳 +84 (Vietnam)" },
    { code: "+971", label: "🇦🇪 +971 (UAE)" },
    { code: "+966", label: "🇸🇦 +966 (Saudi Arabia)" },
    { code: "+972", label: "🇮🇱 +972 (Israel)" },
    { code: "+90",  label: "🇹🇷 +90 (Turkey)" },
    { code: "+7",   label: "🇷🇺 +7 (Russia)" },
    { code: "+55",  label: "🇧🇷 +55 (Brazil)" },
    { code: "+52",  label: "🇲🇽 +52 (Mexico)" },
    { code: "+54",  label: "🇦🇷 +54 (Argentina)" },
    { code: "+27",  label: "🇿🇦 +27 (South Africa)" },
    { code: "+20",  label: "🇪🇬 +20 (Egypt)" },
    { code: "+234", label: "🇳🇬 +234 (Nigeria)" },
    { code: "+254", label: "🇰🇪 +254 (Kenya)" },
    { code: "+64",  label: "🇳🇿 +64 (New Zealand)" },
];

function LiyavelWatermarkAuth() {
    return (
        <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", opacity: 0.1, pointerEvents: "none", overflow: "hidden" }}>
            <svg viewBox="0 0 120 480" width="120" height="480" fill="white" xmlns="http://www.w3.org/2000/svg">
                <path d="M60,480 C42,445 78,410 60,375 C42,340 78,305 60,270 C42,235 78,200 60,165 C42,130 78,95 60,60 C52,40 58,20 60,0"
                      fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M60,430 C38,408 16,418 22,440 C38,432 54,430 60,430Z" />
                <path d="M60,430 C82,408 104,418 98,440 C82,432 66,430 60,430Z" />
                <path d="M60,340 C38,318 16,328 22,350 C38,342 54,340 60,340Z" />
                <path d="M60,340 C82,318 104,328 98,350 C82,342 66,340 60,340Z" />
                <path d="M60,268 C55,248 44,240 44,254 C44,267 53,272 60,268Z" />
                <path d="M60,268 C65,248 76,240 76,254 C76,267 67,272 60,268Z" />
                <circle cx="60" cy="263" r="4.5" />
                <path d="M60,200 C38,178 16,188 22,210 C38,202 54,200 60,200Z" />
                <path d="M60,200 C82,178 104,188 98,210 C82,202 66,200 60,200Z" />
                <path d="M60,110 C55,90 44,82 44,96 C44,109 53,114 60,110Z" />
                <path d="M60,110 C65,90 76,82 76,96 C76,109 67,114 60,110Z" />
                <circle cx="60" cy="105" r="4.5" />
                <path d="M60,52 C38,30 16,40 22,62 C38,54 54,52 60,52Z" />
                <path d="M60,52 C82,30 104,40 98,62 C82,54 66,52 60,52Z" />
            </svg>
        </div>
    );
}

export default function Register() {
    const [data, setData]               = useState({});
    const [countryCode, setCountryCode] = useState("+1");
    const [phoneLocal, setPhoneLocal]   = useState("");
    const [loading, setLoading]         = useState(false);
    const [error, setError]             = useState("");
    const navigate = useNavigate();

    const handleRegister = async () => {
        const trimmedPhone = phoneLocal.trim();
        if (trimmedPhone && !/^\d{4,15}$/.test(trimmedPhone)) {
            setError("Phone number should be digits only (4–15 digits), without the country code.");
            return;
        }

        const contact_number = trimmedPhone ? `${countryCode}${trimmedPhone}` : "";

        setLoading(true);
        setError("");
        try {
            await API.post("/register", { ...data, contact_number });
            navigate("/login");
        } catch (err) {
            const msg =
                err?.response?.data?.detail ||
                err?.response?.data?.message ||
                "Registration failed. Please try again.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

                .auth-root {
                    min-height: 100vh;
                    display: flex;
                    font-family: 'Inter', sans-serif;
                }

                /* Left panel */
                .auth-panel {
                    width: 380px;
                    min-height: 100vh;
                    background: #8C3322;
                    display: flex;
                    flex-direction: column;
                    padding: 52px 40px;
                    flex-shrink: 0;
                    position: relative;
                    overflow: hidden;
                }
                .auth-panel-logo {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 52px;
                }
                .auth-panel-logo-mark {
                    width: 44px; height: 44px;
                    background: rgba(255,255,255,0.15);
                    border: 1.5px solid rgba(255,255,255,0.3);
                    border-radius: 12px;
                    display: flex; align-items: center; justify-content: center;
                }
                .auth-panel-logo-mark svg { width: 22px; height: 22px; color: white; }
                .auth-panel-brand {
                    font-family: 'Playfair Display', serif;
                    font-size: 22px;
                    font-weight: 600;
                    color: #fff;
                }
                .auth-panel-sub { font-size: 11px; color: rgba(255,255,255,0.45); letter-spacing: 0.1em; text-transform: uppercase; }
                .auth-panel-headline {
                    font-family: 'Playfair Display', serif;
                    font-size: 34px;
                    font-weight: 500;
                    color: #fff;
                    line-height: 1.2;
                    margin-bottom: 18px;
                    letter-spacing: -0.3px;
                }
                .auth-panel-tagline {
                    font-size: 15px;
                    color: rgba(255,255,255,0.55);
                    line-height: 1.75;
                    font-weight: 300;
                }
                .auth-panel-bullets {
                    margin-top: 36px;
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }
                .auth-panel-bullet {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 14px;
                    color: rgba(255,255,255,0.65);
                }
                .auth-panel-bullet-dot {
                    width: 7px; height: 7px;
                    border-radius: 50%;
                    background: #D4A373;
                    flex-shrink: 0;
                }

                /* Right panel */
                .auth-main {
                    flex: 1;
                    background: #F9F6F0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 24px;
                    overflow-y: auto;
                }
                .auth-card {
                    width: 100%;
                    max-width: 460px;
                    background: #FFFFFF;
                    border: 1px solid #E8D5BC;
                    border-radius: 20px;
                    padding: 48px 40px 44px;
                    box-shadow: 0 2px 14px rgba(62,39,35,0.08);
                    animation: cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) both;
                }
                @keyframes cardReveal {
                    from { opacity: 0; transform: translateY(20px) scale(0.98); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }

                .auth-card-eyebrow {
                    font-size: 11px; font-weight: 700; letter-spacing: 0.14em;
                    text-transform: uppercase; color: #8C3322; margin-bottom: 10px;
                }
                .auth-heading {
                    font-family: 'Playfair Display', serif;
                    font-size: 30px;
                    font-weight: 500;
                    color: #3E2723;
                    letter-spacing: -0.3px;
                    margin-bottom: 6px;
                }
                .auth-subheading {
                    font-size: 15px;
                    color: rgba(62,39,35,0.5);
                    font-weight: 300;
                    margin-bottom: 28px;
                }

                .field-group { margin-bottom: 16px; }
                .field-label {
                    display: block;
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    color: rgba(62,39,35,0.55);
                    margin-bottom: 7px;
                }
                .field-label-opt {
                    font-size: 10px;
                    margin-left: 6px;
                    opacity: 0.6;
                    font-weight: 400;
                    text-transform: none;
                    letter-spacing: 0;
                }
                .field-input {
                    width: 100%;
                    background: #FFFFFF;
                    border: 1.5px solid #E8D5BC;
                    border-radius: 10px;
                    padding: 13px 16px;
                    font-family: 'Inter', sans-serif;
                    font-size: 16px;
                    color: #3E2723;
                    outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    caret-color: #8C3322;
                }
                .field-input::placeholder { color: rgba(62,39,35,0.3); }
                .field-input:focus {
                    border-color: #8C3322;
                    box-shadow: 0 0 0 3px rgba(140,51,34,0.1);
                }
                .field-hint {
                    font-size: 12px;
                    color: rgba(62,39,35,0.4);
                    margin-top: 6px;
                }

                .error-msg {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: rgba(140,51,34,0.07);
                    border: 1px solid rgba(140,51,34,0.25);
                    border-radius: 10px;
                    padding: 11px 14px;
                    font-size: 13.5px;
                    color: #8C3322;
                    margin-bottom: 20px;
                }

                /* Phone input */
                .phone-row {
                    display: flex;
                    gap: 10px;
                }
                .phone-code-select {
                    width: 150px;
                    background: #FFFFFF;
                    border: 1.5px solid #E8D5BC;
                    border-radius: 10px;
                    padding: 13px 10px;
                    font-family: 'Inter', sans-serif;
                    font-size: 13px;
                    color: #3E2723;
                    outline: none;
                    flex-shrink: 0;
                    cursor: pointer;
                }
                .phone-code-select:focus {
                    border-color: #8C3322;
                    box-shadow: 0 0 0 3px rgba(140,51,34,0.1);
                }
                .phone-number-input {
                    flex: 1;
                }

                .submit-btn {
                    width: 100%;
                    padding: 15px;
                    margin-top: 22px;
                    background: #8C3322;
                    border: none;
                    border-radius: 50px;
                    font-family: 'Inter', sans-serif;
                    font-size: 16px;
                    font-weight: 600;
                    color: #ffffff;
                    letter-spacing: 0.02em;
                    cursor: pointer;
                    transition: opacity 0.2s, transform 0.15s;
                    min-height: 52px;
                    box-shadow: 0 4px 14px rgba(140,51,34,0.3);
                }
                .submit-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
                .submit-btn:active:not(:disabled) { transform: translateY(0); }
                .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                .btn-spinner {
                    width: 16px; height: 16px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: spin 0.7s linear infinite;
                    display: inline-block; vertical-align: middle; margin-right: 8px;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                .terms-note {
                    font-size: 12px;
                    color: rgba(62,39,35,0.4);
                    text-align: center;
                    margin-top: 14px;
                    line-height: 1.6;
                }
                .terms-note a { color: #8C3322; text-decoration: none; font-weight: 500; }
                .terms-note a:hover { text-decoration: underline; }

                .divider {
                    height: 1px;
                    background: #E8D5BC;
                    margin: 22px 0;
                }

                .auth-footer {
                    text-align: center;
                    font-size: 14px;
                    color: rgba(62,39,35,0.5);
                }
                .auth-footer a { color: #8C3322; text-decoration: none; font-weight: 600; }
                .auth-footer a:hover { text-decoration: underline; }

                @media (max-width: 860px) {
                    .auth-panel { display: none; }
                }
                @media (max-width: 500px) {
                    .auth-card { padding: 36px 20px 32px; border-radius: 16px; }
                    .auth-main { padding: 20px 12px; }
                }
            `}</style>

            <div className="auth-root">
                {/* Left panel */}
                <div className="auth-panel">
                    <div className="auth-panel-logo">
                        <div className="auth-panel-logo-mark">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 3C10 7 6 9 4 13c-2 4 0 8 4 10 2 1 3 1 4 2 1-1 2-1 4-2 4-2 6-6 4-10-2-4-6-6-8-10z"/>
                                <path d="M12 8c-1 2.5-3 4-4 6.5s0 5 4 6.5c4-1.5 5-4 4-6.5S13 10.5 12 8z" strokeWidth="1.5"/>
                            </svg>
                        </div>
                        <div>
                            <div className="auth-panel-brand">Vibe Lanka</div>
                            <div className="auth-panel-sub">Travel Planner</div>
                        </div>
                    </div>

                    <h2 className="auth-panel-headline">
                        Start your<br />Sri Lanka<br />journey.
                    </h2>
                    <p className="auth-panel-tagline">
                        Create an account in seconds and unlock your personalised travel experience.
                    </p>

                    <div className="auth-panel-bullets">
                        <div className="auth-panel-bullet">
                            <span className="auth-panel-bullet-dot" />
                            50-item OCEAN personality quiz
                        </div>
                        <div className="auth-panel-bullet">
                            <span className="auth-panel-bullet-dot" />
                            30+ matched Sri Lankan destinations
                        </div>
                        <div className="auth-panel-bullet">
                            <span className="auth-panel-bullet-dot" />
                            AI-powered route optimisation
                        </div>
                    </div>

                    <LiyavelWatermarkAuth />
                </div>

                {/* Right panel */}
                <div className="auth-main">
                    <div className="auth-card">
                        <p className="auth-card-eyebrow">New account</p>
                        <h1 className="auth-heading">Create account</h1>
                        <p className="auth-subheading">Join us — it only takes a moment.</p>

                        {error && (
                            <div className="error-msg">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                {error}
                            </div>
                        )}

                        <div className="field-group">
                            <label className="field-label">Username</label>
                            <input
                                className="field-input"
                                placeholder="Choose a username"
                                onChange={e => setData({ ...data, username: e.target.value })}
                                autoComplete="username"
                            />
                        </div>

                        <div className="field-group">
                            <label className="field-label">Email address</label>
                            <input
                                className="field-input"
                                placeholder="you@example.com"
                                type="email"
                                onChange={e => setData({ ...data, email: e.target.value })}
                                autoComplete="email"
                            />
                        </div>

                        <div className="field-group">
                            <label className="field-label">Password</label>
                            <input
                                type="password"
                                className="field-input"
                                placeholder="Create a strong password"
                                onChange={e => setData({ ...data, password: e.target.value })}
                                autoComplete="new-password"
                            />
                            <p className="field-hint">Use at least 8 characters</p>
                        </div>

                        <div className="field-group">
                            <label className="field-label">
                                Phone number
                                <span className="field-label-opt">(optional)</span>
                            </label>
                            <div className="phone-row">
                                <select
                                    className="phone-code-select"
                                    value={countryCode}
                                    onChange={e => setCountryCode(e.target.value)}
                                >
                                    {COUNTRY_CODES.map(c => (
                                        <option key={c.code} value={c.code}>{c.label}</option>
                                    ))}
                                </select>
                                <input
                                    className="field-input phone-number-input"
                                    placeholder="e.g. 7911123456"
                                    type="tel"
                                    value={phoneLocal}
                                    onChange={e => setPhoneLocal(e.target.value.replace(/\D/g, ""))}
                                    autoComplete="tel-national"
                                    maxLength={15}
                                />
                            </div>
                            <p className="field-hint">Digits only — no spaces or dashes</p>
                        </div>

                        <button onClick={handleRegister} className="submit-btn" disabled={loading}>
                            {loading && <span className="btn-spinner" />}
                            {loading ? "Creating account…" : "Create account"}
                        </button>

                        <p className="terms-note">
                            By registering you agree to our <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>
                        </p>

                        <div className="divider" />

                        <div className="auth-footer">
                            Already have an account? <a href="/login">Sign in</a>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
