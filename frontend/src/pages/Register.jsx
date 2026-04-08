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

export default function Register() {
    const [data, setData]           = useState({});
    const [countryCode, setCountryCode] = useState("+1");
    const [phoneLocal, setPhoneLocal]   = useState("");
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState("");
    const navigate = useNavigate();

    const handleRegister = async () => {
        // Basic phone validation
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
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');
 
                * { box-sizing: border-box; margin: 0; padding: 0; }
 
                .auth-root {
                    min-height: 100vh;
                    background: #e8f0ef;
                    display: flex;
                    font-family: 'DM Sans', sans-serif;
                    position: relative;
                    overflow: hidden;
                }
 
                .auth-sidebar {
                    width: 260px;
                    min-height: 100vh;
                    background: #2d4a47;
                    display: flex;
                    flex-direction: column;
                    padding: 36px 28px;
                    flex-shrink: 0;
                    box-shadow: 4px 0 24px rgba(29,58,54,0.2);
                }
                .auth-sidebar-brand {
                    font-family: 'Playfair Display', serif;
                    font-size: 22px;
                    font-weight: 600;
                    color: #e8f0ef;
                    margin-bottom: 48px;
                    letter-spacing: 0.02em;
                }
                .auth-sidebar-tagline {
                    font-size: 13px;
                    color: rgba(232,240,239,0.5);
                    line-height: 1.7;
                    font-weight: 300;
                }
 
                .auth-main {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 24px;
                }
 
                .auth-card {
                    width: 100%;
                    max-width: 440px;
                    background: #4d8a82;
                    border: 1px solid rgba(255,255,255,0.15);
                    border-radius: 16px;
                    padding: 48px 40px 44px;
                    box-shadow: 0 8px 40px rgba(29,58,54,0.25), 0 2px 8px rgba(29,58,54,0.15);
                    animation: cardReveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
                }
 
                @keyframes cardReveal {
                    from { opacity: 0; transform: translateY(20px) scale(0.98); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
 
                .auth-logo-mark {
                    width: 44px; height: 44px;
                    background: rgba(255,255,255,0.15);
                    border: 1px solid rgba(255,255,255,0.25);
                    border-radius: 10px;
                    margin-bottom: 28px;
                    display: flex; align-items: center; justify-content: center;
                }
                .auth-logo-mark svg { width: 22px; height: 22px; color: #ffffff; }
 
                .auth-heading {
                    font-family: 'Playfair Display', serif;
                    font-size: 30px;
                    font-weight: 500;
                    color: #ffffff;
                    letter-spacing: -0.3px;
                    line-height: 1.1;
                    margin-bottom: 6px;
                }
                .auth-subheading {
                    font-size: 13.5px;
                    color: rgba(255,255,255,0.6);
                    font-weight: 300;
                    margin-bottom: 32px;
                }
 
                .field-group { margin-bottom: 16px; }
                .field-label {
                    display: block;
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    color: rgba(255,255,255,0.65);
                    margin-bottom: 8px;
                }
                .field-input {
                    width: 100%;
                    background: rgba(255,255,255,0.85);
                    border: 1px solid rgba(255,255,255,0.6);
                    border-radius: 10px;
                    padding: 13px 16px;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 14px;
                    color: #1a2e2b;
                    outline: none;
                    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
                    caret-color: #2d4a47;
                }
                .field-input::placeholder { color: rgba(45,74,71,0.4); }
                .field-input:focus {
                    border-color: rgba(255,255,255,0.9);
                    background: #ffffff;
                    box-shadow: 0 0 0 3px rgba(255,255,255,0.15);
                }
                .field-hint {
                    font-size: 11.5px;
                    color: rgba(255,255,255,0.4);
                    margin-top: 6px;
                }
 
                .error-msg {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: rgba(139,26,26,0.25);
                    border: 1px solid rgba(139,26,26,0.5);
                    border-radius: 8px;
                    padding: 11px 14px;
                    font-size: 12.5px;
                    color: #ffb4b4;
                    margin-bottom: 20px;
                }
 
                .submit-btn {
                    width: 100%;
                    padding: 14px;
                    margin-top: 24px;
                    background: #2d4a47;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 10px;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 14px;
                    font-weight: 600;
                    color: #e8f0ef;
                    letter-spacing: 0.04em;
                    cursor: pointer;
                    transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
                    box-shadow: 0 4px 14px rgba(29,58,54,0.3);
                }
                .submit-btn:hover:not(:disabled) {
                    background: #1e3330;
                    transform: translateY(-1px);
                    box-shadow: 0 8px 22px rgba(29,58,54,0.4);
                }
                .submit-btn:active:not(:disabled) { transform: translateY(0); }
                .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
 
                .btn-spinner {
                    width: 16px; height: 16px;
                    border: 2px solid rgba(232,240,239,0.3);
                    border-top-color: #e8f0ef;
                    border-radius: 50%;
                    animation: spin 0.7s linear infinite;
                    display: inline-block; vertical-align: middle; margin-right: 8px;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
 
                .terms-note {
                    font-size: 11.5px;
                    color: rgba(255,255,255,0.4);
                    text-align: center;
                    margin-top: 16px;
                    line-height: 1.6;
                }
                .terms-note a { color: rgba(255,255,255,0.65); text-decoration: none; }
                .terms-note a:hover { color: #ffffff; }
 
                .divider {
                    height: 1px;
                    background: rgba(255,255,255,0.15);
                    margin: 24px 0;
                }
 
                .auth-footer {
                    text-align: center;
                    font-size: 13px;
                    color: rgba(255,255,255,0.5);
                }
                .auth-footer a {
                    color: rgba(255,255,255,0.85);
                    text-decoration: none;
                    font-weight: 500;
                }
                .auth-footer a:hover { color: #ffffff; }
 
                @media (max-width: 640px) {
                    .auth-sidebar { display: none; }
                    .auth-card { padding: 36px 28px 32px; }
                }
                /* Background orbs */
.auth-bg-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
    opacity: 0.4;
    z-index: 0;
}

.orb-1 {
    width: 300px;
    height: 300px;
    background: #7ed6c4;
    top: -80px;
    right: -80px;
}

.orb-2 {
    width: 250px;
    height: 250px;
    background: #2d4a47;
    bottom: -80px;
    left: -80px;
}

/* Phone input layout */
.phone-row {
    display: flex;
    gap: 10px;
}

.phone-code-select {
    width: 130px;
    background: rgba(255,255,255,0.85);
    border: 1px solid rgba(255,255,255,0.6);
    border-radius: 10px;
    padding: 13px 10px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #1a2e2b;
    outline: none;
}

.phone-code-select:focus {
    background: #ffffff;
}

.phone-number-input {
    flex: 1;
}

/* Optional label text */
.field-label-opt {
    font-size: 10px;
    margin-left: 6px;
    opacity: 0.6;
}

.auth-card {
    position: relative;
    z-index: 1;
}
            `}</style>

            <div className="auth-root">
                <div className="auth-bg-orb orb-1" />
                <div className="auth-bg-orb orb-2" />

                <div className="auth-sidebar">
                    <div className="auth-sidebar-brand">Vibe Lanka</div>
                    <div className="auth-sidebar-tagline">
                        Discover your perfect Sri Lankan journey based on your personality.
                    </div>
                </div>

                <div className="auth-main">
                <div className="auth-card">
                    <div className="auth-logo-mark">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                            <path d="M2 17l10 5 10-5"/>
                            <path d="M2 12l10 5 10-5"/>
                        </svg>
                    </div>

                    <h1 className="auth-heading">Create account</h1>
                    <p className="auth-subheading">Join us — it only takes a moment</p>

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