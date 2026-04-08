import { Link, useNavigate, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function Navbar() {
    const { logout, quizCompleted } = useContext(AuthContext);
    const navigate  = useNavigate();
    const location  = useLocation();
    const handleLogout = () => { logout(); navigate("/login"); };
    const isActive = (path) => location.pathname === path;

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');
                .navbar { position: sticky; top: 0; z-index: 100; background: #2d4a47; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 0 32px; height: 64px; display: flex; align-items: center; justify-content: space-between; font-family: 'DM Sans', sans-serif; box-shadow: 0 2px 16px rgba(29,58,54,0.35); }
                .navbar-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
                .navbar-logo-mark { width: 34px; height: 34px; background: linear-gradient(135deg, #4d8a82, #7ab8b0); border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(77,138,130,0.4); }
                .navbar-logo-mark svg { width: 17px; height: 17px; color: #ffffff; }
                .navbar-brand-name { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 600; color: #e8f0ef; letter-spacing: 0.02em; }
                .navbar-links { display: flex; align-items: center; gap: 4px; }
                .nav-link { position: relative; padding: 7px 12px; font-size: 13px; font-weight: 500; color: rgba(232,240,239,0.6); text-decoration: none; border-radius: 8px; transition: color 0.2s, background 0.2s; display: inline-flex; align-items: center; gap: 5px; }
                .nav-link:hover { color: #e8f0ef; background: rgba(255,255,255,0.08); }
                .nav-link-active { color: #e8f0ef !important; background: rgba(77,138,130,0.35) !important; }
                .nav-link-active::after { content: ''; position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 18px; height: 2px; background: #7ab8b0; border-radius: 2px; }
                .nav-badge { width: 7px; height: 7px; background: #ffcc00; border-radius: 50%; box-shadow: 0 0 6px rgba(255,204,0,0.7); animation: pulse 2s infinite; }
                @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.5} }
                .nav-divider { width: 1px; height: 20px; background: rgba(255,255,255,0.12); margin: 0 6px; }
                .logout-btn { padding: 8px 14px; background: rgba(139,26,26,0.15); border: 1px solid rgba(139,26,26,0.4); border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 12.5px; font-weight: 500; color: rgba(255,180,180,0.85); cursor: pointer; display: flex; align-items: center; gap: 5px; transition: background 0.2s, border-color 0.2s, color 0.2s; }
                .logout-btn:hover { background: rgba(139,26,26,0.3); border-color: rgba(139,26,26,0.7); color: #ffb4b4; }
                @media (max-width: 680px) { .navbar { padding: 0 12px; } .navbar-brand-name { display: none; } .nav-link { padding: 6px 8px; font-size: 12px; } }
            `}</style>
            <nav className="navbar">
                <Link to="/dashboard" className="navbar-brand">
                    <div className="navbar-logo-mark">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                        </svg>
                    </div>
                    <span className="navbar-brand-name">VibeLanka</span>
                </Link>

                <div className="navbar-links">
                    <Link to="/dashboard"   className={`nav-link ${isActive("/dashboard")   ? "nav-link-active" : ""}`}>Dashboard</Link>
                    <Link to="/quiz"        className={`nav-link ${isActive("/quiz")        ? "nav-link-active" : ""}`}>
                        Quiz {quizCompleted === false && <span className="nav-badge" />}
                    </Link>
                    <Link to="/locations"   className={`nav-link ${isActive("/locations")   ? "nav-link-active" : ""}`}>Locations</Link>
                    <Link to="/hotels"      className={`nav-link ${isActive("/hotels")      ? "nav-link-active" : ""}`}>Hotels</Link>
                    <Link to="/itineraries" className={`nav-link ${isActive("/itineraries") ? "nav-link-active" : ""}`}>My Trips</Link>
                    <div className="nav-divider" />
                    <button className="logout-btn" onClick={handleLogout}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Logout
                    </button>
                </div>
            </nav>
        </>
    );
}