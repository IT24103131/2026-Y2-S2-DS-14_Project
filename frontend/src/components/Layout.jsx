import { useContext, useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// Layout.jsx  —  shared sidebar shell for all protected pages
// Design system: primary-rust #8C3322 · bg-cream #F9F6F0 · surface-white #FFF
//                text-dark #3E2723 · accent-green #4A5D23 · accent-gold #D4A373
// ─────────────────────────────────────────────────────────────────────────────

function getUsernameFromToken() {
    try {
        const token = localStorage.getItem("token");
        if (!token) return "Traveller";
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.sub || payload.username || payload.name || "Traveller";
    } catch {
        return "Traveller";
    }
}

function LiyavelWatermark() {
    return (
        <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", opacity: 0.08, pointerEvents: "none", overflow: "hidden" }}>
            <svg viewBox="0 0 120 480" width="120" height="480" fill="white" xmlns="http://www.w3.org/2000/svg">
                <path d="M60,480 C42,445 78,410 60,375 C42,340 78,305 60,270 C42,235 78,200 60,165 C42,130 78,95 60,60 C52,40 58,20 60,0"
                      fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M60,430 C38,408 16,418 22,440 C38,432 54,430 60,430Z" />
                <path d="M60,430 C82,408 104,418 98,440 C82,432 66,430 60,430Z" />
                <path d="M60,430 C50,414 40,410 44,420" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" />
                <path d="M60,340 C38,318 16,328 22,350 C38,342 54,340 60,340Z" />
                <path d="M60,340 C82,318 104,328 98,350 C82,342 66,340 60,340Z" />
                <path d="M60,268 C55,248 44,240 44,254 C44,267 53,272 60,268Z" />
                <path d="M60,268 C65,248 76,240 76,254 C76,267 67,272 60,268Z" />
                <path d="M60,272 C56,256 50,248 54,258" fill="none" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M60,272 C64,256 70,248 66,258" fill="none" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="60" cy="263" r="4.5" />
                <path d="M60,200 C38,178 16,188 22,210 C38,202 54,200 60,200Z" />
                <path d="M60,200 C82,178 104,188 98,210 C82,202 66,200 60,200Z" />
                <path d="M60,200 C50,184 40,180 44,190" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" />
                <path d="M60,110 C55,90 44,82 44,96 C44,109 53,114 60,110Z" />
                <path d="M60,110 C65,90 76,82 76,96 C76,109 67,114 60,110Z" />
                <circle cx="60" cy="105" r="4.5" />
                <path d="M60,52 C38,30 16,40 22,62 C38,54 54,52 60,52Z" />
                <path d="M60,52 C82,30 104,40 98,62 C82,54 66,52 60,52Z" />
                <path d="M60,52 C50,36 40,32 44,42" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" />
            </svg>
        </div>
    );
}

const NAV_ITEMS = [
    {
        to: "/dashboard", label: "Dashboard",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
        ),
    },
    {
        to: "/quiz", label: "Personality Quiz",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
            </svg>
        ),
    },
    {
        to: "/locations", label: "Locations",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
            </svg>
        ),
    },
    {
        to: "/hotels", label: "Hotels",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 22V8l9-6 9 6v14H3z"/><path d="M9 22V12h6v10"/>
            </svg>
        ),
    },
    {
        to: "/guides", label: "Guides",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
            </svg>
        ),
    },
    {
        to: "/itineraries/plan", label: "Plan My Trip",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
        ),
    },
    {
        to: "/itineraries", label: "My Trips",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
        ),
    },
];

export default function Layout({ children }) {
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileSidebar, setMobileSidebar] = useState(false);

    const username = getUsernameFromToken();

    useEffect(() => {
        const onResize = () => { if (window.innerWidth > 900) setMobileSidebar(false); };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const handleLogout = () => { logout(); navigate("/login"); };
    const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + "/");

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap');

                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

                .vl-app { display: flex; min-height: 100vh; font-family: 'Inter', sans-serif; }

                /* ── Sidebar ── */
                .vl-sidebar {
                    width: 268px; flex-shrink: 0;
                    background: #8C3322;
                    position: fixed; top: 0; left: 0; height: 100vh;
                    display: flex; flex-direction: column;
                    z-index: 200;
                    box-shadow: 4px 0 24px rgba(0,0,0,0.18);
                    overflow: hidden;
                    transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
                }
                .vl-sidebar-top {
                    padding: 28px 24px 20px;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .vl-logo { display: flex; align-items: center; gap: 12px; text-decoration: none; }
                .vl-logo-mark {
                    width: 42px; height: 42px;
                    background: rgba(255,255,255,0.15);
                    border: 1.5px solid rgba(255,255,255,0.3);
                    border-radius: 12px;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                }
                .vl-logo-mark svg { width: 22px; height: 22px; color: white; }
                .vl-logo-text { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 600; color: #fff; letter-spacing: -0.2px; }
                .vl-logo-sub { font-size: 11px; color: rgba(255,255,255,0.45); letter-spacing: 0.1em; text-transform: uppercase; margin-top: 1px; }

                .vl-nav { flex: 1; overflow-y: auto; padding: 18px 14px; display: flex; flex-direction: column; gap: 3px; }
                .vl-nav-label { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.32); padding: 16px 10px 6px; }
                .vl-nav-item {
                    display: flex; align-items: center; gap: 13px;
                    padding: 12px 14px; border-radius: 10px;
                    text-decoration: none; color: rgba(255,255,255,0.65);
                    font-size: 15px; font-weight: 500;
                    transition: background 0.15s, color 0.15s;
                    position: relative;
                }
                .vl-nav-item:hover { background: rgba(255,255,255,0.1); color: #fff; }
                .vl-nav-item.active {
                    background: rgba(255,255,255,0.18);
                    color: #fff;
                    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.15);
                }
                .vl-nav-item.active::before {
                    content: '';
                    position: absolute; left: 0; top: 50%; transform: translateY(-50%);
                    width: 3px; height: 20px; background: #D4A373; border-radius: 0 3px 3px 0;
                }
                .vl-nav-icon { width: 20px; height: 20px; flex-shrink: 0; }

                .vl-sidebar-footer {
                    padding: 18px 20px 22px;
                    border-top: 1px solid rgba(255,255,255,0.1);
                    margin-top: auto;
                    position: relative; z-index: 2;
                }
                .vl-user-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
                .vl-avatar {
                    width: 38px; height: 38px; border-radius: 50%;
                    background: rgba(255,255,255,0.18);
                    border: 1.5px solid rgba(255,255,255,0.3);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 15px; font-weight: 700; color: #fff; flex-shrink: 0;
                    text-transform: uppercase;
                }
                .vl-user-name { font-size: 14px; font-weight: 600; color: #fff; }
                .vl-user-role { font-size: 11.5px; color: rgba(255,255,255,0.4); }
                .vl-logout-btn {
                    width: 100%; padding: 11px 16px;
                    background: rgba(255,255,255,0.08);
                    border: 1px solid rgba(255,255,255,0.15);
                    border-radius: 9px; color: rgba(255,255,255,0.7);
                    font-family: 'Inter', sans-serif; font-size: 13.5px; font-weight: 500;
                    cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
                    transition: background 0.15s, color 0.15s;
                }
                .vl-logout-btn:hover { background: rgba(255,255,255,0.16); color: #fff; }

                /* ── Main content ── */
                .vl-main {
                    margin-left: 268px;
                    flex: 1; min-height: 100vh;
                    background: transparent;
                    position: relative; overflow: hidden;
                }

                /* Mobile top bar */
                .vl-mobile-bar {
                    display: none;
                    position: fixed; top: 0; left: 0; right: 0; z-index: 300;
                    background: #8C3322; height: 56px; padding: 0 18px;
                    align-items: center; justify-content: space-between;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.2);
                }
                .vl-hamburger { background: none; border: none; cursor: pointer; color: #fff; padding: 6px; display: flex; align-items: center; justify-content: center; }
                .vl-mobile-overlay {
                    display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 150;
                }

                @media (max-width: 900px) {
                    .vl-sidebar { transform: translateX(-100%); }
                    .vl-sidebar.mobile-open { transform: translateX(0); }
                    .vl-main { margin-left: 0; padding-top: 56px; }
                    .vl-mobile-bar { display: flex; }
                    .vl-mobile-overlay.active { display: block; }
                }
            `}</style>

            {/* ── Mobile top bar ── */}
            <div className="vl-mobile-bar">
                <button className="vl-hamburger" onClick={() => setMobileSidebar(v => !v)} aria-label="Open navigation">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                    </svg>
                </button>
                <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: "#fff", fontWeight: 500 }}>Vibe Lanka</span>
                <div style={{ width: 34 }} />
            </div>

            {/* ── Mobile overlay ── */}
            <div className={`vl-mobile-overlay ${mobileSidebar ? "active" : ""}`} onClick={() => setMobileSidebar(false)} />

            <div className="vl-app">

                {/* ══ SIDEBAR ══ */}
                <aside className={`vl-sidebar ${mobileSidebar ? "mobile-open" : ""}`}>
                    <div className="vl-sidebar-top">
                        <Link to="/dashboard" className="vl-logo" onClick={() => setMobileSidebar(false)}>
                            <div className="vl-logo-mark">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 3C10 7 6 9 4 13c-2 4 0 8 4 10 2 1 3 1 4 2 1-1 2-1 4-2 4-2 6-6 4-10-2-4-6-6-8-10z"/>
                                    <path d="M12 8c-1 2.5-3 4-4 6.5s0 5 4 6.5c4-1.5 5-4 4-6.5S13 10.5 12 8z" strokeWidth="1.5"/>
                                </svg>
                            </div>
                            <div>
                                <div className="vl-logo-text">Vibe Lanka</div>
                                <div className="vl-logo-sub">Travel Planner</div>
                            </div>
                        </Link>
                    </div>

                    <nav className="vl-nav">
                        <div className="vl-nav-label">Navigation</div>
                        {NAV_ITEMS.map(item => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className={`vl-nav-item ${isActive(item.to) ? "active" : ""}`}
                                onClick={() => setMobileSidebar(false)}
                            >
                                <span className="vl-nav-icon">{item.icon}</span>
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="vl-sidebar-footer">
                        <div className="vl-user-row">
                            <div className="vl-avatar">{username.charAt(0)}</div>
                            <div>
                                <div className="vl-user-name">{username}</div>
                                <div className="vl-user-role">Traveller</div>
                            </div>
                        </div>
                        <button className="vl-logout-btn" onClick={handleLogout}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                            </svg>
                            Sign Out
                        </button>
                    </div>

                    <LiyavelWatermark />
                </aside>

                {/* ══ MAIN CONTENT ══ */}
                <main className="vl-main">
                    {children}
                </main>
            </div>
        </>
    );
}
