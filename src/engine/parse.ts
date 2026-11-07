import { M } from "./data/markers";
import { rangeFor } from "./ctx";
import { zScore } from "./stats";
import type { Marker, Sex, Units } from "./types";

/**
 * Lab report parser. Works on pasted portal text, PDF text and OCR output,
 * so it has to survive messy layouts:
 *  - finds the marker name (longest alias wins, so "Hemoglobin A1c" beats "Hemoglobin")
 *  - skips look-alikes (Non-HDL, Chol/HDL ratio, free testosterone, MCHC, urine tests…)
 *  - takes the result, not the reference range, even when the range comes first
 *  - reads the unit from the line, and when there isn't one, picks whichever unit
 *    puts the value in a plausible place (hematocrit "45" means 45%, not 45 L/L)
 *  - fixes common OCR slips inside numbers (O→0, l→1, decimal commas)
 *  - finds the collection date
 */

export type UnitSource = "label" | "plausible" | "selected" | "same";

export interface ParsedValue {
  id: string;
  /** number as written on the report */
  raw: number;
  /** unit the number was read in */
  unit: Units;
  /** value converted to SI */
  si: number;
  /** how the unit was decided */
  by: UnitSource;
  /** true when the value looks implausible either way and needs a human look */
  check: boolean;
  line: string;
}

export interface ParseResult {
  values: ParsedValue[];
  /** collection date, YYYY-MM-DD */
  date: string | null;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Lines mentioning these are a different test that happens to share a name. */
const EXCLUDE: Record<string, RegExp> = {
  hdl: /ratio|non[\s-]*hdl|\/\s*hdl|hdl\s*\//,
  ldl: /ratio|\/\s*ldl|ldl\s*\/|particle|ldl-?p\b/,
  testo: /free|bioavail|\bshbg\b/,
  hemoglobin: /corpuscular|\bmchc?\b|a1c|glycated|glycosylated/,
  plt: /mean platelet|\bmpv\b|distribution/,
  bili: /direct|indirect|conjugated/,
  psa: /free|ratio|%\s*free/,
  creatinine: /clearance|kinase|ratio|egfr/,
  glucose: /tolerance|random|(^|[^\d.])2\s*-?\s*(h|hr|hour)\b|post|\bpp\b|urine/,
  tsh: /receptor|antibod/,
  ck: /\bmb\b|ck-?mb/,
};
const ANY_EXCLUDE = /urine|urinalysis|\bur\b|csf/;

/** "4,5" → "4.5" but "1,450" → "1450"; O/o and l/I next to digits → 0 and 1 */
export function cleanNumbers(s: string): string {
  return s
    .replace(/(\d)[Oo](?=\d|\b)/g, "$10")
    .replace(/(?<=\s|^)[Oo](?=[.,]\d)/g, "0")
    .replace(/(\d)[lI](?=\d)/g, "$11")
    .replace(/(\d),(\d{3})(?!\d)/g, "$1$2")
    .replace(/(\d),(\d{1,2})(?!\d)/g, "$1.$2");
}

const normUnit = (s: string) =>
  s
    .toLowerCase()
    .replace(/[μ]/g, "µ")
    .replace(/\bu(?=mol|g\/|g\b|iu)/g, "µ")
    .replace(/mcg/g, "µg")
    .replace(/\s+/g, "")
    .replace(/×|x(?=10)/g, "×")
    .replace(/10(\^|\*|e)?9/g, "10⁹")
    .replace(/10(\^|\*|e)?3/g, "10³");

/** Unit strings a marker's SI and US values are written in, normalised */
function unitWords(m: Marker): { si: string[]; us: string[] } {
  const si = [normUnit(m.unit)];
  const us = [normUnit(m.us[0].split(" ")[0])];
  // extra spellings labs use
  if (m.id === "plt") si.push("10⁹/l", "×10⁹/l", "k/µl"), us.push("10³/µl", "k/µl", "thou/µl");
  if (m.id === "hematocrit") si.push("l/l", "fraction"), us.push("%");
  if (m.id === "igf1" || m.id === "ferritin" || m.id === "psa") si.push("µg/l"), us.push("ng/ml");
  if (m.id === "urea") us.push("mg/dl");
  return { si, us };
}

function findUnit(m: Marker, rest: string): Units | null {
  const r = normUnit(rest);
  const { si, us } = unitWords(m);
  const at = (list: string[]) => {
    let best = Infinity;
    for (const w of list) {
      const i = r.indexOf(w);
      if (i >= 0 && i < best) best = i;
    }
    return best;
  };
  const a = at(si);
  const b = at(us);
  if (a === Infinity && b === Infinity) return null;
  return a <= b ? "si" : "us";
}

interface Num {
  v: number;
  at: number;
  range: boolean;
}

/** Numbers in a string, marking ones that are part of a reference range like "10 - 50" or "(<5.2)" */
function numbersIn(s: string): Num[] {
  const out: Num[] = [];
  const rangeRe = /(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)/g;
  const inRange = new Set<number>();
  for (const m of s.matchAll(rangeRe)) {
    const start = m.index!;
    inRange.add(start);
    inRange.add(start + m[0].lastIndexOf(m[2]));
  }
  // numbers right after < or > inside brackets are reference limits, e.g. "(<5.2)"
  const refRe = /[([]\s*[<>≤≥]=?\s*(\d+(?:\.\d+)?)/g;
  for (const m of s.matchAll(refRe)) inRange.add(m.index! + m[0].lastIndexOf(m[1]));
  for (const m of s.matchAll(/\d+(?:\.\d+)?/g)) {
    out.push({ v: parseFloat(m[0]), at: m.index!, range: inRange.has(m.index!) });
  }
  return out;
}

interface Hit {
  m: Marker;
  a: string;
  end: number;
}

function findMarker(L: string): Hit | null {
  let best: Hit | null = null;
  for (const m of M) {
    for (const a of m.al) {
      const re = new RegExp("(^|[^a-z0-9])" + esc(a) + "(?=[^a-z]|$)");
      const hit = re.exec(L);
      if (!hit) continue;
      if (!best || a.length > best.a.length) best = { m, a, end: hit.index + hit[0].length };
    }
  }
  if (!best) return null;
  if (ANY_EXCLUDE.test(L) || EXCLUDE[best.m.id]?.test(L)) return null;
  return best;
}

/**
 * Pick SI or US for a bare number. The selected units win unless the value
 * would be wildly implausible in them and plausible in the other.
 */
export function inferUnit(m: Marker, sex: Sex, raw: number, selected: Units): { unit: Units; by: UnitSource; check: boolean } {
  if (m.us[1] === 1) return { unit: selected, by: "same", check: Math.abs(zScore(m, rangeFor(m, sex), raw)) > 8 };
  const r = rangeFor(m, sex);
  const zSI = Math.abs(zScore(m, r, raw));
  const zUS = Math.abs(zScore(m, r, raw / m.us[1]));
  const zSel = selected === "si" ? zSI : zUS;
  const zOther = selected === "si" ? zUS : zSI;
  if (zSel <= 5 || zSel <= zOther) return { unit: selected, by: "selected", check: zSel > 8 };
  return { unit: selected === "si" ? "us" : "si", by: "plausible", check: zOther > 8 };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");

function validDate(y: number, mo: number, d: number): string | null {
  if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/** First date in a string. Handles 2026-10-01, 2026/10/01, Oct 1, 2026, 01-Oct-2026 and 10/01/2026. */
export function findDate(s: string): string | null {
  const L = s.toLowerCase();
  let m = L.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = L.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (m) return validDate(+m[3], MONTHS.indexOf(m[1]) + 1, +m[2]);
  m = L.match(/\b(\d{1,2})[-\s](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-\s,]+(\d{4})\b/);
  if (m) return validDate(+m[3], MONTHS.indexOf(m[2]) + 1, +m[1]);
  m = L.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    // day first if the first number can't be a month
    return a > 12 ? validDate(+m[3], b, a) : validDate(+m[3], a, b);
  }
  return null;
}

const DATE_HINT = /collect|drawn|specimen|sample|date of service|service date|received/;

export function parseReport(text: string, opts: { units: Units; sex: Sex }): ParseResult {
  const lines = text.normalize("NFKC").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const found = new Map<string, ParsedValue>();
  let date: string | null = null;
  let anyDate: string | null = null;

  lines.forEach((line, i) => {
    const L = cleanNumbers(line.toLowerCase());
    const d = findDate(L);
    if (d) {
      if (!date && DATE_HINT.test(L)) date = d;
      if (!anyDate) anyDate = d;
    }
    const hit = findMarker(L);
    if (!hit || found.has(hit.m.id)) return;
    // text after the name; drop pieces of other names that look like numbers (IGF-1, T4, A1c)
    let rest = L.slice(hit.end).replace(/-1\b|\bt4\b|a1c|\bc\b|\b(?:19|20)\d\d[-/.]\d{1,2}[-/.]\d{1,2}\b/g, " ");
    let nums = numbersIn(rest);
    // value on the next line (common in PDFs and OCR of two-column tables)
    if (!nums.some((n) => !n.range) && i + 1 < lines.length && !findMarker(cleanNumbers(lines[i + 1].toLowerCase()))) {
      rest = rest + " " + cleanNumbers(lines[i + 1].toLowerCase());
      nums = numbersIn(rest);
    }
    const pick = nums.find((n) => !n.range) ?? (nums.length === 1 ? nums[0] : undefined);
    if (!pick) return;
    const m = hit.m;
    const after = rest.slice(pick.at);
    const labelled = findUnit(m, after) ?? findUnit(m, rest);
    let unit: Units;
    let by: UnitSource;
    let check = false;
    if (m.us[1] === 1 && normUnit(m.unit) === normUnit(m.us[0])) {
      unit = opts.units;
      by = "same";
    } else if (labelled) {
      unit = labelled;
      by = "label";
    } else {
      ({ unit, by, check } = inferUnit(m, opts.sex, pick.v, opts.units));
    }
    const si = unit === "us" ? pick.v / m.us[1] : pick.v;
    if (!check) check = Math.abs(zScore(m, rangeFor(m, opts.sex), si)) > 8;
    found.set(m.id, { id: m.id, raw: pick.v, unit, si, by, check, line });
  });

  return { values: [...found.values()], date: date ?? anyDate };
}
