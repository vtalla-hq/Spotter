import { BYC } from "./data/compounds";
import { BYID } from "./data/markers";
import { SAMPLE } from "./data/sample";
import { EMPTY_STATE, type Draw, type Phase, type State } from "./types";

const PHASES: Phase[] = ["pre", "on", "off"];
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

function cleanVals(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) if (BYID[k] && isNum(x) && x >= 0) out[k] = x;
  return out;
}

function cleanDraw(d: any): Draw | null {
  if (!d || typeof d !== "object" || !isDate(d.date)) return null;
  return {
    id: typeof d.id === "string" ? d.id : newId(),
    date: d.date,
    vals: cleanVals(d.vals),
    stack: Array.isArray(d.stack) ? d.stack.filter((x: unknown) => typeof x === "string" && BYC[x as string]) : [],
    train: !!d.train,
    ph: PHASES.includes(d.ph) ? d.ph : "on",
    wk: typeof d.wk === "string" ? d.wk : "",
  };
}

/**
 * Accept anything (old v1 storage, a synced copy, junk) and return a valid State.
 * Unknown markers and compounds are dropped rather than crashing the app.
 */
export function normalize(raw: any): State {
  const d = raw && typeof raw === "object" ? raw : {};
  const me: State["me"] = {};
  if (d.me && typeof d.me === "object")
    for (const k of ["age", "sys", "dia", "hr"] as const) if (typeof d.me[k] === "string") me[k] = d.me[k];
  const hab: Record<string, boolean> = {};
  if (d.hab && typeof d.hab === "object") for (const [k, v] of Object.entries(d.hab)) if (v) hab[k] = true;
  return {
    ...EMPTY_STATE,
    sex: d.sex === "f" ? "f" : "m",
    units: d.units === "us" ? "us" : "si",
    stack: Array.isArray(d.stack) ? d.stack.filter((x: unknown) => typeof x === "string" && BYC[x as string]) : [],
    train: !!d.train,
    hab,
    vals: cleanVals(d.vals),
    cyc: { ph: PHASES.includes(d.cyc?.ph) ? d.cyc.ph : "on", wk: typeof d.cyc?.wk === "string" ? d.cyc.wk : "" },
    me,
    example: !!d.example,
    draws: Array.isArray(d.draws) ? d.draws.map(cleanDraw).filter((x: Draw | null): x is Draw => !!x) : [],
    drawDate: isDate(d.drawDate) ? d.drawDate : "",
    updatedAt: isNum(d.updatedAt) ? d.updatedAt : 0,
  };
}

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

export const today = () => new Date().toLocaleDateString("en-CA");

/**
 * Save the current results as a dated draw. A draw already saved for the same
 * date is replaced, so re-saving after a fix doesn't create a duplicate.
 */
export function saveDraw(s: State, date: string): State {
  const existing = s.draws.find((d) => d.date === date);
  const draw: Draw = {
    id: existing?.id ?? newId(),
    date,
    vals: { ...s.vals },
    stack: [...s.stack],
    train: s.train,
    ph: s.cyc.ph,
    wk: s.cyc.wk,
  };
  const draws = [...s.draws.filter((d) => d.date !== date), draw].sort((a, b) => a.date.localeCompare(b.date));
  return { ...s, draws, drawDate: date };
}

/** Bring a saved draw back as the current results */
export function loadDraw(s: State, id: string): State {
  const d = s.draws.find((x) => x.id === id);
  if (!d) return s;
  return { ...s, vals: { ...d.vals }, stack: [...d.stack], train: d.train, cyc: { ph: d.ph, wk: d.wk }, drawDate: d.date, example: false };
}

export const deleteDraw = (s: State, id: string): State => ({ ...s, draws: s.draws.filter((d) => d.id !== id) });

/** Sample data, including a draw history so the Trends tab has something to show */
export function sampleState(s: State): State {
  const base: State = {
    ...s,
    stack: [...SAMPLE.stack],
    train: SAMPLE.train,
    vals: { ...SAMPLE.vals },
    cyc: { ...SAMPLE.cyc },
    me: { ...SAMPLE.me },
    hab: {},
    sex: "m",
    units: "si",
    example: true,
  };
  const t = new Date();
  const ago = (days: number) => new Date(t.getTime() - days * 86400000).toLocaleDateString("en-CA");
  const mk = (days: number, ph: Phase, wk: string, stack: string[], vals: Record<string, number>): Draw => ({
    id: "sample-" + days, date: ago(days), vals, stack, train: true, ph, wk,
  });
  const draws: Draw[] = [
    mk(91, "pre", "", ["creatine"], { hematocrit: 0.47, hemoglobin: 156, hdl: 1.18, ldl: 2.9, apob: 0.88, alt: 31, ast: 28, testo: 19.5, lh: 4.6, glucose: 5.1, a1c: 5.3, creatinine: 112, ck: 610 }),
    mk(49, "on", "3", SAMPLE.stack, { hematocrit: 0.5, hemoglobin: 168, hdl: 0.84, ldl: 3.5, apob: 1.05, alt: 58, ast: 52, testo: 61, lh: 0.2, glucose: 5.6, a1c: 5.5, creatinine: 124, ck: 1400 }),
    mk(21, "on", "6", SAMPLE.stack, { hematocrit: 0.525, hemoglobin: 176, hdl: 0.68, ldl: 3.8, apob: 1.14, alt: 81, ast: 63, testo: 60, lh: 0.1, glucose: 5.9, a1c: 5.7, creatinine: 128, ck: 1800 }),
  ];
  const today = new Date().toLocaleDateString("en-CA");
  return saveDraw({ ...base, draws }, today);
}

export function clearedState(s: State): State {
  return { ...EMPTY_STATE, sex: s.sex, units: s.units, draws: s.example ? [] : s.draws };
}
