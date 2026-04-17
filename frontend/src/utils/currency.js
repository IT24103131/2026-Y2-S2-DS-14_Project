// src/utils/currency.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for currency conversion and formatting.
// DB stays untouched — this is purely a display utility.
// AI components (reward, OCEAN scores) use raw numbers — unaffected.
// ─────────────────────────────────────────────────────────────────────────────

export const LKR_TO_USD = 320; // 1 USD ≈ LKR 320 — update here if rate changes

/**
 * Convert LKR to USD
 */
export const lkrToUsd = (lkr) => Math.round(lkr / LKR_TO_USD);

/**
 * Convert USD to LKR
 */
export const usdToLkr = (usd) => Math.round(usd * LKR_TO_USD);

/**
 * Format a number as LKR string
 * e.g. 35000 → "LKR 35,000"
 */
export const fmtLKR = (amount) =>
    `LKR ${Number(amount).toLocaleString("en-LK")}`;

/**
 * Format a number as USD string
 * e.g. 109 → "$109"
 */
export const fmtUSD = (amount) =>
    `$${Number(amount).toLocaleString("en-US")}`;

/**
 * Show both currencies from a LKR amount.
 * Returns plain string: "LKR 35,000 (~$109)"
 *
 * Usage (plain text / inside JSX):
 *   dualFromLKR(35000)  →  "LKR 35,000 (~$109)"
 */
export const dualFromLKR = (lkr) =>
    `${fmtLKR(lkr)} (~${fmtUSD(lkrToUsd(lkr))})`;

/**
 * Show both currencies from a USD amount.
 * Returns plain string: "$14 (~LKR 4,480)"
 *
 * Usage:
 *   dualFromUSD(14)  →  "$14 (~LKR 4,480)"
 */
export const dualFromUSD = (usd) =>
    `${fmtUSD(usd)} (~${fmtLKR(usdToLkr(usd))})`;