import { useNavigate } from "react-router-dom";

// ─────────────────────────────────────────────────────────────────────────────
// NextStepBanner.jsx  —  shared component
//
// A sticky bottom banner that guides the user to the next step.
// Used on: Locations, Hotels, Guides, ItineraryPlanner pages.
//
// Props:
//   step        — current step number (1-4)
//   done        — whether this step is completed (shows green "✓ Done" badge)
//   nextPath    — where the button navigates to
//   nextLabel   — button text e.g. "Choose Your Hotel →"
//   nextSub     — subtitle e.g. "Step 2 of 4"
//   locked      — if true, button is disabled with a message
//   lockedMsg   — message shown when locked e.g. "Save a location first"
// ─────────────────────────────────────────────────────────────────────────────

export default function NextStepBanner({ step, done, nextPath, nextLabel, nextSub, locked = false, lockedMsg = "" }) {
    const navigate = useNavigate();

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@400;500&display=swap');

                .nsb-wrap {
                    position: fixed;
                    bottom: 0; left: 0; right: 0;
                    z-index: 50;
                    background: #2d4a47;
                    border-top: 1px solid rgba(255,255,255,0.1);
                    box-shadow: 0 -4px 24px rgba(29,58,54,0.3);
                    padding: 16px 32px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 20px;
                    font-family: 'DM Sans', sans-serif;
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

                .nsb-dot.done   { background: #34d399; }
                .nsb-dot.active { background: #ffcc00; transform: scale(1.3); }
                .nsb-dot.future { background: rgba(255,255,255,0.2); }

                .nsb-label {
                    font-size: 13px;
                    font-weight: 600;
                    color: #e8f0ef;
                }

                .nsb-done-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    background: rgba(52,211,153,0.15);
                    border: 1px solid rgba(52,211,153,0.35);
                    border-radius: 20px;
                    padding: 3px 10px;
                    font-size: 11px;
                    font-weight: 600;
                    color: #34d399;
                }

                .nsb-right {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }

                .nsb-sub {
                    font-size: 12px;
                    color: rgba(232,240,239,0.45);
                    font-weight: 400;
                    text-align: right;
                }

                .nsb-btn {
                    padding: 12px 28px;
                    border: none;
                    border-radius: 10px;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 14px;
                    font-weight: 700;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: background 0.2s, transform 0.15s, opacity 0.2s;
                }

                .nsb-btn.active {
                    background: #ffcc00;
                    color: #1a2e2b;
                    box-shadow: 0 4px 14px rgba(255,204,0,0.35);
                }

                .nsb-btn.active:hover {
                    background: #e6b800;
                    transform: translateY(-1px);
                }

                .nsb-btn.done-style {
                    background: rgba(52,211,153,0.15);
                    border: 1px solid rgba(52,211,153,0.3);
                    color: #34d399;
                }

                .nsb-btn.done-style:hover {
                    background: rgba(52,211,153,0.25);
                    transform: translateY(-1px);
                }

                .nsb-btn.locked {
                    background: rgba(255,255,255,0.07);
                    color: rgba(255,255,255,0.3);
                    cursor: not-allowed;
                }

                .nsb-locked-msg {
                    font-size: 11.5px;
                    color: rgba(255,255,255,0.35);
                }

                /* Push page content above the banner */
                .nsb-spacer { height: 80px; }

                @media(max-width: 580px) {
                    .nsb-wrap { padding: 14px 18px; }
                    .nsb-btn { padding: 11px 18px; font-size: 13px; }
                    .nsb-sub { display: none; }
                }
            `}</style>

            {/* Spacer so page content isn't hidden behind the banner */}
            <div className="nsb-spacer" />

            <div className="nsb-wrap">
                {/* Left: step dots + done badge */}
                <div className="nsb-left">
                    <div className="nsb-step-dots">
                        {[1, 2, 3, 4].map(n => (
                            <div key={n} className={`nsb-dot ${n < step ? "done" : n === step ? "active" : "future"}`} />
                        ))}
                    </div>
                    {done && <span className="nsb-done-badge">✓ This step done</span>}
                    {!done && !locked && (
                        <span style={{ fontSize:12, color:"rgba(232,240,239,0.45)" }}>
                            Save something on this page to continue
                        </span>
                    )}
                </div>

                {/* Right: subtitle + button */}
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
