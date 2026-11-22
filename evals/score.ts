/**
 * Scores parser output against golden labels. Pure: no I/O.
 * All marker metrics are micro-averaged (pooled over markers); date accuracy is per report.
 */
import { BYID } from "../src/engine/data/markers";
import type { ParseResult } from "../src/engine/parse";
import { LOOKALIKES, type Label } from "./gen/cases";

export type Render = "pdf" | "scan" | "photo";
export const RENDERS: Render[] = ["pdf", "scan", "photo"];

export interface RunOutput {
  text: string;
  method: "pdf-text" | "ocr";
  pages: number;
  parsed: ParseResult;
  ms: number;
}

export type Problem =
  | { kind: "missed"; id: string; expected: number; textLine: string | null }
  | { kind: "value"; id: string; expected: number; got: number; line: string; flagged: boolean }
  | { kind: "unit"; id: string; expected: string; got: string; by: string; line: string }
  | { kind: "false-hit"; id: string; got: number; line: string; lookalike: string | null }
  | { kind: "date"; expected: string; got: string | null };

export interface ReportScore {
  id: string;
  layout: string;
  render: Render;
  method: string;
  ms: number;
  expected: number;
  found: number;
  tp: number;
  fp: number;
  fpLookalike: number;
  lookalikesShown: number;
  valueOk: number;
  siOk: number;
  /** found with a wrong value and not flagged "check this" in the review screen */
  silent: number;
  unitScored: number;
  unitOk: number;
  unitLabelled: number;
  unitLabelledOk: number;
  dateOk: boolean;
  problems: Problem[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const close = (a: number, b: number, rel: number) => Math.abs(a - b) <= rel * Math.max(Math.abs(b), 1e-9);

/** The line in the extracted text that holds a marker's printed name, if any (for failure reports). */
function lineFor(text: string, label: Label, id: string, names: Record<string, string>): string | null {
  const n = norm(names[id] ?? "");
  if (!n) return null;
  return text.split("\n").find((l) => norm(l).includes(n)) ?? null;
}

export function score(label: Label, render: Render, out: RunOutput, names: Record<string, string>): ReportScore {
  const pages = render === "photo" ? label.photoPages : Infinity;
  const exp = label.markers.filter((m) => m.page <= pages);
  const shownLa = label.lookalikes.filter((l) => l.page <= pages);
  const laNames = shownLa.map((l) => ({ key: l.key, n: norm(LOOKALIKES.find((d) => d.key === l.key)!.name[label.layout]) }));
  const got = new Map(out.parsed.values.map((v) => [v.id, v]));
  const s: ReportScore = {
    id: label.id, layout: label.layout, render, method: out.method, ms: out.ms,
    expected: exp.length, found: out.parsed.values.length, tp: 0, fp: 0, fpLookalike: 0, lookalikesShown: shownLa.length,
    valueOk: 0, siOk: 0, silent: 0, unitScored: 0, unitOk: 0, unitLabelled: 0, unitLabelledOk: 0,
    dateOk: out.parsed.date === label.drawDate, problems: [],
  };
  for (const e of exp) {
    const v = got.get(e.id);
    if (!v) {
      s.problems.push({ kind: "missed", id: e.id, expected: e.value, textLine: lineFor(out.text, label, e.id, names) });
      continue;
    }
    s.tp++;
    const m = BYID[e.id];
    const expSI = e.unit === "us" ? e.value / m.us[1] : e.value;
    const valueOk = close(v.raw, e.value, 1e-6);
    if (valueOk) s.valueOk++;
    if (close(v.si, expSI, 0.005)) s.siOk++;
    else if (!v.check) s.silent++;
    if (!valueOk) s.problems.push({ kind: "value", id: e.id, expected: e.value, got: v.raw, line: v.line, flagged: v.check });
    // unit only matters where SI and US differ in scale
    if (m.us[1] !== 1) {
      s.unitScored++;
      const ok = v.unit === e.unit;
      if (ok) s.unitOk++;
      if (v.by === "label") {
        s.unitLabelled++;
        if (ok) s.unitLabelledOk++;
      }
      if (!ok && valueOk) s.problems.push({ kind: "unit", id: e.id, expected: e.unit, got: v.unit, by: v.by, line: v.line });
    }
  }
  const expIds = new Set(exp.map((e) => e.id));
  for (const v of out.parsed.values) {
    if (expIds.has(v.id)) continue;
    s.fp++;
    const nl = norm(v.line);
    const la = laNames.find((l) => l.n && nl.includes(l.n))?.key ?? null;
    if (la) s.fpLookalike++;
    s.problems.push({ kind: "false-hit", id: v.id, got: v.raw, line: v.line, lookalike: la });
  }
  if (!s.dateOk) s.problems.push({ kind: "date", expected: label.drawDate, got: out.parsed.date });
  return s;
}

export interface Agg {
  reports: number;
  recall: number;
  precision: number;
  value: number;
  si: number;
  unit: number;
  unitLabelled: number;
  date: number;
  /** wrong values the review screen doesn't flag, as % of markers found */
  silent: number;
  lookalikeHits: number;
  lookalikeRows: number;
  msMedian: number;
  msP95: number;
}

const pct = (a: number, b: number) => (b ? (100 * a) / b : NaN);
const quant = (xs: number[], q: number) => {
  if (!xs.length) return NaN;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(q * a.length))];
};

export function aggregate(rs: ReportScore[]): Agg {
  const sum = (k: keyof ReportScore) => rs.reduce((a, r) => a + (r[k] as number), 0);
  return {
    reports: rs.length,
    recall: pct(sum("tp"), sum("expected")),
    precision: pct(sum("tp"), sum("found")),
    value: pct(sum("valueOk"), sum("tp")),
    si: pct(sum("siOk"), sum("tp")),
    unit: pct(sum("unitOk"), sum("unitScored")),
    unitLabelled: pct(sum("unitLabelledOk"), sum("unitLabelled")),
    date: pct(rs.filter((r) => r.dateOk).length, rs.length),
    silent: pct(sum("silent"), sum("tp")),
    lookalikeHits: sum("fpLookalike"),
    lookalikeRows: sum("lookalikesShown"),
    msMedian: quant(rs.map((r) => r.ms), 0.5),
    msP95: quant(rs.map((r) => r.ms), 0.95),
  };
}

/** Markers correct end to end: found, right value and right SI value. */
export const endToEnd = (rs: ReportScore[]) =>
  pct(rs.reduce((a, r) => a + r.siOk, 0), rs.reduce((a, r) => a + r.expected, 0));
