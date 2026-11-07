import { BYID, M } from "./data/markers";
import { rangeFor } from "./ctx";
import type { Dir, Draw, Marker, Sex } from "./types";

/** Days since the Unix epoch for a YYYY-MM-DD date (UTC, so time zones don't shift it) */
export const dayNum = (iso: string) => Math.round(Date.parse(iso + "T00:00:00Z") / 86400000);
export const fromDayNum = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10);

export interface Point {
  date: string;
  day: number;
  v: number;
  ph?: Draw["ph"];
}

/** One marker across saved draws, oldest first */
export function series(draws: Draw[], id: string): Point[] {
  return draws
    .filter((d) => d.vals[id] != null && d.date)
    .map((d) => ({ date: d.date, day: dayNum(d.date), v: d.vals[id], ph: d.ph }))
    .sort((a, b) => a.day - b.day);
}

export interface Fit {
  /** change per day, SI units */
  slope: number;
  intercept: number;
  n: number;
}

/** Least-squares line through the points. Needs 2+ points on different days. */
export function linearFit(pts: Point[]): Fit | null {
  if (pts.length < 2) return null;
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.day, 0) / n;
  const my = pts.reduce((a, p) => a + p.v, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const p of pts) {
    sxx += (p.day - mx) ** 2;
    sxy += (p.day - mx) * (p.v - my);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, n };
}

/** Thresholds worth projecting toward, beyond the typical range (SI). */
export const TARGETS: Record<string, Partial<Record<Dir, { v: number; label: string }>>> = {
  hematocrit: { up: { v: 0.54, label: "the 54% hold point" } },
  glucose: { up: { v: 7.0, label: "the diabetes range" } },
  a1c: { up: { v: 6.5, label: "the diabetes range" } },
  ldl: { up: { v: 5.0, label: "the statin threshold" } },
  potassium: { down: { v: 3.0, label: "a dangerous low" } },
};

export interface Projection {
  id: string;
  dir: Dir;
  /** SI value it's heading for */
  target: number;
  label: string;
  /** days from the latest draw */
  days: number;
  date: string;
  /** change per 30 days, SI */
  per30: number;
}

/** Only fit on recent draws, so an old baseline doesn't flatten a fresh trend */
const RECENT = 4;
const MAX_DAYS = 365;

/**
 * "At this rate your hematocrit hits 54% around Dec 14." Projects the recent
 * trend to the next threshold it's moving toward: the edge of the typical range
 * if it's still inside it, then any red-flag threshold beyond that.
 */
export function project(m: Marker, sex: Sex, pts: Point[]): Projection | null {
  // a line through baseline → on cycle → off cycle means nothing: only fit the latest phase
  let start = pts.length - 1;
  while (start > 0 && pts[start - 1].ph === pts[pts.length - 1]?.ph) start--;
  const recent = pts.slice(start).slice(-RECENT);
  const fit = linearFit(recent);
  if (!fit || fit.slope === 0) return null;
  const span = recent[recent.length - 1].day - recent[0].day;
  if (span < 7) return null;
  const dir: Dir = fit.slope > 0 ? "up" : "down";
  const last = recent[recent.length - 1];
  const [lo, hi] = rangeFor(m, sex);
  const red = TARGETS[m.id]?.[dir];
  const edge = dir === "up" ? hi : lo;
  const ahead = (t: number) => (dir === "up" ? t > last.v : t < last.v);
  let target: { v: number; label: string } | null = null;
  if (ahead(edge)) target = { v: edge, label: dir === "up" ? "the top of the typical range" : "the bottom of the typical range" };
  else if (red && ahead(red.v)) target = red;
  if (!target) return null;
  // ignore noise: the trend must cover at least 2% of the range width per month
  const per30 = fit.slope * 30;
  if (Math.abs(per30) < (hi - lo) * 0.02) return null;
  // project from the latest real value along the fitted slope
  const days = Math.ceil((target.v - last.v) / fit.slope);
  if (days <= 0 || days > MAX_DAYS) return null;
  return { id: m.id, dir, target: target.v, label: target.label, days, date: fromDayNum(last.day + days), per30 };
}

export function projections(draws: Draw[], sex: Sex): Projection[] {
  return M.map((m) => project(m, sex, series(draws, m.id)))
    .filter((p): p is Projection => p != null)
    .sort((a, b) => a.days - b.days);
}

export interface Recovery {
  id: string;
  baseline: number;
  worst: number;
  latest: number;
  /** 0–100: how far back toward baseline from the worst draw */
  pct: number;
  /** went past baseline the other way, e.g. testosterone now below where it started */
  overshoot: boolean;
}

/**
 * Recovery after a cycle: compares the latest draw with your own baseline
 * (a draw marked "before starting") and the worst value since. "HDL is back to
 * 80% of baseline." Only for markers that actually moved.
 */
export function recovery(draws: Draw[], sex: Sex): Recovery[] {
  const sorted = [...draws].filter((d) => d.date).sort((a, b) => dayNum(a.date) - dayNum(b.date));
  const base = sorted.find((d) => d.ph === "pre");
  if (!base) return [];
  const after = sorted.filter((d) => dayNum(d.date) > dayNum(base.date));
  const latest = after[after.length - 1];
  // recovery only means something once you've stopped
  if (!latest || after.length < 2 || latest.ph !== "off") return [];
  const out: Recovery[] = [];
  for (const m of M) {
    const b = base.vals[m.id];
    const l = latest.vals[m.id];
    if (b == null || l == null) continue;
    const prior = after.slice(0, -1).map((d) => d.vals[m.id]).filter((v): v is number => v != null);
    if (!prior.length) continue;
    const worst = prior.reduce((w, v) => (Math.abs(v - b) > Math.abs(w - b) ? v : w), prior[0]);
    const [lo, hi] = rangeFor(m, sex);
    if (Math.abs(worst - b) < (hi - lo) * 0.1) continue;
    const raw = (1 - (l - b) / (worst - b)) * 100;
    const overshoot = Math.sign(l - b) === -Math.sign(worst - b) && Math.abs(l - b) >= (hi - lo) * 0.1;
    out.push({ id: m.id, baseline: b, worst, latest: l, pct: Math.max(0, Math.min(100, Math.round(raw))), overshoot });
  }
  return out.sort((a, b) => a.pct - b.pct);
}

/** Change between the last two draws for each marker in both */
export function changes(draws: Draw[]): { id: string; from: number; to: number; delta: number; pct: number }[] {
  const sorted = [...draws].filter((d) => d.date).sort((a, b) => dayNum(a.date) - dayNum(b.date));
  if (sorted.length < 2) return [];
  const [a, b] = sorted.slice(-2);
  return Object.keys(b.vals)
    .filter((id) => a.vals[id] != null && BYID[id])
    .map((id) => {
      const from = a.vals[id];
      const to = b.vals[id];
      return { id, from, to, delta: to - from, pct: from ? ((to - from) / Math.abs(from)) * 100 : 0 };
    });
}
