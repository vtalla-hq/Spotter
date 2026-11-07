import type { Marker, Units } from "./types";

/** Factor from SI to the display unit */
export const factor = (m: Marker, u: Units) => (u === "us" ? m.us[1] : 1);
export const unitLabel = (m: Marker, u: Units) => (u === "us" ? m.us[0] : m.unit);
export const decimals = (m: Marker, u: Units) => (u === "us" ? m.dp[1] : m.dp[0]);

/** Format an SI value for display in the chosen units */
export function fmt(m: Marker, u: Units, v: number | null | undefined): string {
  if (v == null) return "";
  const d = decimals(m, u);
  return (v * factor(m, u)).toLocaleString("en-CA", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Value for an input box: no thousands separators, at least 2 decimals kept */
export function fmtInput(m: Marker, u: Units, v: number | null | undefined): string {
  if (v == null) return "";
  return String(+(v * factor(m, u)).toFixed(Math.max(decimals(m, u), 2)));
}

/** Convert a typed value in display units back to SI */
export const toSI = (m: Marker, u: Units, typed: number) => typed / factor(m, u);
