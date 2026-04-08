import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";

export default function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState("");
    const { login }               = useContext(AuthContext);
    const navigate                = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!username.trim() && !password.trim()) { setError("Username and password are required"); return; }
        if (!username.trim()) { setError("Username is required"); return; }
        if (!password.trim()) { setError("Password is required"); return; }

        setLoading(true);
        setError("");
        try {
            const form = new URLSearchParams();
            form.append("username", username);
            form.append("password", password);

            const res = await API.post("/login", form, {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            });

            login(res.data);

            // ── KEY CHANGE: first-time users go to quiz ──
            if (res.data.quiz_completed === false) {
                navigate("/quiz");
            } else {
                navigate("/dashboard");
            }
        } catch (err) {
            setError(
                err?.response?.data?.detail ||
                err?.response?.data?.message ||
                "Login failed. Check username/password."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                .auth-root { min-height: 100vh; background: #e8f0ef; display: flex; font-family: 'DM Sans', sans-serif; }
                .auth-sidebar { width: 260px; min-height: 100vh; background: #2d4a47; display: flex; flex-direction: column; padding: 36px 28px; flex-shrink: 0; box-shadow: 4px 0 24px rgba(29,58,54,0.2); }
                .auth-sidebar-brand { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 600; color: #e8f0ef; margin-bottom: 48px; letter-spacing: 0.02em; }
                .auth-sidebar-tagline { font-size: 13px; color: rgba(232,240,239,0.5); line-height: 1.7; font-weight: 300; }
                .auth-main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 24px; }
                .auth-card { width: 100%; max-width: 420px; background: #4d8a82; border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 48px 40px 44px; box-shadow: 0 8px 40px rgba(29,58,54,0.25); animation: cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) both; }
                @keyframes cardReveal { from { opacity:0; transform:translateY(20px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }
                .auth-logo-mark { width: 44px; height: 44px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 10px; margin-bottom: 28px; display: flex; align-items: center; justify-content: center; }
                .auth-logo-mark svg { width: 22px; height: 22px; color: #ffffff; }
                .auth-heading { font-family: 'Playfair Display', serif; font-size: 30px; font-weight: 500; color: #ffffff; letter-spacing: -0.3px; line-height: 1.1; margin-bottom: 6px; }
                .auth-subheading { font-size: 13.5px; color: rgba(255,255,255,0.6); font-weight: 300; margin-bottom: 32px; }
                .field-group { margin-bottom: 16px; }
                .field-label { display: block; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.65); margin-bottom: 8px; }
                .field-input { width: 100%; background: rgba(255,255,255,0.85); border: 1px solid rgba(255,255,255,0.6); border-radius: 10px; padding: 13px 16px; font-family: 'DM Sans', sans-serif; font-size: 14px; color: #1a2e2b; outline: none; transition: border-color 0.2s, background 0.2s, box-shadow 0.2s; caret-color: #2d4a47; }
                .field-input::placeholder { color: rgba(45,74,71,0.4); }
                .field-input:focus { border-color: rgba(255,255,255,0.9); background: #ffffff; box-shadow: 0 0 0 3px rgba(255,255,255,0.15); }
                .error-msg { display: flex; align-items: center; gap: 8px; background: rgba(139,26,26,0.25); border: 1px solid rgba(139,26,26,0.5); border-radius: 8px; padding: 11px 14px; font-size: 12.5px; color: #ffb4b4; margin-bottom: 20px; }
                .submit-btn { width: 100%; padding: 14px; margin-top: 24px; background: #2d4a47; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; color: #e8f0ef; letter-spacing: 0.04em; cursor: pointer; transition: background 0.2s, transform 0.15s, box-shadow 0.2s; box-shadow: 0 4px 14px rgba(29,58,54,0.3); }
                .submit-btn:hover:not(:disabled) { background: #1e3330; transform: translateY(-1px); }
                .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .btn-spinner { width: 16px; height: 16px; border: 2px solid rgba(232,240,239,0.3); border-top-color: #e8f0ef; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; vertical-align: middle; margin-right: 8px; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .auth-footer { margin-top: 24px; text-align: center; font-size: 13px; color: rgba(255,255,255,0.5); }
                .auth-footer a { color: rgba(255,255,255,0.85); text-decoration: none; font-weight: 500; }
                .auth-footer a:hover { color: #ffffff; }
                .divider { height: 1px; background: rgba(255,255,255,0.15); margin: 24px 0; }
                @media (max-width: 640px) { .auth-sidebar { display: none; } .auth-card { padding: 36px 28px 32px; } }
            `}</style>
            <div className="auth-root">
                <div className="auth-sidebar">
                    <div className="auth-sidebar-brand">Vibe Lanka</div>
                    <div className="auth-sidebar-tagline">Discover your perfect Sri Lankan journey based on your personality.</div>
                </div>
                <div className="auth-main">
                    <div className="auth-card">
                        <div className="auth-logo-mark">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                            </svg>
                        </div>
                        <h1 className="auth-heading">Welcome back</h1>
                        <p className="auth-subheading">Sign in to continue to your account</p>
                        {error && (
                            <div className="error-msg">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                {error}
                            </div>
                        )}
                        <form onSubmit={handleLogin}>
                            <div className="field-group">
                                <label className="field-label">Username</label>
                                <input className="field-input" placeholder="Enter your username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" />
                            </div>
                            <div className="field-group">
                                <label className="field-label">Password</label>
                                <input type="password" className="field-input" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
                            </div>
                            <button type="submit" className="submit-btn" disabled={loading}>
                                {loading && <span className="btn-spinner" />}
                                {loading ? "Signing in…" : "Sign in"}
                            </button>
                        </form>
                        <div className="divider" />
                        <div className="auth-footer">Don't have an account? <a href="/register">Create one</a></div>
                    </div>
                </div>
            </div>
        </>
    );
}