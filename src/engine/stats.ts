import type { Marker, Range } from "./types";

/** Abramowitz–Stegun 7.1.26, max error ~1.5e-7 */
export function erf(x: number): number {
  const s = Math.sign(x);
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return s * y;
}

/** Standard normal CDF */
export const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

/**
 * Fit a normal (or log-normal) curve so the typical range is the 2.5th–97.5th
 * percentile: the range spans ±1.96 SD, so SD = width / 3.92.
 */
export function fitParams(m: Marker, r: Range): { mu: number; sd: number } {
  const [lo, hi] = r;
  if (m.dist === "log") {
    const a = Math.log(lo);
    const b = Math.log(hi);
    return { mu: (a + b) / 2, sd: (b - a) / 3.92 };
  }
  return { mu: (lo + hi) / 2, sd: (hi - lo) / 3.92 };
}

export function zScore(m: Marker, r: Range, x: number): number {
  const p = fitParams(m, r);
  return m.dist === "log" ? (Math.log(Math.max(x, 1e-6)) - p.mu) / p.sd : (x - p.mu) / p.sd;
}

/** Estimated percentile, 0–100 */
export const percentile = (m: Marker, r: Range, x: number) => Phi(zScore(m, r, x)) * 100;

/** Unnormalised density, for drawing the curve */
export function density(m: Marker, r: Range, x: number): number {
  const p = fitParams(m, r);
  if (m.dist === "log") {
    if (x <= 0) return 0;
    const z = (Math.log(x) - p.mu) / p.sd;
    return Math.exp((-z * z) / 2) / (x * p.sd);
  }
  const z = (x - p.mu) / p.sd;
  return Math.exp((-z * z) / 2) / p.sd;
}

/** 1 → "1st", 22 → "22nd", with <1st / >99th at the tails */
export function ordinal(p: number): string {
  if (p < 1) return "<1st";
  if (p > 99) return ">99th";
  const n = Math.round(p);
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suf = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] || "th";
  return n + suf;
}

/** Round a raw axis step to 1, 2, 5 or 10 × a power of ten */
export function niceStep(raw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}
