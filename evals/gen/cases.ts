/**
 * Seeded builder for synthetic lab report cases. Pure: no I/O.
 * A case is what's printed on the report (rows, dates, layout) plus the labels
 * the eval scores against. Nothing here comes from a real person or report.
 */
import { BYID } from "../../src/engine/data/markers";
import type { Units } from "../../src/engine/types";

export const DATASET = "v1";
export const SEED = 20261122;
export const LAYOUTS = ["lifelabs", "dynacare", "quest", "labcorp"] as const;
export type Layout = (typeof LAYOUTS)[number];
export const PER_LAYOUT = 12;

// ---------- seeded RNG (mulberry32)
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo: number, hi: number) => lo + next() * (hi - lo),
    int: (lo: number, hi: number) => Math.floor(lo + next() * (hi - lo + 1)),
    pick: <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)],
    chance: (p: number) => next() < p,
    shuffle: <T,>(xs: T[]): T[] => {
      const a = [...xs];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}
export type Rng = ReturnType<typeof rng>;

// ---------- printed names per layout (structure of each lab's naming style, not copied reports)
type Names = Record<string, string>;
const NAMES: Record<Layout, Names> = {
  lifelabs: {
    hematocrit: "Hematocrit", hemoglobin: "Hemoglobin", plt: "Platelets", alt: "ALT", ast: "AST", ggt: "GGT",
    bili: "Bilirubin Total", alp: "Alkaline Phosphatase", ck: "Creatine Kinase", creatinine: "Creatinine",
    cystatin: "Cystatin C", potassium: "Potassium", urea: "Urea", ldl: "LDL Cholesterol", hdl: "HDL Cholesterol",
    tg: "Triglycerides", apob: "Apolipoprotein B", glucose: "Glucose Fasting", a1c: "Hemoglobin A1C", igf1: "IGF-1",
    testo: "Testosterone", lh: "LH", estradiol: "Estradiol", tsh: "TSH", ft4: "Free T4", psa: "PSA Total", ferritin: "Ferritin",
  },
  dynacare: {
    hematocrit: "HCT", hemoglobin: "HGB", plt: "PLATELET COUNT", alt: "ALT (SGPT)", ast: "AST (SGOT)", ggt: "GAMMA GT",
    bili: "TOTAL BILIRUBIN", alp: "ALK. PHOSPHATASE", ck: "CK (TOTAL)", creatinine: "CREATININE", cystatin: "CYSTATIN C",
    potassium: "POTASSIUM", urea: "UREA", ldl: "LDL-C (CALCULATED)", hdl: "HDL-C", tg: "TRIGLYCERIDES", apob: "APO B",
    glucose: "GLUCOSE - FASTING", a1c: "HBA1C", igf1: "IGF-1", testo: "TESTOSTERONE TOTAL", lh: "LUTEINIZING HORMONE",
    estradiol: "ESTRADIOL", tsh: "TSH", ft4: "FREE T4", psa: "PSA", ferritin: "FERRITIN",
  },
  quest: {
    hematocrit: "HEMATOCRIT", hemoglobin: "HEMOGLOBIN", plt: "PLATELET COUNT", alt: "ALT", ast: "AST", ggt: "GGT",
    bili: "BILIRUBIN, TOTAL", alp: "ALKALINE PHOSPHATASE", ck: "CREATINE KINASE, TOTAL", creatinine: "CREATININE",
    cystatin: "CYSTATIN C", potassium: "POTASSIUM", urea: "UREA NITROGEN (BUN)", ldl: "LDL-CHOLESTEROL",
    hdl: "HDL CHOLESTEROL", tg: "TRIGLYCERIDES", apob: "APOLIPOPROTEIN B", glucose: "GLUCOSE", a1c: "HEMOGLOBIN A1c",
    igf1: "IGF I, LC/MS", testo: "TESTOSTERONE, TOTAL, MS", lh: "LH", estradiol: "ESTRADIOL, ULTRASENSITIVE, LC/MS",
    tsh: "TSH", ft4: "T4, FREE", psa: "PSA, TOTAL", ferritin: "FERRITIN",
  },
  labcorp: {
    hematocrit: "Hematocrit", hemoglobin: "Hemoglobin", plt: "Platelets", alt: "ALT (SGPT)", ast: "AST (SGOT)", ggt: "GGT",
    bili: "Bilirubin, Total", alp: "Alkaline Phosphatase", ck: "Creatine Kinase,Total", creatinine: "Creatinine",
    cystatin: "Cystatin C", potassium: "Potassium", urea: "BUN", ldl: "LDL Chol Calc (NIH)", hdl: "HDL Cholesterol",
    tg: "Triglycerides", apob: "Apolipoprotein B", glucose: "Glucose", a1c: "Hemoglobin A1c",
    igf1: "Insulin-Like Growth Factor I", testo: "Testosterone", lh: "LH", estradiol: "Estradiol", tsh: "TSH",
    ft4: "T4,Free(Direct)", psa: "Prostate Specific Ag", ferritin: "Ferritin",
  },
};

/** Unit strings as printed. [SI, US] */
const UNITS: Record<string, [string, string]> = {
  hematocrit: ["L/L", "%"], hemoglobin: ["g/L", "g/dL"], plt: ["x10E9/L", "x10E3/uL"], alt: ["U/L", "U/L"],
  ast: ["U/L", "U/L"], ggt: ["U/L", "U/L"], bili: ["umol/L", "mg/dL"], alp: ["U/L", "U/L"], ck: ["U/L", "U/L"],
  creatinine: ["umol/L", "mg/dL"], cystatin: ["mg/L", "mg/L"], potassium: ["mmol/L", "mmol/L"], urea: ["mmol/L", "mg/dL"],
  ldl: ["mmol/L", "mg/dL"], hdl: ["mmol/L", "mg/dL"], tg: ["mmol/L", "mg/dL"], apob: ["g/L", "mg/dL"],
  glucose: ["mmol/L", "mg/dL"], a1c: ["%", "%"], igf1: ["ug/L", "ng/mL"], testo: ["nmol/L", "ng/dL"], lh: ["IU/L", "mIU/mL"],
  estradiol: ["pmol/L", "pg/mL"], tsh: ["mIU/L", "uIU/mL"], ft4: ["pmol/L", "ng/dL"], psa: ["ug/L", "ng/mL"],
  ferritin: ["ug/L", "ng/mL"],
};
const PLT_UNITS: Record<Layout, [string, string]> = {
  lifelabs: ["x E9/L", "x E9/L"], dynacare: ["x10^9/L", "x10^9/L"], quest: ["Thousand/uL", "Thousand/uL"],
  labcorp: ["x10E3/uL", "x10E3/uL"],
};

/** Decimals as printed: [SI, US]. Defaults to the marker's display decimals. */
const DP: Record<string, [number, number]> = {
  hematocrit: [2, 1], estradiol: [0, 1], lh: [1, 1], ft4: [1, 2], testo: [1, 0], creatinine: [0, 2], tsh: [2, 2],
  plt: [0, 0], hemoglobin: [0, 1], a1c: [1, 1], bili: [0, 1], urea: [1, 0], potassium: [1, 1], cystatin: [2, 2],
};

const SECTIONS: { title: string; ids: string[] }[] = [
  { title: "HEMATOLOGY", ids: ["hematocrit", "hemoglobin", "plt"] },
  { title: "CHEMISTRY", ids: ["glucose", "a1c", "creatinine", "cystatin", "urea", "potassium", "bili", "alt", "ast", "alp", "ggt", "ck"] },
  { title: "LIPIDS", ids: ["tg", "ldl", "hdl", "apob"] },
  { title: "ENDOCRINOLOGY", ids: ["testo", "lh", "estradiol", "tsh", "ft4", "igf1", "psa", "ferritin"] },
];

/** Look-alike tests the parser must skip. `after` places the row next to the marker it resembles. */
export interface LookalikeDef {
  key: string;
  name: Record<Layout, string>;
  after: string | "URINE";
  value: (r: Rng) => string;
  unit: string;
  /** value and unit on US-unit reports, when they differ */
  us?: [(r: Rng) => string, string];
}
const same = (s: string): Record<Layout, string> => ({ lifelabs: s, dynacare: s.toUpperCase(), quest: s.toUpperCase(), labcorp: s });
export const LOOKALIKES: LookalikeDef[] = [
  { key: "non-hdl", name: { lifelabs: "Non HDL Cholesterol", dynacare: "NON-HDL CHOLESTEROL", quest: "NON-HDL CHOLESTEROL", labcorp: "Non-HDL Cholesterol" }, after: "hdl", value: (r) => r.range(2.5, 5.5).toFixed(2), unit: "mmol/L" , us: [(r) => r.int(95, 210).toString(), "mg/dL"] },
  { key: "chol-hdl-ratio", name: { lifelabs: "Cholesterol/HDL Ratio", dynacare: "CHOL/HDL RATIO", quest: "CHOL/HDLC RATIO", labcorp: "T. Chol/HDL Ratio" }, after: "hdl", value: (r) => r.range(2.8, 6.5).toFixed(1), unit: "" },
  { key: "mch", name: same("MCH"), after: "hemoglobin", value: (r) => r.range(27, 33).toFixed(1), unit: "pg" },
  { key: "mchc", name: same("MCHC"), after: "hemoglobin", value: (r) => r.int(320, 360).toString(), unit: "g/L" , us: [(r) => r.range(32, 36).toFixed(1), "g/dL"] },
  { key: "mpv", name: same("MPV"), after: "plt", value: (r) => r.range(8, 12).toFixed(1), unit: "fL" },
  { key: "free-testo", name: { lifelabs: "Testosterone Free (calculated)", dynacare: "FREE TESTOSTERONE", quest: "TESTOSTERONE, FREE", labcorp: "Testosterone, Free" }, after: "testo", value: (r) => r.int(150, 900).toString(), unit: "pmol/L" , us: [(r) => r.range(45, 250).toFixed(1), "pg/mL"] },
  { key: "bioavail-testo", name: { lifelabs: "Testosterone Bioavailable", dynacare: "BIOAVAILABLE TESTOSTERONE", quest: "TESTOSTERONE, BIOAVAILABLE", labcorp: "Testosterone, Bioavailable" }, after: "testo", value: (r) => r.range(3, 18).toFixed(1), unit: "nmol/L" , us: [(r) => r.int(90, 520).toString(), "ng/dL"] },
  { key: "egfr", name: { lifelabs: "eGFR", dynacare: "EGFR", quest: "EGFR", labcorp: "eGFR" }, after: "creatinine", value: (r) => r.int(70, 120).toString(), unit: "mL/min/1.73m2" },
  { key: "direct-bili", name: { lifelabs: "Bilirubin Direct", dynacare: "DIRECT BILIRUBIN", quest: "BILIRUBIN, DIRECT", labcorp: "Bilirubin, Direct" }, after: "bili", value: (r) => r.int(1, 7).toString(), unit: "umol/L" , us: [(r) => r.range(0.1, 0.4).toFixed(1), "mg/dL"] },
  { key: "ck-mb", name: same("CK-MB"), after: "ck", value: (r) => r.range(1, 6).toFixed(1), unit: "ug/L" , us: [(r) => r.range(1, 6).toFixed(1), "ng/mL"] },
  { key: "free-psa", name: { lifelabs: "PSA Free", dynacare: "FREE PSA", quest: "PSA, FREE", labcorp: "Free PSA" }, after: "psa", value: (r) => r.range(0.1, 0.9).toFixed(2), unit: "ug/L" , us: [(r) => r.range(0.1, 0.9).toFixed(2), "ng/mL"] },
  { key: "urine-creatinine", name: { lifelabs: "Creatinine Urine (random)", dynacare: "CREATININE, URINE", quest: "CREATININE, RANDOM URINE", labcorp: "Creatinine, Urine" }, after: "URINE", value: (r) => r.int(4000, 20000).toString(), unit: "umol/L" , us: [(r) => r.int(40, 250).toString(), "mg/dL"] },
  { key: "urine-glucose", name: { lifelabs: "Glucose Urine", dynacare: "GLUCOSE, URINE", quest: "GLUCOSE, URINE", labcorp: "Glucose, Urine" }, after: "URINE", value: (r) => r.range(0.1, 2.8).toFixed(1), unit: "mmol/L" , us: [(r) => r.int(5, 50).toString(), "mg/dL"] },
  { key: "acr", name: { lifelabs: "Albumin/Creatinine Ratio Urine", dynacare: "MICROALBUMIN/CREAT RATIO", quest: "ALBUMIN/CREATININE RATIO, RANDOM URINE", labcorp: "Albumin/Creatinine Ratio" }, after: "URINE", value: (r) => r.range(0.3, 3).toFixed(1), unit: "mg/mmol" , us: [(r) => r.int(3, 30).toString(), "mg/g creat"] },
];

// ---------- case model
export interface Row {
  kind: "marker" | "lookalike";
  /** marker id, or look-alike key */
  key: string;
  name: string;
  /** value as printed, including a leading < or > */
  value: string;
  flag: "" | "H" | "L";
  unit: string;
  /** printed reference range, e.g. "135-175" or "<50" */
  ref: string;
  /** previous result column (labcorp style) */
  prev?: string;
}
export interface Section {
  title: string;
  rows: Row[];
}
export interface Dates {
  collected: string;
  received: string;
  reported: string;
  printed: string;
  dob: string;
  prevDraw: string;
}
export interface Case {
  id: string;
  layout: Layout;
  sex: "m" | "f";
  /** units the lab reports in natively (and what a user would have selected) */
  units: Units;
  dates: Dates;
  /** sections per page */
  pages: Section[][];
  /** draw CBC in two side-by-side columns (dynacare style) */
  twoColCbc: boolean;
  /** some rows print no unit */
  dropUnits: boolean;
}
export interface LabelMarker {
  id: string;
  value: number;
  unit: Units;
  page: number;
}
export interface Label {
  id: string;
  dataset: string;
  layout: Layout;
  sex: "m" | "f";
  units: Units;
  drawDate: string;
  markers: LabelMarker[];
  lookalikes: { key: string; page: number }[];
  /** rendering-specific notes for the runner */
  photoPages: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (s: string, n: number) => iso(new Date(Date.parse(s + "T00:00:00Z") + n * 864e5));

function rangeOf(id: string, sex: "m" | "f"): [number, number] {
  const ri = BYID[id].ri as [number, number] | { m: [number, number]; f: [number, number] };
  return Array.isArray(ri) ? ri : ri[sex];
}

/** SI value: mostly in range, ~30% outside, with lifter-style highs for CK, hematocrit, liver enzymes. */
function sampleSI(r: Rng, id: string, sex: "m" | "f"): number {
  const [lo, hi] = rangeOf(id, sex);
  // shut-down LH on a cycle, below the assay limit
  if (id === "lh" && r.chance(0.3)) return 0.1;
  if (!r.chance(0.3)) return r.range(lo + (hi - lo) * 0.05, hi - (hi - lo) * 0.05);
  const big = ["ck", "alt", "ast", "testo", "estradiol", "igf1"].includes(id);
  if (["lh"].includes(id) || r.chance(0.35)) return Math.max(lo * r.range(0.3, 0.92), lo * 0.05);
  return hi * r.range(1.06, big ? 4 : 1.4);
}

const fmtNum = (v: number, dp: number) => v.toFixed(dp);

function markerRow(r: Rng, c: { layout: Layout; sex: "m" | "f" }, id: string, sys: Units): { row: Row; value: number } {
  const m = BYID[id];
  const factor = sys === "us" ? m.us[1] : 1;
  const dp = (DP[id] ?? [m.dp[0], m.dp[1]])[sys === "si" ? 0 : 1];
  const si = sampleSI(r, id, c.sex);
  let printed = parseFloat(fmtNum(si * factor, dp));
  if (printed === 0) printed = parseFloat(fmtNum(Math.pow(10, -dp), dp));
  const [lo, hi] = rangeOf(id, c.sex).map((x) => parseFloat(fmtNum(x * factor, dp)));
  let value = fmtNum(printed, dp);
  // suppressed LH below the assay limit is printed as "<0.2" (and read as 0.2)
  if (id === "lh" && printed < 0.3) {
    printed = 0.2;
    value = "<0.2";
  }
  const flag: Row["flag"] = printed > hi ? "H" : printed < lo ? "L" : "";
  const oneSided = ["ldl", "tg", "apob", "alt", "ggt", "psa"].includes(id) && r.chance(0.6);
  const ref = oneSided ? `<${fmtNum(hi, dp)}` : `${fmtNum(lo, dp)}-${fmtNum(hi, dp)}`;
  const unit = id === "plt" ? PLT_UNITS[c.layout][sys === "si" ? 0 : 1] : UNITS[id][sys === "si" ? 0 : 1];
  return { row: { kind: "marker", key: id, name: NAMES[c.layout][id], value, flag, unit, ref }, value: printed };
}

function laRow(r: Rng, la: LookalikeDef, layout: Layout, units: Units): Row {
  const [value, unit] = units === "us" && la.us ? [la.us[0](r), la.us[1]] : [la.value(r), la.unit];
  return { kind: "lookalike", key: la.key, name: la.name[layout], value, flag: "", unit, ref: "" };
}

function dob(r: Rng): string {
  // some patients born before 1990 (parser ignores those), many after
  return `${r.int(1978, 2003)}-${pad(r.int(1, 12))}-${pad(r.int(1, 28))}`;
}

export function buildCase(layout: Layout, n: number): { c: Case; label: Label } {
  const r = rng(SEED + LAYOUTS.indexOf(layout) * 1000 + n);
  const sex: "m" | "f" = r.chance(0.75) ? "m" : "f";
  const units: Units = layout === "quest" || layout === "labcorp" ? "us" : "si";
  const collected = `2026-${pad(r.int(1, 10))}-${pad(r.int(1, 28))}`;
  const dates: Dates = {
    collected,
    received: addDays(collected, r.int(0, 1)),
    reported: addDays(collected, r.int(1, 3)),
    printed: addDays(collected, r.int(3, 30)),
    dob: dob(r),
    prevDraw: addDays(collected, -r.int(60, 200)),
  };

  // markers: 8-20, PSA only for men
  const pool = Object.keys(NAMES[layout]).filter((id) => sex === "m" || id !== "psa");
  const k = r.int(8, 20);
  const chosen = new Set(r.shuffle(pool).slice(0, k));
  // a quarter of cases mix in 1-3 markers in the other unit system
  const flipped = new Set<string>();
  if (r.chance(0.25)) {
    const conv = [...chosen].filter((id) => BYID[id].us[1] !== 1);
    for (const id of r.shuffle(conv).slice(0, r.int(1, 3))) flipped.add(id);
  }
  // 2-6 look-alikes
  const las = r.shuffle(LOOKALIKES).slice(0, r.int(2, 6));
  const laKeys = new Set(las.map((l) => l.key));

  const sections: Section[] = [];
  const labelMarkers: Omit<LabelMarker, "page">[] = [];
  for (const s of SECTIONS) {
    const rows: Row[] = [];
    for (const id of s.ids) {
      if (chosen.has(id)) {
        const sys: Units = flipped.has(id) ? (units === "si" ? "us" : "si") : units;
        const { row, value } = markerRow(r, { layout, sex }, id, sys);
        if (layout === "labcorp") row.prev = r.chance(0.6) ? fmtNum(parseFloat(row.value.replace(/[<>]/, "")) * r.range(0.85, 1.15), (row.value.split(".")[1] ?? "").length) : "";
        rows.push(row);
        labelMarkers.push({ id, value, unit: sys });
      }
      for (const la of las.filter((l) => l.after === id)) {
        rows.push(laRow(r, la, layout, units));
      }
    }
    if (rows.length) sections.push({ title: s.title, rows });
  }
  const urine = las.filter((l) => l.after === "URINE");
  if (urine.length)
    sections.push({
      title: "URINALYSIS",
      rows: urine.map((la) => laRow(r, la, layout, units)),
    });
  // look-alikes placed after a marker that wasn't chosen are dropped from the page; keep labels truthful
  const printedLa = new Set(sections.flatMap((s) => s.rows.filter((x) => x.kind === "lookalike").map((x) => x.key)));
  for (const k of laKeys) if (!printedLa.has(k)) laKeys.delete(k);

  // more than ~22 rows → two pages, split between sections
  const totalRows = sections.reduce((a, s) => a + s.rows.length + 1, 0);
  let pages: Section[][] = [sections];
  if (totalRows > 22 && sections.length > 1) {
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < sections.length; i++) {
      acc += sections[i].rows.length + 1;
      if (acc > totalRows / 2) {
        cut = Math.max(1, i);
        break;
      }
    }
    pages = [sections.slice(0, cut), sections.slice(cut)];
  }
  const pageOf = (kind: Row["kind"], key: string) => pages.findIndex((p) => p.some((s) => s.rows.some((x) => x.kind === kind && x.key === key))) + 1;

  const c: Case = {
    id: `${layout}-${pad(n)}`,
    layout,
    sex,
    units,
    dates,
    pages,
    twoColCbc: layout === "dynacare" && r.chance(0.5),
    dropUnits: layout === "lifelabs" && r.chance(0.4),
  };
  // lifelabs-style reports sometimes leave the unit cell empty
  if (c.dropUnits) for (const p of pages) for (const s of p) for (const row of s.rows) if (row.kind === "marker" && r.chance(0.3)) row.unit = "";

  const label: Label = {
    id: c.id,
    dataset: DATASET,
    layout,
    sex,
    units,
    drawDate: collected,
    markers: labelMarkers.map((m) => ({ ...m, page: pageOf("marker", m.id) })),
    lookalikes: [...printedLa].map((key) => ({ key, page: pageOf("lookalike", key) })),
    photoPages: 1,
  };
  return { c, label };
}

export function allCases() {
  return LAYOUTS.flatMap((l) => Array.from({ length: PER_LAYOUT }, (_, i) => buildCase(l, i + 1)));
}
