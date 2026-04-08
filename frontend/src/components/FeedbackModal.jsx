import { useState } from "react";
import API from "../services/api";

export default function FeedbackModal({ itineraryId, close }) {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");
    const [loading, setLoading] = useState(false);
    const [hovered, setHovered] = useState(0);

    const submit = async () => {
        setLoading(true);
        try {
            await API.post("/feedback", {
                itinerary_id: itineraryId,
                rating,
                comment,
            });
            close();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');

                .modal-overlay {
                    position: fixed; inset: 0;
                    background: rgba(26,46,43,0.55);
                    backdrop-filter: blur(6px);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 999;
                    animation: overlayIn 0.2s ease both;
                }
                @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }

                .modal-card {
                    position: relative;
                    width: 100%;
                    max-width: 420px;
                    margin: 20px;
                    background: #4d8a82;
                    border: 1px solid rgba(255,255,255,0.18);
                    border-radius: 16px;
                    padding: 40px 36px 36px;
                    box-shadow: 0 8px 48px rgba(29,58,54,0.35), 0 2px 8px rgba(29,58,54,0.2);
                    font-family: 'DM Sans', sans-serif;
                    animation: modalIn 0.35s cubic-bezier(0.16,1,0.3,1) both;
                    color: #ffffff;
                }
                @keyframes modalIn {
                    from { opacity: 0; transform: translateY(16px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }

                .modal-close {
                    position: absolute; top: 16px; right: 16px;
                    width: 30px; height: 30px;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 8px;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; color: rgba(255,255,255,0.6);
                    transition: background 0.15s, color 0.15s;
                }
                .modal-close:hover { background: rgba(255,255,255,0.18); color: #ffffff; }

                .modal-eyebrow {
                    font-size: 10.5px;
                    font-weight: 600;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: rgba(255,255,255,0.55);
                    margin-bottom: 8px;
                }
                .modal-title {
                    font-family: 'Playfair Display', serif;
                    font-size: 26px;
                    font-weight: 400;
                    color: #ffffff;
                    letter-spacing: -0.2px;
                    margin-bottom: 28px;
                }

                .field-label {
                    display: block;
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    color: rgba(255,255,255,0.55);
                    margin-bottom: 12px;
                }

                .star-row {
                    display: flex; gap: 8px;
                    margin-bottom: 24px;
                }
                .star-btn {
                    background: none; border: none; cursor: pointer;
                    padding: 0; transition: transform 0.1s ease;
                    line-height: 1;
                }
                .star-btn:hover { transform: scale(1.15); }
                .star-svg { width: 32px; height: 32px; transition: fill 0.15s, filter 0.15s; }
                .star-active {
                    fill: #ffffff;
                    filter: drop-shadow(0 0 6px rgba(255,255,255,0.5));
                }
                .star-inactive { fill: rgba(255,255,255,0.2); }

                .field-textarea {
                    width: 100%;
                    background: rgba(255,255,255,0.12);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 10px;
                    padding: 13px 16px;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 13.5px;
                    color: #ffffff;
                    outline: none;
                    resize: vertical;
                    min-height: 100px;
                    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
                    caret-color: #ffffff;
                    margin-bottom: 24px;
                }
                .field-textarea::placeholder { color: rgba(255,255,255,0.35); }
                .field-textarea:focus {
                    border-color: rgba(255,255,255,0.4);
                    background: rgba(255,255,255,0.16);
                    box-shadow: 0 0 0 3px rgba(255,255,255,0.08);
                }

                .modal-actions {
                    display: flex; gap: 10px;
                }
                .cancel-btn {
                    flex: 1;
                    padding: 12px;
                    background: transparent;
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 10px;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 13.5px;
                    font-weight: 500;
                    color: rgba(255,255,255,0.6);
                    cursor: pointer;
                    transition: border-color 0.2s, color 0.2s, background 0.2s;
                }
                .cancel-btn:hover {
                    border-color: rgba(255,255,255,0.4);
                    color: #ffffff;
                    background: rgba(255,255,255,0.06);
                }

                .submit-btn {
                    flex: 2;
                    padding: 12px;
                    background: #2d4a47;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 10px;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 13.5px;
                    font-weight: 600;
                    color: #e8f0ef;
                    letter-spacing: 0.02em;
                    cursor: pointer;
                    display: flex; align-items: center; justify-content: center; gap: 7px;
                    transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
                    box-shadow: 0 4px 14px rgba(29,58,54,0.3);
                }
                .submit-btn:hover:not(:disabled) {
                    background: #1e3330;
                    transform: translateY(-1px);
                    box-shadow: 0 8px 22px rgba(29,58,54,0.4);
                }
                .submit-btn:disabled { opacity: 0.45; cursor: not-allowed; }

                .btn-spinner {
                    width: 14px; height: 14px;
                    border: 2px solid rgba(232,240,239,0.3);
                    border-top-color: #e8f0ef;
                    border-radius: 50%;
                    animation: spin 0.7s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>

            <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
                <div className="modal-card">
                    <button className="modal-close" onClick={close} aria-label="Close">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>

                    <p className="modal-eyebrow">Feedback</p>
                    <h2 className="modal-title">Rate this Trip</h2>

                    <label className="field-label">Your Rating</label>
                    <div className="star-row">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                className="star-btn"
                                onMouseEnter={() => setHovered(star)}
                                onMouseLeave={() => setHovered(0)}
                                onClick={() => setRating(star)}
                                aria-label={`Rate ${star} stars`}
                            >
                                <svg className={`star-svg ${star <= (hovered || rating) ? "star-active" : "star-inactive"}`} viewBox="0 0 24 24">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                </svg>
                            </button>
                        ))}
                    </div>

                    <label className="field-label">Leave a comment</label>
                    <textarea
                        className="field-textarea"
                        placeholder="What did you love? Any suggestions?"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />

                    <div className="modal-actions">
                        <button className="cancel-btn" onClick={close}>Cancel</button>
                        <button className="submit-btn" onClick={submit} disabled={loading}>
                            {loading ? <span className="btn-spinner" /> : (
                                <>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="20 6 9 17 4 12"/></svg>
                                    Submit Review
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}