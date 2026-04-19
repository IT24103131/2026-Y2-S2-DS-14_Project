import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Layout from "../components/Layout";

// ─────────────────────────────────────────────────────────────────────────────
// MyGuideBooking.jsx  —  shows current guide booking + cancel option
// Replaces member 4b's MyBookingsPage.jsx and BookingPage.jsx combined.
// Reads user from JWT — no manual user_id input needed.
// Endpoint: GET /guides/booking, PUT /guides/booking/<id>/cancel
// ─────────────────────────────────────────────────────────────────────────────

export default function MyGuideBooking() {
    const navigate = useNavigate();
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [cancelling, setCancelling] = useState(false);

    const load = () => {
        setLoading(true);
        API.get("/guides/booking")
            .then(res => { setBooking(res.data); setError(""); })
            .catch(err => {
                if (err?.response?.status === 404) setBooking(null);
                else setError("Could not load your booking.");
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleCancel = async () => {
        if (!window.confirm("Are you sure you want to cancel this booking?")) return;
        setCancelling(true);
        try {
            await API.put(`/guides/booking/${booking.id}/cancel`);
            load();
        } catch (err) {
            alert(err?.response?.data?.detail || "Could not cancel booking.");
        } finally {
            setCancelling(false);
        }
    };

    const STATUS_COLOR = {
        confirmed: "#ffcc00",
        cancelled: "#ffb4b4",
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
                @keyframes fadeUp { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)} }
                .mgb-root { min-height: 100vh; background: transparent; font-family: 'DM Sans', sans-serif; position:relative; z-index:1; }
                .mgb-hero { background: #FFFFFF; padding: 40px 32px 32px; border-bottom: 1px solid #E8D5BC; box-shadow: 0 4px 20px rgba(62,39,35,0.03); position:relative; z-index:2; }
                .mgb-hero-inner { max-width: 720px; margin: 0 auto; }
                .mgb-eyebrow { font-size: 10.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(62,39,35,0.4); margin-bottom: 10px; }
                .mgb-title { font-family: 'Playfair Display', serif; font-size: 34px; font-weight: 500; color: #8C3322; margin-bottom: 8px; }
                .mgb-sub { font-size: 13.5px; color: rgba(62,39,35,0.6); }
                .mgb-content { max-width: 720px; margin: 0 auto; padding: 36px 24px 80px; position:relative; z-index:2; }
                .mgb-card { background: #FFFFFF; border: 1px solid #E8D5BC; border-radius: 16px; padding: 28px; box-shadow: 0 4px 24px rgba(62,39,35,0.08); color: #3E2723; animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both; }
                .mgb-card-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 500; color: #3E2723; margin-bottom: 6px; }
                .mgb-badge { display: inline-block; border-radius: 8px; padding: "4px 12px"; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-left: 10px; }
                .mgb-row { display: flex; align-items: center; gap: 8px; font-size: 14px; color: rgba(62,39,35,0.7); margin-bottom: 10px; }
                .mgb-row strong { color: #3E2723; }
                .mgb-divider { height: 1px; background: #E8D5BC; margin: 20px 0; }
                .mgb-actions { display: flex; gap: 12px; margin-top: 20px; }
                .mgb-btn-cancel { padding: 12px 24px; border-radius: 10px; border: 1px solid rgba(140,51,34,0.3); background: rgba(140,51,34,0.1); font-family: 'DM Sans',sans-serif; font-size: 13.5px; font-weight: 600; color: #8C3322; cursor: pointer; transition: background 0.2s; }
                .mgb-btn-cancel:hover:not(:disabled) { background: rgba(140,51,34,0.15); }
                .mgb-btn-cancel:disabled { opacity: 0.45; cursor: not-allowed; }
                .mgb-btn-primary { padding: 12px 24px; border-radius: 10px; border: none; background: #8C3322; font-family: 'DM Sans',sans-serif; font-size: 13.5px; font-weight: 600; color: #ffffff; cursor: pointer; box-shadow: 0 4px 14px rgba(140,51,34,0.25); transition: background 0.2s; }
                .mgb-btn-primary:hover { background: #6A2417; }
                .mgb-empty { text-align: center; padding: 60px 24px; color: rgba(62,39,35,0.6); background: #FFFFFF; border: 1px solid #E8D5BC; border-radius: 14px; animation: fadeUp 0.4s ease both; box-shadow: 0 4px 24px rgba(62,39,35,0.05); }
                .mgb-error { display: flex; gap: 8px; background: rgba(140,51,34,0.1); border: 1px solid rgba(140,51,34,0.2); border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #8C3322; margin-bottom: 24px; }
            `}</style>


            <Layout>
                <div className="mgb-hero">
                    <div className="mgb-hero-inner">
                        <p className="mgb-eyebrow">Guide Booking</p>
                        <h1 className="mgb-title">My Guide Booking</h1>
                        <p className="mgb-sub">View and manage your current guide booking.</p>
                    </div>
                </div>

                <div className="mgb-content">
                    {error && <div className="mgb-error">{error}</div>}

                    {loading && (
                        <div style={{ textAlign: "center", padding: 60, color: "rgba(26,46,43,0.5)" }}>
                            <p style={{ fontSize: 36, marginBottom: 12 }}>⏳</p>
                            <p>Loading your booking…</p>
                        </div>
                    )}

                    {!loading && booking && (
                        <div className="mgb-card">
                            <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
                                <div className="mgb-card-title">{booking.name}</div>
                                <span style={{
                                    display: "inline-block", marginLeft: 12,
                                    background: booking.current_status === "confirmed" ? "rgba(212,163,115,0.15)" : "rgba(140,51,34,0.1)",
                                    color: STATUS_COLOR[booking.current_status] || "#3E2723",
                                    border: `1px solid ${STATUS_COLOR[booking.current_status] || "#E8D5BC"}`,
                                    borderRadius: 8, padding: "3px 12px",
                                    fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                                }}>
                                    {booking.current_status}
                                </span>
                            </div>

                            <div className="mgb-row">📍 <span>Location:</span> <strong>{booking.base_location}</strong></div>
                            <div className="mgb-row">🗣 <span>Language:</span> <strong>{booking.language}</strong></div>
                            <div className="mgb-row">⭐ <span>Rating:</span> <strong style={{ color: "#D4A373" }}>{booking.rating}</strong></div>
                            <div className="mgb-row">💵 <span>Daily Rate:</span> <strong>LKR {Number(booking.daily_rate).toLocaleString()}</strong></div>

                            <div className="mgb-divider" />

                            <div style={{ background: "rgba(212,163,115,0.1)", border: "1px solid #D4A373", borderRadius: 10, padding: "14px 18px" }}>
                                <div style={{ fontSize: 12, color: "rgba(62,39,35,0.6)", marginBottom: 4 }}>Total estimated cost</div>
                                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: "#D4A373", fontWeight:600 }}>
                                    LKR {Number(booking.estimated_budget).toLocaleString()}
                                </div>
                            </div>

                            {booking.current_status === "cancelled" && (
                                <div style={{ marginTop: 16, background: "#F9F6F0", border: "1px solid #E8D5BC", borderRadius: 10, padding: "14px 18px", fontSize: 13, color: "rgba(62,39,35,0.7)", textAlign: "center" }}>
                                    This booking was cancelled. You can now book a new guide.
                                </div>
                            )}

                            <div className="mgb-actions">
                                {booking.current_status === "confirmed" && (
                                    <button className="mgb-btn-cancel" onClick={handleCancel} disabled={cancelling}>
                                        {cancelling ? "Cancelling…" : "Cancel Booking"}
                                    </button>
                                )}
                                <button className="mgb-btn-primary" onClick={() => navigate(booking.current_status === "cancelled" ? "/guides" : "/itineraries/plan")}>
                                    {booking.current_status === "cancelled" ? "Find a New Guide →" : "Plan My Trip →"}
                                </button>
                            </div>
                        </div>
                    )}

                    {!loading && !booking && !error && (
                        <div className="mgb-empty">
                            <p style={{ fontSize: 40, marginBottom: 12 }}>📭</p>
                            <p style={{ fontSize: 14 }}>You don't have any guide bookings yet.</p>
                            <button onClick={() => navigate("/guides")}
                                style={{ marginTop: 20, padding: "12px 28px", background: "#D4A373", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13.5, color: "#fff", cursor: "pointer", boxShadow:"0 4px 14px rgba(212,163,115,0.3)" }}>
                                Find a Guide →
                            </button>
                        </div>
                    )}
                </div>
            </Layout>
        </>
    );
}