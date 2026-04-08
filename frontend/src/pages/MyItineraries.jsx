import { useEffect, useState } from "react";
import API from "../services/api";
import Navbar from "../components/Navbar";

// ── Vibe config ───────────────────────────────────────────────────────────────
const VIBES = {
    "adventurous explorer": {
        gradient: "linear-gradient(135deg, #c0522a 0%, #e07840 100%)",
        soft: "rgba(192,82,42,0.12)", border: "rgba(192,82,42,0.25)",
        tag: "#c0522a", tagBg: "rgba(192,82,42,0.15)",
        glow: "rgba(192,82,42,0.3)", label: "Adventurous Explorer",
    },
    "balanced traveler": {
        gradient: "linear-gradient(135deg, #3d7068 0%, #4d8a82 100%)",
        soft: "rgba(77,138,130,0.12)", border: "rgba(77,138,130,0.25)",
        tag: "#3d7068", tagBg: "rgba(77,138,130,0.15)",
        glow: "rgba(77,138,130,0.3)", label: "Balanced Traveler",
    },
    "friendly cultural": {
        gradient: "linear-gradient(135deg, #5a4a82 0%, #7b6aaa 100%)",
        soft: "rgba(90,74,130,0.12)", border: "rgba(90,74,130,0.25)",
        tag: "#5a4a82", tagBg: "rgba(90,74,130,0.15)",
        glow: "rgba(90,74,130,0.3)", label: "Friendly Cultural",
    },
    "organized sightseer": {
        gradient: "linear-gradient(135deg, #2d4a47 0%, #4d8a82 100%)",
        soft: "rgba(45,74,71,0.12)", border: "rgba(45,74,71,0.25)",
        tag: "#2d4a47", tagBg: "rgba(45,74,71,0.15)",
        glow: "rgba(45,74,71,0.3)", label: "Organized Sightseer",
    },
    "calm & relaxed": {
        gradient: "linear-gradient(135deg, #2a6a60 0%, #3d9488 100%)",
        soft: "rgba(42,106,96,0.12)", border: "rgba(42,106,96,0.25)",
        tag: "#2a6a60", tagBg: "rgba(42,106,96,0.15)",
        glow: "rgba(42,106,96,0.3)", label: "Calm & Relaxed",
    },
    default: {
        gradient: "linear-gradient(135deg, #2d4a47 0%, #4d8a82 100%)",
        soft: "rgba(77,138,130,0.12)", border: "rgba(77,138,130,0.25)",
        tag: "#2d4a47", tagBg: "rgba(77,138,130,0.15)",
        glow: "rgba(77,138,130,0.3)", label: "Explorer",
    },
};

const getVibe = (vibe = "") => VIBES[vibe.toLowerCase()] || VIBES.default;
const TRIP_ICONS = { beach:"🏖️", cultural:"🏛️", adventure:"🧗", peaceful:"🌿", unknown:"🗺️" };
const getIcon = (type = "") => TRIP_ICONS[type.toLowerCase()] || "🗺️";
const fmt = (d) => d ? new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) : "—";

// ── Shared modal shell ────────────────────────────────────────────────────────
function ModalShell({ title, eyebrow, vibe, onClose, children }) {
    const v = vibe || VIBES.default;
    return (
        <>
            <style>{`
                .modal-overlay{position:fixed;inset:0;z-index:999;background:rgba(26,46,43,0.55);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;animation:overlayIn 0.2s ease both;}
                @keyframes overlayIn{from{opacity:0}to{opacity:1}}
                .modal-box{width:100%;max-width:440px;background:#4d8a82;border:1px solid rgba(255,255,255,0.18);border-radius:16px;overflow:hidden;box-shadow:0 8px 48px rgba(29,58,54,0.35),0 2px 8px rgba(29,58,54,0.2);animation:boxIn 0.35s cubic-bezier(0.16,1,0.3,1) both;color:#ffffff;}
                @keyframes boxIn{from{opacity:0;transform:translateY(16px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
                .modal-header{padding:28px 28px 20px;position:relative;}
                .modal-eyebrow{font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:6px;color:rgba(255,255,255,0.55);}
                .modal-title{font-family:'Playfair Display',serif;font-size:24px;font-weight:400;color:#ffffff;letter-spacing:-0.2px;}
                .modal-close-btn{position:absolute;top:16px;right:16px;width:28px;height:28px;border-radius:7px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,0.6);transition:background 0.15s,color 0.15s;}
                .modal-close-btn:hover{background:rgba(255,255,255,0.18);color:#ffffff;}
                .modal-body{padding:0 28px 28px;}
                .modal-field-label{display:block;font-size:10.5px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.55);margin-bottom:10px;}
                .modal-input,.modal-textarea{width:100%;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:12px 16px;font-family:'DM Sans',sans-serif;font-size:14px;color:#ffffff;outline:none;transition:border-color 0.2s,box-shadow 0.2s,background 0.2s;caret-color:#ffffff;box-sizing:border-box;}
                .modal-textarea{resize:vertical;min-height:96px;}
                .modal-input::placeholder,.modal-textarea::placeholder{color:rgba(255,255,255,0.35);}
                .modal-input:focus,.modal-textarea:focus{border-color:rgba(255,255,255,0.4);background:rgba(255,255,255,0.16);box-shadow:0 0 0 3px rgba(255,255,255,0.08);}
                .modal-actions{display:flex;gap:10px;margin-top:20px;}
                .modal-btn-cancel{flex:1;padding:12px;border-radius:10px;background:transparent;border:1px solid rgba(255,255,255,0.2);font-family:'DM Sans',sans-serif;font-size:13.5px;color:rgba(255,255,255,0.6);cursor:pointer;transition:border-color 0.2s,color 0.2s,background 0.2s;}
                .modal-btn-cancel:hover{border-color:rgba(255,255,255,0.4);color:#ffffff;background:rgba(255,255,255,0.06);}
                .modal-btn-primary{flex:2;padding:12px;border-radius:10px;border:none;font-family:'DM Sans',sans-serif;font-size:13.5px;font-weight:600;color:#e8f0ef;cursor:pointer;letter-spacing:0.02em;display:flex;align-items:center;justify-content:center;gap:7px;transition:opacity 0.2s,transform 0.15s,box-shadow 0.2s;}
                .modal-btn-primary:hover:not(:disabled){opacity:0.88;transform:translateY(-1px);}
                .modal-btn-primary:disabled{opacity:0.45;cursor:not-allowed;}
                .modal-btn-danger{flex:2;padding:12px;border-radius:10px;border:none;font-family:'DM Sans',sans-serif;font-size:13.5px;font-weight:600;color:#ffffff;cursor:pointer;background:linear-gradient(135deg,#8b1a1a,#b02020);box-shadow:0 4px 14px rgba(139,26,26,0.4);transition:opacity 0.2s,transform 0.15s;}
                .modal-btn-danger:hover:not(:disabled){opacity:0.88;transform:translateY(-1px);}
                .modal-btn-danger:disabled{opacity:0.45;cursor:not-allowed;}
                .btn-spinner{width:14px;height:14px;border:2px solid rgba(232,240,239,0.3);border-top-color:#e8f0ef;border-radius:50%;animation:spin 0.7s linear infinite;}
                @keyframes spin{to{transform:rotate(360deg)}}
            `}</style>
            <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
                <div className="modal-box">
                    <div className="modal-header">
                        <div style={{ width:"100%",height:3,background:v.gradient,borderRadius:"16px 16px 0 0",position:"absolute",top:0,left:0 }} />
                        <button className="modal-close-btn" onClick={onClose}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                        <p className="modal-eyebrow">{eyebrow}</p>
                        <h2 className="modal-title">{title}</h2>
                    </div>
                    <div className="modal-body">{children}</div>
                </div>
            </div>
        </>
    );
}

// ── Star rating ───────────────────────────────────────────────────────────────
function Stars({ value, onChange, readonly = false }) {
    const [hov, setHov] = useState(0);
    return (
        <div style={{ display:"flex", gap:6, marginBottom:20 }}>
            {[1,2,3,4,5].map((n) => (
                <button key={n} type="button"
                        onMouseEnter={() => !readonly && setHov(n)}
                        onMouseLeave={() => !readonly && setHov(0)}
                        onClick={() => !readonly && onChange && onChange(n)}
                        disabled={readonly}
                        style={{ background:"none", border:"none", cursor:readonly?"default":"pointer", padding:0 }}>
                    <svg width={readonly ? 22 : 34} height={readonly ? 22 : 34} viewBox="0 0 24 24"
                         style={{ transition:"fill 0.15s,filter 0.15s",
                             fill: n<=(hov||value) ? "#ffffff" : "rgba(255,255,255,0.2)",
                             filter: n<=(hov||value) && !readonly ? "drop-shadow(0 0 5px rgba(255,255,255,0.5))" : "none" }}>
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                </button>
            ))}
        </div>
    );
}

// ── Submit feedback modal ─────────────────────────────────────────────────────
function FeedbackModal({ it, close }) {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const v = getVibe(it.final_vibe || "");

    const submit = async () => {
        setLoading(true);
        try {
            await API.post("/feedback", {
                itinerary_id: it.itinerary_id,
                rating: Number(rating),
                comment
            });
            setDone(true);
            setTimeout(close, 1800);
        } catch { alert("Failed to submit feedback."); setLoading(false); }
    };

    if (done) return (
        <ModalShell eyebrow="Thank you" title="Review submitted!" vibe={v} onClose={close}>
            <div style={{ textAlign:"center", padding:"16px 0 8px" }}>
                <div style={{ fontSize:56, marginBottom:12 }}>🎉</div>
                <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13.5, color:"rgba(255,255,255,0.65)", lineHeight:1.6 }}>
                    Your feedback helps us craft better trips for you.
                </p>
            </div>
        </ModalShell>
    );

    return (
        <ModalShell eyebrow="Leave a Review" title="Rate this Trip" vibe={v} onClose={close}>
            <label className="modal-field-label" style={{ marginTop:4 }}>Your Rating</label>
            <Stars value={rating} onChange={setRating} />
            <label className="modal-field-label">Comment <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0, color:"rgba(255,255,255,0.35)" }}>(optional)</span></label>
            <textarea className="modal-textarea" placeholder="What did you love? Any suggestions?"
                      value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="modal-actions">
                <button className="modal-btn-cancel" onClick={close}>Cancel</button>
                <button className="modal-btn-primary" disabled={loading} onClick={submit}
                        style={{ background:v.gradient, boxShadow:`0 4px 14px ${v.glow}` }}>
                    {loading ? <span className="btn-spinner"/> : (
                        <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Submit Review</>
                    )}
                </button>
            </div>
        </ModalShell>
    );
}

// ── Edit feedback modal ───────────────────────────────────────────────────────
function EditFeedbackModal({ fb, it, close, onSaved }) {
    const [rating, setRating] = useState(fb.rating);
    const [comment, setComment] = useState(fb.comment || "");
    const [loading, setLoading] = useState(false);
    const v = getVibe(it?.final_vibe || "");

    const save = async () => {
        setLoading(true);
        try {
            await API.put(`/feedback/${fb.feedback_id}`, { rating: Number(rating), comment });
            onSaved();
            close();
        } catch { alert("Failed to update feedback."); setLoading(false); }
    };

    return (
        <ModalShell eyebrow="Edit Review" title="Update your Rating" vibe={v} onClose={close}>
            <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12.5, color:"rgba(255,255,255,0.5)", marginBottom:16, marginTop:2 }}>
                Saving will immediately retrain the AI policy with your updated rating.
            </p>
            <label className="modal-field-label">Your Rating</label>
            <Stars value={rating} onChange={setRating} />
            <label className="modal-field-label">Comment <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0, color:"rgba(255,255,255,0.35)" }}>(optional)</span></label>
            <textarea className="modal-textarea" placeholder="What did you love? Any suggestions?"
                      value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="modal-actions">
                <button className="modal-btn-cancel" onClick={close}>Cancel</button>
                <button className="modal-btn-primary" disabled={loading} onClick={save}
                        style={{ background:v.gradient, boxShadow:`0 4px 14px ${v.glow}` }}>
                    {loading ? <span className="btn-spinner"/> : "Save Changes"}
                </button>
            </div>
        </ModalShell>
    );
}

// ── Delete feedback modal ─────────────────────────────────────────────────────
function DeleteFeedbackModal({ fb, close, onDeleted }) {
    const [loading, setLoading] = useState(false);
    const confirm = async () => {
        setLoading(true);
        try {
            await API.delete(`/feedback/${fb.feedback_id}`);
            onDeleted();
            close();
        } catch { alert("Failed to delete feedback."); setLoading(false); }
    };
    return (
        <ModalShell eyebrow="Confirm Delete" title="Remove this review?" vibe={VIBES.default} onClose={close}>
            <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13.5, color:"rgba(255,255,255,0.6)", lineHeight:1.7, marginTop:4, marginBottom:4 }}>
                This review will be permanently removed and the AI policy will be retrained without it.
            </p>
            <div className="modal-actions">
                <button className="modal-btn-cancel" onClick={close}>Keep It</button>
                <button className="modal-btn-danger" disabled={loading} onClick={confirm}>
                    {loading ? <span className="btn-spinner"/> : "Yes, Delete"}
                </button>
            </div>
        </ModalShell>
    );
}

// ── Edit itinerary title modal ────────────────────────────────────────────────
function EditModal({ it, close, onSaved }) {
    const [title, setTitle] = useState(it.title);
    const [loading, setLoading] = useState(false);
    const v = getVibe(it.final_vibe || "");

    const save = async () => {
        if (!title.trim()) return;
        setLoading(true);
        try {
            await API.put(`/itineraries/${it.itinerary_id}`, { title: title.trim() });
            onSaved(it.itinerary_id, title.trim());
            close();
        } catch { alert("Failed to update."); setLoading(false); }
    };

    return (
        <ModalShell eyebrow="Edit Trip" title="Rename Itinerary" vibe={v} onClose={close}>
            <label className="modal-field-label" style={{ marginTop:4 }}>Trip Title</label>
            <input autoFocus className="modal-input" value={title}
                   onChange={(e) => setTitle(e.target.value)}
                   onKeyDown={(e) => e.key === "Enter" && save()} />
            <div className="modal-actions">
                <button className="modal-btn-cancel" onClick={close}>Cancel</button>
                <button className="modal-btn-primary" disabled={loading || !title.trim()} onClick={save}
                        style={{ background:v.gradient, boxShadow:`0 4px 14px ${v.glow}` }}>
                    {loading ? <span className="btn-spinner"/> : "Save Changes"}
                </button>
            </div>
        </ModalShell>
    );
}

// ── Delete itinerary modal ────────────────────────────────────────────────────
function DeleteModal({ it, close, onDeleted }) {
    const [loading, setLoading] = useState(false);
    const confirm = async () => {
        setLoading(true);
        try {
            await API.delete(`/itineraries/${it.itinerary_id}`);
            onDeleted(it.itinerary_id);
            close();
        } catch { alert("Failed to delete."); setLoading(false); }
    };
    return (
        <ModalShell eyebrow="Confirm Delete" title="Delete this trip?" vibe={VIBES.default} onClose={close}>
            <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13.5, color:"rgba(255,255,255,0.6)", lineHeight:1.7, marginTop:4, marginBottom:4 }}>
                <span style={{ fontWeight:600, color:"#ffffff" }}>"{it.title}"</span> will be permanently removed.
            </p>
            <div className="modal-actions">
                <button className="modal-btn-cancel" onClick={close}>Keep It</button>
                <button className="modal-btn-danger" disabled={loading} onClick={confirm}>
                    {loading ? <span className="btn-spinner"/> : "Yes, Delete"}
                </button>
            </div>
        </ModalShell>
    );
}

// ── Feedback row ──────────────────────────────────────────────────────────────
function FeedbackRow({ fb, it, onRefresh }) {
    const [editFb, setEditFb] = useState(null);
    const [deleteFb, setDeleteFb] = useState(null);
    return (
        <>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"10px 14px", borderRadius:10, background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", marginBottom:8 }}>
                <div>
                    <Stars value={fb.rating} readonly />
                    <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"rgba(255,255,255,0.65)", margin:"0 0 4px", lineHeight:1.6 }}>
                        {fb.comment || <em style={{ color:"rgba(255,255,255,0.35)" }}>No comment</em>}
                    </p>
                    <p style={{ fontSize:11, color:"rgba(255,255,255,0.35)", fontFamily:"'DM Sans',sans-serif" }}>{fmt(fb.created_at)}</p>
                </div>
                <div style={{ display:"flex", gap:6, marginLeft:12, flexShrink:0, paddingTop:2 }}>
                    <button onClick={() => setEditFb(fb)} style={{ width:28, height:28, borderRadius:7, background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.18)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"rgba(255,255,255,0.7)", fontSize:13 }}>✏</button>
                    <button onClick={() => setDeleteFb(fb)} style={{ width:28, height:28, borderRadius:7, background:"rgba(139,26,26,0.2)", border:"1px solid rgba(139,26,26,0.35)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#ffb4b4", fontSize:13 }}>🗑</button>
                </div>
            </div>
            {editFb   && <EditFeedbackModal   fb={editFb}   it={it} close={() => setEditFb(null)}   onSaved={onRefresh} />}
            {deleteFb && <DeleteFeedbackModal fb={deleteFb}         close={() => setDeleteFb(null)} onDeleted={onRefresh} />}
        </>
    );
}

// ── Trip card ─────────────────────────────────────────────────────────────────
function TripCard({ it, feedbacks, onRate, onEdit, onDelete, onRefreshFeedbacks }) {
    const [open, setOpen]               = useState(false);
    const [showReviews, setShowReviews] = useState(false);

    const vibe        = (it.final_vibe || "").toLowerCase();
    const v           = getVibe(vibe);
    const icon        = getIcon(it.itinerary_type || "");
    const dests       = it.destinations || [];
    const days        = it.days || [];
    const route       = it.optimized_route || [];
    const explanation = it.explanation || "";
    const numDays     = days.length || Math.max(1, dests.length);
    const fbs         = feedbacks || [];
    const avgRating   = fbs.length > 0
        ? (fbs.reduce((s, f) => s + f.rating, 0) / fbs.length).toFixed(1)
        : null;

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');
                .trip-card{background:#4d8a82;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.15);box-shadow:0 4px 20px rgba(29,58,54,0.18),0 1px 4px rgba(29,58,54,0.1);transition:box-shadow 0.25s,transform 0.2s;font-family:'DM Sans',sans-serif;color:#ffffff;}
                .trip-card:hover{box-shadow:0 10px 36px rgba(29,58,54,0.28);transform:translateY(-2px);}
                .trip-card-stripe{height:4px;}
                .trip-card-body{padding:20px 20px 16px;display:flex;gap:16px;align-items:flex-start;}
                .trip-icon-bubble{width:52px;height:52px;border-radius:14px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:26px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);}
                .trip-tag{display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:3px 10px;border-radius:20px;background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.85);}
                .trip-title{font-family:'Playfair Display',serif;font-size:20px;font-weight:400;color:#ffffff;letter-spacing:-0.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
                .trip-meta{font-size:12px;color:rgba(255,255,255,0.45);margin-top:2px;}
                .trip-action-row{display:flex;align-items:center;justify-content:space-between;padding:0 20px 16px;gap:10px;}
                .trip-view-btn{font-size:12.5px;font-weight:600;letter-spacing:0.04em;background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center;gap:5px;transition:opacity 0.2s;font-family:'DM Sans',sans-serif;color:rgba(255,255,255,0.75);}
                .trip-view-btn:hover{opacity:0.85;}
                .icon-btn{width:30px;height:30px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;transition:background 0.15s,transform 0.1s;background:rgba(255,255,255,0.1);}
                .icon-btn:hover{transform:scale(1.08);background:rgba(255,255,255,0.18);}
                .icon-btn-danger{border-color:rgba(139,26,26,0.4);background:rgba(139,26,26,0.2);}
                .icon-btn-danger:hover{background:rgba(139,26,26,0.35);}
                .trip-expanded{border-top:1px solid rgba(255,255,255,0.12);padding:20px;animation:expandIn 0.25s cubic-bezier(0.16,1,0.3,1) both;background:rgba(45,74,71,0.3);}
                @keyframes expandIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
                .section-label{font-size:9.5px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-bottom:10px;}
                .dest-pill{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.18);border-radius:20px;padding:6px 14px 6px 7px;font-size:13px;color:#ffffff;box-shadow:0 1px 4px rgba(29,58,54,0.1);}
                .dest-num{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#ffffff;flex-shrink:0;background:rgba(255,255,255,0.2);}
                .explain-box{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:14px 16px;font-size:13.5px;color:rgba(255,255,255,0.7);line-height:1.7;}
                .trip-stats-row{display:flex;flex-wrap:wrap;gap:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.1);margin-top:16px;font-size:12px;color:rgba(255,255,255,0.45);}
                .trip-stats-row strong{color:rgba(255,255,255,0.8);}
                .rate-cta-btn{width:100%;margin-top:16px;padding:11px;border:none;border-radius:10px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13.5px;font-weight:600;color:#ffffff;letter-spacing:0.02em;display:flex;align-items:center;justify-content:center;gap:8px;transition:opacity 0.2s,transform 0.15s;}
                .rate-cta-btn:hover{opacity:0.88;transform:translateY(-1px);}
                .reviews-toggle-btn{width:100%;margin-top:10px;padding:9px;border:1px solid rgba(255,255,255,0.18);border-radius:10px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:12.5px;font-weight:500;color:rgba(255,255,255,0.6);background:transparent;display:flex;align-items:center;justify-content:center;gap:6px;transition:border-color 0.2s,color 0.2s;}
                .reviews-toggle-btn:hover{border-color:rgba(255,255,255,0.35);color:rgba(255,255,255,0.85);}
            `}</style>

            <div className="trip-card">
                <div className="trip-card-stripe" style={{ background:v.gradient }} />

                <div className="trip-card-body">
                    <div className="trip-icon-bubble">{icon}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:7, marginBottom:5 }}>
                            <span className="trip-tag">{it.itinerary_type || "trip"}</span>
                            <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{v.label}</span>
                            <span style={{ fontSize:11, color:"rgba(255,255,255,0.2)" }}>·</span>
                            <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{numDays} day{numDays!==1?"s":""}</span>
                            {avgRating && (
                                <>
                                    <span style={{ fontSize:11, color:"rgba(255,255,255,0.2)" }}>·</span>
                                    <span style={{ fontSize:11, color:"rgba(255,255,255,0.85)", fontWeight:600 }}>
                                        ★ {avgRating} <span style={{ color:"rgba(255,255,255,0.4)", fontWeight:400 }}>({fbs.length})</span>
                                    </span>
                                </>
                            )}
                        </div>
                        <div className="trip-title">{it.title}</div>
                        <div className="trip-meta">Generated {fmt(it.created_at)}</div>
                    </div>
                </div>

                <div className="trip-action-row">
                    <button className="trip-view-btn" onClick={() => setOpen(o => !o)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            {open ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
                        </svg>
                        {open ? "Hide plan" : "View full plan"}
                    </button>
                    <div style={{ display:"flex", gap:6 }}>
                        <button className="icon-btn" title="Rate" style={{ color:"rgba(255,255,255,0.85)" }} onClick={() => onRate(it)}>★</button>
                        <button className="icon-btn" title="Edit title" style={{ color:"rgba(255,255,255,0.65)" }} onClick={() => onEdit(it)}>✏</button>
                        <button className="icon-btn icon-btn-danger" title="Delete" style={{ color:"#ffb4b4" }} onClick={() => onDelete(it)}>🗑</button>
                    </div>
                </div>

                {open && (
                    <div className="trip-expanded">
                        {dests.length > 0 && (
                            <div style={{ marginBottom:16 }}>
                                <div className="section-label">📍 Destinations</div>
                                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                                    {dests.map((d, i) => (
                                        <span key={i} className="dest-pill">
                                            <span className="dest-num" style={{ background:v.gradient }}>{i+1}</span>{d}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {explanation && (
                            <div style={{ marginBottom:16 }}>
                                <div className="section-label">💡 Why this trip</div>
                                <div className="explain-box">{explanation}</div>
                            </div>
                        )}

                        {days.length > 0 && (
                            <div style={{ marginBottom:16 }}>
                                <div className="section-label">🗓 Day-by-Day Plan</div>
                                {days.map((day) => (
                                    <div key={day.day_number} style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:12, padding:"14px 16px", marginBottom:10 }}>
                                        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:400, color:"#ffffff", marginBottom:10 }}>
                                            Day {day.day_number}
                                        </div>
                                        {day.activities.map((act, i) => (
                                            <div key={i} style={{ display:"flex", gap:12, padding:"8px 0", borderBottom: i < day.activities.length-1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                                                <span style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.6)", letterSpacing:"0.05em", width:52, flexShrink:0, paddingTop:2 }}>
                                                    {act.start_time}
                                                </span>
                                                <div style={{ flex:1 }}>
                                                    <p style={{ fontSize:13.5, fontWeight:500, color:"#ffffff", margin:0 }}>{act.location}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}

                        {route.length > 0 && (
                            <div style={{ marginBottom:16 }}>
                                <div className="section-label">🗺 Optimized Route</div>
                                <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
                                    {route.map((loc, i) => (
                                        <span key={i} style={{ display:"flex", alignItems:"center", gap:5 }}>
                                            <span style={{ background:"rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.85)", borderRadius:20, padding:"3px 10px", fontSize:12, border:"1px solid rgba(255,255,255,0.15)" }}>{loc}</span>
                                            {i < route.length-1 && <span style={{ color:"rgba(255,255,255,0.3)", fontSize:12 }}>→</span>}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {fbs.length > 0 && (
                            <div style={{ marginTop:4 }}>
                                <button className="reviews-toggle-btn" onClick={() => setShowReviews(r => !r)}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        {showReviews ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
                                    </svg>
                                    {showReviews ? "Hide Reviews" : `My Reviews (${fbs.length})`}
                                </button>
                                {showReviews && (
                                    <div style={{ marginTop:10 }}>
                                        <div className="section-label" style={{ marginBottom:8 }}>⭐ Your Reviews</div>
                                        {fbs.map(fb => (
                                            <FeedbackRow key={fb.feedback_id} fb={fb} it={it} onRefresh={onRefreshFeedbacks} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="trip-stats-row">
                            <span>🗓 <strong>{numDays}</strong> days</span>
                            <span>📌 <strong>{dests.length}</strong> destinations</span>
                            <span>🎭 <strong style={{ textTransform:"capitalize" }}>{vibe || "explorer"}</strong></span>
                            <span style={{ marginLeft:"auto" }}>Generated {fmt(it.created_at)}</span>
                        </div>

                        <button className="rate-cta-btn" style={{ background:v.gradient, boxShadow:`0 4px 18px ${v.glow}` }} onClick={() => onRate(it)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffffff" stroke="none">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                            Rate This Trip
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
    return (
        <div style={{ background:"#4d8a82", borderRadius:16, overflow:"hidden", border:"1px solid rgba(255,255,255,0.12)" }}>
            <style>{`@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}.shimmer{background:linear-gradient(90deg,rgba(255,255,255,0.06) 25%,rgba(255,255,255,0.12) 50%,rgba(255,255,255,0.06) 75%);background-size:400px 100%;animation:shimmer 1.4s infinite;border-radius:6px;}`}</style>
            <div style={{ height:4, background:"rgba(255,255,255,0.15)" }} />
            <div style={{ padding:"20px 20px 22px", display:"flex", gap:16 }}>
                <div className="shimmer" style={{ width:52, height:52, borderRadius:14, flexShrink:0 }} />
                <div style={{ flex:1 }}>
                    <div className="shimmer" style={{ height:10, width:"35%", marginBottom:10 }} />
                    <div className="shimmer" style={{ height:18, width:"65%", marginBottom:8 }} />
                    <div className="shimmer" style={{ height:10, width:"30%" }} />
                </div>
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MyItineraries() {
    const [list, setList]           = useState([]);
    const [feedbacks, setFeedbacks] = useState({});
    const [loading, setLoading]     = useState(true);
    const [rateIt, setRateIt]       = useState(null);
    const [editIt, setEditIt]       = useState(null);
    const [deleteIt, setDeleteIt]   = useState(null);

    const loadFeedbacks = () =>
        API.get("/feedback").then((res) => {
            const grouped = {};
            res.data.forEach((fb) => {
                if (!grouped[fb.itinerary_id]) grouped[fb.itinerary_id] = [];
                grouped[fb.itinerary_id].push(fb);
            });
            setFeedbacks(grouped);
        }).catch(() => {});

    useEffect(() => {
        Promise.all([
            API.get("/itineraries").then(r => setList(r.data)),
            loadFeedbacks(),
        ]).catch(() => alert("Could not load your itineraries."))
            .finally(() => setLoading(false));
    }, []);

    const handleSaved   = (id, title) => setList(p => p.map(it => it.itinerary_id === id ? { ...it, title } : it));
    const handleDeleted = (id)        => setList(p => p.filter(it => it.itinerary_id !== id));

    const vibeCount = list.reduce((acc, it) => {
        const k = (it.final_vibe || "explorer").toLowerCase();
        acc[k] = (acc[k] || 0) + 1;
        return acc;
    }, {});

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap');
                .it-page{min-height:100vh;background:#e8f0ef;font-family:'DM Sans',sans-serif;}
                .it-hero{background:#2d4a47;border-bottom:1px solid rgba(255,255,255,0.08);padding:44px 32px 36px;position:relative;overflow:hidden;}
                .it-hero-eyebrow{font-size:10.5px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(232,240,239,0.5);margin-bottom:10px;}
                .it-hero-title{font-family:'Playfair Display',serif;font-size:40px;font-weight:500;color:#e8f0ef;letter-spacing:-0.3px;line-height:1.05;margin-bottom:8px;}
                .it-hero-sub{font-size:14px;color:rgba(232,240,239,0.5);font-weight:300;}
                .it-vibe-strip{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px;}
                .it-vibe-chip{display:inline-flex;align-items:center;gap:7px;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.08);color:rgba(232,240,239,0.8);}
                .it-content{max-width:800px;margin:0 auto;padding:36px 24px 80px;}
                .it-empty{text-align:center;padding:72px 24px;}
                .it-empty-icon{width:80px;height:80px;border-radius:20px;background:#4d8a82;border:1px solid rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font-size:40px;margin:0 auto 20px;box-shadow:0 4px 20px rgba(29,58,54,0.2);}
                .it-empty h3{font-family:'Playfair Display',serif;font-size:26px;font-weight:400;color:#1a2e2b;margin-bottom:8px;}
                .it-empty p{font-size:14px;color:rgba(26,46,43,0.5);max-width:280px;margin:0 auto;line-height:1.7;}
                .it-empty span{font-weight:600;color:#2d4a47;}
                .cards-list{display:flex;flex-direction:column;gap:14px;}
            `}</style>

            <div className="it-page">
                <Navbar />

                <div className="it-hero">
                    <div style={{ maxWidth:800, margin:"0 auto", position:"relative" }}>
                        <p className="it-hero-eyebrow">VibeLanka</p>
                        <h1 className="it-hero-title">My Trips</h1>
                        <p className="it-hero-sub">
                            {loading ? "Loading your itineraries…"
                                : list.length === 0 ? "No itineraries yet — generate your first from the Dashboard"
                                    : `${list.length} personalised itinerar${list.length===1?"y":"ies"} crafted for you`}
                        </p>
                        {!loading && Object.keys(vibeCount).length > 0 && (
                            <div className="it-vibe-strip">
                                {Object.entries(vibeCount).map(([vibe, count]) => {
                                    const v = getVibe(vibe);
                                    return (
                                        <span key={vibe} className="it-vibe-chip">
                                            <span style={{ fontWeight:700 }}>{count}</span>
                                            <span style={{ textTransform:"capitalize" }}>{v.label}</span>
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="it-content">
                    {loading ? (
                        <div className="cards-list"><Skeleton/><Skeleton/><Skeleton/></div>
                    ) : list.length === 0 ? (
                        <div className="it-empty">
                            <div className="it-empty-icon">🗺️</div>
                            <h3>No trips yet</h3>
                            <p>Head to the Dashboard and tap <span>Generate AI Trip</span> to create your first personalised itinerary.</p>
                        </div>
                    ) : (
                        <div className="cards-list">
                            {list.map(it => (
                                <TripCard
                                    key={it.itinerary_id}
                                    it={it}
                                    feedbacks={feedbacks[it.itinerary_id] || []}
                                    onRate={setRateIt}
                                    onEdit={setEditIt}
                                    onDelete={setDeleteIt}
                                    onRefreshFeedbacks={loadFeedbacks}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {rateIt   && <FeedbackModal it={rateIt}   close={() => setRateIt(null)} />}
            {editIt   && <EditModal     it={editIt}   close={() => setEditIt(null)}   onSaved={handleSaved} />}
            {deleteIt && <DeleteModal   it={deleteIt} close={() => setDeleteIt(null)} onDeleted={handleDeleted} />}
        </>
    );
}