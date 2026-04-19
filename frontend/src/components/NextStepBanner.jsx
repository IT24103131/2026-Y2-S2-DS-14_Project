import { useNavigate } from "react-router-dom";

// ─────────────────────────────────────────────────────────────────────────────
// NextStepBanner.jsx  —  shared bottom banner
// Vibe Lanka design system: rust #8C3322, cream #F9F6F0, gold #D4A373, green #4A5D23
//
// Props:
//   step        — current step number (1-4)
//   done        — whether this step is completed
//   nextPath    — where the button navigates to
//   nextLabel   — button text e.g. "Choose Your Hotel →"
//   nextSub     — subtitle e.g. "Step 2 of 4"
//   locked      — if true, button is disabled
//   lockedMsg   — message shown when locked
// ─────────────────────────────────────────────────────────────────────────────

export default function NextStepBanner({ step, done, nextPath, nextLabel, nextSub, locked = false, lockedMsg = "" }) {
    const navigate = useNavigate();

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;500&display=swap');

                .nsb-wrap {
                    position: fixed;
                    bottom: 0; left: 268px; right: 0;
                    z-index: 50;
                    background: #8C3322;
                    border-top: 1px solid rgba(255,255,255,0.1);
                    box-shadow: 0 -4px 24px rgba(140,51,34,0.25);
                    padding: 16px 32px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 20px;
                    font-family: 'Inter', sans-serif;
                }

                .nsb-left {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    flex-shrink: 0;
                }

                .nsb-step-dots {
                    display: flex;
                    gap: 6px;
                    align-items: center;
                }

                .nsb-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    transition: background 0.2s, transform 0.2s;
                }

                .nsb-dot.done   { background: #4A5D23; }
                .nsb-dot.active { background: #D4A373; transform: scale(1.3); }
                .nsb-dot.future { background: rgba(255,255,255,0.2); }

                .nsb-label {
                    font-size: 13px;
                    font-weight: 600;
                    color: rgba(255,255,255,0.85);
                }

                .nsb-done-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    background: rgba(74,93,35,0.25);
                    border: 1px solid rgba(74,93,35,0.5);
                    border-radius: 20px;
                    padding: 3px 10px;
                    font-size: 11px;
                    font-weight: 600;
                    color: #a8c48a;
                }

                .nsb-right {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }

                .nsb-sub {
                    font-size: 12px;
                    color: rgba(255,255,255,0.45);
                    font-weight: 400;
                    text-align: right;
                }

                .nsb-btn {
                    padding: 12px 28px;
                    border: none;
                    border-radius: 50px;
                    font-family: 'Inter', sans-serif;
                    font-size: 14px;
                    font-weight: 700;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: background 0.2s, transform 0.15s, opacity 0.2s;
                    min-height: 48px;
                }

                .nsb-btn.active {
                    background: #ffffff;
                    color: #8C3322;
                    box-shadow: 0 4px 14px rgba(255,255,255,0.2);
                }

                .nsb-btn.active:hover {
                    background: #F9F6F0;
                    transform: translateY(-1px);
                }

                .nsb-btn.done-style {
                    background: rgba(255,255,255,0.15);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: #fff;
                }

                .nsb-btn.done-style:hover {
                    background: rgba(255,255,255,0.22);
                    transform: translateY(-1px);
                }

                .nsb-btn.locked {
                    background: rgba(255,255,255,0.07);
                    color: rgba(255,255,255,0.3);
                    cursor: not-allowed;
                }

                .nsb-locked-msg {
                    font-size: 11.5px;
                    color: rgba(255,255,255,0.45);
                }

                .nsb-spacer { height: 80px; }

                @media(max-width: 900px) {
                    .nsb-wrap { left: 0; }
                }
                @media(max-width: 580px) {
                    .nsb-wrap { padding: 14px 18px; }
                    .nsb-btn { padding: 11px 18px; font-size: 13px; }
                    .nsb-sub { display: none; }
                }
            `}</style>

            <div className="nsb-spacer" />

            <div className="nsb-wrap">
                <div className="nsb-left">
                    <div className="nsb-step-dots">
                        {[1, 2, 3, 4].map(n => (
                            <div key={n} className={`nsb-dot ${n < step ? "done" : n === step ? "active" : "future"}`} />
                        ))}
                    </div>
                    {done && <span className="nsb-done-badge">✓ This step done</span>}
                    {!done && !locked && (
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                            Save something on this page to continue
                        </span>
                    )}
                </div>

                <div className="nsb-right">
                    {locked && lockedMsg && (
                        <span className="nsb-locked-msg">🔒 {lockedMsg}</span>
                    )}
                    {!locked && nextSub && (
                        <span className="nsb-sub">{nextSub}</span>
                    )}
                    <button
                        className={`nsb-btn ${locked ? "locked" : done ? "done-style" : "active"}`}
                        onClick={() => !locked && navigate(nextPath)}
                        disabled={locked}
                    >
                        {nextLabel}
                    </button>
                </div>
            </div>
        </>
    );
}
