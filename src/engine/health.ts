import { BYC } from "./data/compounds";
import { ER, GAPS, GRADE, HEART_FX, SUP, SYS, SYS_OF, type Grade } from "./data/health";
import { BYID } from "./data/markers";
import type { Ctx } from "./ctx";
import { triage, CAT, type Flag } from "./triage";
import { fmt, unitLabel } from "./units";
import type { Compound, Effect } from "./types";

// ---------- cycle timeline
export const timelineIndex = (ctx: Ctx) =>
  ctx.s.cyc.ph === "pre" ? 0 : ctx.s.cyc.ph === "on" ? 1 : ctx.lapsed ? 3 : 2;

// ---------- is your gear real? Bloodwork shows androgen exposure, not what's in the vial.
export interface Signal {
  ok: boolean;
  t: string;
  d: string;
}

export function gearSignals(ctx: Ctx): Signal[] | null {
  const st = ctx.s.stack;
  const V = ctx.v;
  const u = ctx.s.units;
  const andro = st.some((id) => ["inj", "oral", "trt"].includes(BYC[id]?.cls));
  const nonTestInj = st.some((id) => BYC[id]?.cls === "inj" && id !== "testc");
  if (!andro) return null;
  const sig: Signal[] = [];
  const lh = V.lh;
  if (lh != null) {
    const lo = ctx.ri(BYID.lh)[0];
    sig.push(
      lh < lo
        ? { ok: true, t: `LH is suppressed (${fmt(BYID.lh, u, lh)} IU/L)`, d: "That's what real androgens do; LH was near zero during cycles in nearly everyone. [P34]" }
        : { ok: false, t: `LH isn't suppressed (${fmt(BYID.lh, u, lh)} IU/L)`, d: "On real androgens LH is usually near zero. A normal LH means your body isn't seeing much androgen. [P34]" },
    );
  }
  const x = V.testo;
  if (x != null) {
    const T = BYID.testo;
    const [lo, hi] = ctx.ri(T);
    const tv = fmt(T, u, x) + " " + unitLabel(T, u);
    if (st.includes("testc"))
      sig.push(
        x > hi
          ? { ok: true, t: `Testosterone is above range (${tv})`, d: "Fits a cycle dose of testosterone." }
          : { ok: false, t: `Testosterone isn't above range (${tv})`, d: "A cycle dose of testosterone usually pushes it above range, so this can point to a weak or fake product, or a draw late in the injection interval." },
      );
    else if (st.includes("trt"))
      sig.push(
        x >= lo
          ? { ok: true, t: `Testosterone is in or above range (${tv})`, d: "Fits a replacement dose." }
          : { ok: false, t: `Testosterone is below range on TRT (${tv})`, d: "Check the timing of the draw against your injection, and tell your prescriber." },
      );
    else if (nonTestInj)
      sig.push(
        x < lo
          ? { ok: true, t: `Testosterone is low (${tv})`, d: "Expected when you're on a non-testosterone steroid: your own production is shut down." }
          : { ok: false, t: `Testosterone is still in range (${tv})`, d: "A real non-testosterone steroid usually shuts your own testosterone down. If it's normal, the vial may not contain what it says, or may contain testosterone instead." },
      );
  }
  return sig;
}

export function gearVerdict(sig: Signal[]): { c: string; t: string; s: string } {
  const n = sig.length;
  const bad = sig.filter((g) => !g.ok).length;
  if (!n) return { c: "var(--muted)", t: "Can't tell yet", s: "Enter LH and total testosterone from a draw on cycle." };
  if (!bad) return { c: "var(--ok)", t: "Looks real", s: "Your labs match what this stack should do." };
  if (bad === n) return { c: "var(--danger)", t: "Doesn't look real", s: "Your labs don't match what this stack should do." };
  return { c: "var(--warn)", t: "Mixed signals", s: "Some of your labs don't match this stack." };
}

/** Gear check only makes sense on androgens, and on cycle if it's a cycle stack */
export const showGear = (ctx: Ctx) => gearSignals(ctx) != null && !(ctx.s.cyc.ph !== "on" && ctx.onCycleStack);

// ---------- heart
export interface BpCat {
  n: string;
  c: string;
  r: number;
}

/** ACC/AHA 2017 categories */
export function bpCat(sy: number, di: number): BpCat {
  if (sy > 180 || di > 120) return { n: "Crisis range", c: "var(--danger)", r: 4 };
  if (sy >= 140 || di >= 90) return { n: "Stage 2 high", c: "var(--danger)", r: 3 };
  if (sy >= 130 || di >= 80) return { n: "Stage 1 high", c: "var(--risk)", r: 2 };
  if (sy >= 120) return { n: "Elevated", c: "var(--warn)", r: 1 };
  return { n: "Normal", c: "var(--ok)", r: 0 };
}

export interface Tile {
  l: string;
  v: string;
  s: string;
  c: string;
  /** severity, -1 = unknown */
  r: number;
  p: string;
}

export function heartTiles(ctx: Ctx): Tile[] {
  const T: Tile[] = [];
  const sy = ctx.me("sys");
  const di = ctx.me("dia");
  const hr = ctx.me("hr");
  const hct = ctx.v.hematocrit;
  if (sy && di) {
    const b = bpCat(sy, di);
    T.push({
      l: "Blood pressure", v: sy + "/" + di, s: b.n, c: b.c, r: b.r,
      p: b.r >= 4 ? "Recheck after 5 minutes sitting. With chest pain, shortness of breath, vision changes or weakness, go to the ER." : b.r >= 2 ? "Confirm with readings on 2+ different days. [P33]" : "Under 130/80 is the guideline target. [P33]",
    });
  } else T.push({ l: "Blood pressure", v: "–", s: "Not entered", c: "var(--muted)", r: -1, p: "Androgens raised blood pressure during cycles. [P2]" });
  if (hr) {
    const r = hr > 100 ? 3 : hr >= 85 ? 1 : 0;
    T.push({
      l: "Resting heart rate", v: hr + " bpm", s: hr > 100 ? "Fast" : hr >= 85 ? "Upper normal" : "Normal",
      c: r >= 3 ? "var(--danger)" : r ? "var(--warn)" : "var(--ok)", r,
      p: hr > 100 ? "Over 100 at rest needs a doctor, especially on thyroid hormone or stimulants." : hr < 60 ? "Low resting rates are common in trained people." : "Measure lying down, first thing in the morning.",
    });
  } else T.push({ l: "Resting heart rate", v: "–", s: "Not entered", c: "var(--muted)", r: -1, p: "Measure lying down, first thing in the morning." });
  const H = BYID.hematocrit;
  if (hct != null) {
    const r = hct >= 0.54 ? 3 : hct > ctx.ri(H)[1] ? 2 : 0;
    T.push({
      l: "Hematocrit", v: fmt(H, ctx.s.units, hct) + " " + unitLabel(H, ctx.s.units),
      s: r >= 3 ? "At the hold point" : r ? "High" : "In range",
      c: r >= 3 ? "var(--danger)" : r ? "var(--risk)" : "var(--ok)", r,
      p: "Thicker blood makes the heart work harder; guidelines act at 54%. [P3]",
    });
  } else T.push({ l: "Hematocrit", v: "–", s: "Not tested", c: "var(--muted)", r: -1, p: "Thicker blood makes the heart work harder; guidelines act at 54%. [P3]" });
  const andro = ctx.cls("inj") || ctx.cls("oral");
  const echo = !!ctx.s.hab.echo;
  T.push({
    l: "Heart scan", v: echo ? "Done" : "Never", s: echo ? "Covered" : andro ? "Worth getting" : "Optional",
    c: echo ? "var(--ok)" : andro ? "var(--risk)" : "var(--muted)", r: echo ? 0 : andro ? 2 : -1,
    p: "Long-term users had weaker pumping and more coronary plaque. [P24]",
  });
  return T;
}

export function heartSummary(T: Tile[]): { n: string; c: string; d: string } {
  const known = T.filter((t) => t.r >= 0);
  const top = Math.max(-1, ...T.map((t) => t.r));
  if (!known.length) return { n: "Not enough data", c: "var(--muted)", d: "Add your blood pressure and heart rate above." };
  if (top >= 3) return { n: "High strain", c: "var(--danger)", d: "At least one number needs a doctor soon." };
  if (top >= 2) return { n: "Moderate strain", c: "var(--risk)", d: "Worth fixing before your next cycle." };
  if (top >= 1) return { n: "Some strain", c: "var(--warn)", d: "Keep an eye on it." };
  return { n: "Low strain", c: "var(--ok)", d: "Nothing pushing your heart hard right now." };
}

// ---------- kidneys: CKD-EPI 2021, race-free (Inker 2021). Creatinine is stored in µmol/L.
export function egfrFrom(sex: "m" | "f", age: number, creatUmol: number, cystatin?: number | null) {
  const F = sex === "f";
  const sc = creatUmol / 88.4;
  const k = F ? 0.7 : 0.9;
  const ecr =
    142 * Math.pow(Math.min(sc / k, 1), F ? -0.241 : -0.302) * Math.pow(Math.max(sc / k, 1), -1.2) * Math.pow(0.9938, age) * (F ? 1.012 : 1);
  const ecc =
    cystatin == null
      ? null
      : 135 *
        Math.pow(Math.min(sc / k, 1), F ? -0.219 : -0.144) *
        Math.pow(Math.max(sc / k, 1), -0.544) *
        Math.pow(Math.min(cystatin / 0.8, 1), -0.323) *
        Math.pow(Math.max(cystatin / 0.8, 1), -0.778) *
        Math.pow(0.9961, age) *
        (F ? 0.963 : 1);
  return { ecr, ecc };
}

export function egfr(ctx: Ctx) {
  const age = ctx.me("age");
  const cr = ctx.v.creatinine;
  if (!age || cr == null) return null;
  return egfrFrom(ctx.s.sex, age, cr, ctx.v.cystatin);
}

/** KDIGO G stages */
export function gStage(e: number): { g: string; n: string; c: string } {
  if (e >= 90) return { g: "G1", n: "Normal", c: "var(--ok)" };
  if (e >= 60) return { g: "G2", n: "Mildly lower", c: "var(--ok)" };
  if (e >= 45) return { g: "G3a", n: "Moderately lower", c: "var(--risk)" };
  if (e >= 30) return { g: "G3b", n: "Moderately to severely lower", c: "var(--danger)" };
  if (e >= 15) return { g: "G4", n: "Severely lower", c: "var(--danger)" };
  return { g: "G5", n: "Kidney failure range", c: "var(--danger)" };
}

export function kidneyNote(ctx: Ctx, E: { ecr: number; ecc: number | null }): string {
  const muscle = ctx.has("creatine") || ctx.s.train || ctx.cls("inj") || ctx.cls("oral") || ctx.cls("trt");
  if (E.ecc != null && E.ecc - E.ecr >= 10)
    return `Your creatinine-only number reads ${Math.round(E.ecc - E.ecr)} points lower. That's the usual pattern when muscle mass or creatine inflate creatinine, so trust the combined number. [P13] [P31]`;
  if (E.ecc != null) return "Both numbers agree, so creatinine isn't misleading you here. The combined equation is the more accurate one. [P31]";
  return (muscle ? "Muscle and creatine raise creatinine, which makes this number read low. " : "") + "Add cystatin C for the more accurate combined estimate. [P13] [P31]";
}

// ---------- monitoring gaps, combos, supplements, ER
export const gapList = (ctx: Ctx) =>
  GAPS.filter((g) => g.when(ctx)).map((g) => ({ t: g.t, why: g.why, done: g.ok(ctx) }));

export function comboList(ctx: Ctx): { c: string; t: string; d: string }[] {
  const C: { c: string; t: string; d: string }[] = [];
  const orals = ctx.nCls("oral");
  const injs = ctx.nCls("inj");
  if (orals >= 2) C.push({ c: "var(--danger)", t: "Two orals at once", d: "Both stress the liver the same way, so the risk stacks. [P4]" });
  if (orals && ctx.cls("sarm")) C.push({ c: "var(--danger)", t: "Oral steroid + SARM", d: "Two separate liver stressors. Both are linked to cholestatic liver injury. [P4] [P6]" });
  if ((orals || ctx.cls("sarm")) && ctx.s.hab.alcohol) C.push({ c: "var(--risk)", t: "Liver stressor + regular drinking", d: "Alcohol adds more load on a liver already working against an oral or SARM. [P14]" });
  if (orals && (injs || ctx.cls("trt"))) C.push({ c: "var(--risk)", t: "Injectable + oral", d: "Orals hit lipids harder than injectables alone, so HDL takes a double hit. [P2]" });
  if (injs >= 2) C.push({ c: "var(--risk)", t: "Multiple injectables", d: "More androgen exposure means more hematocrit and lipid strain, and heart plaque grew with years of use. [P2] [P24]" });
  if (ctx.nCls("gh") >= 2) C.push({ c: "var(--risk)", t: "Two GH-pathway compounds", d: "Their glucose effects can add up. [P8] [P1]" });
  if (ctx.cls("glp")) C.push({ c: "var(--warn)", t: "GLP-1 drug", d: "About 10% of lean mass was lost on semaglutide in STEP 1. Keep lifting and eating protein. [P28]" });
  if (ctx.cls("thy")) C.push({ c: "var(--warn)", t: "Thyroid hormone", d: "Too much strains the heart. Watch resting heart rate and get TSH and free T4 checked." });
  return C;
}

/** Supplements and habits by grade, with the ones targeting a flagged marker first */
export function supportList(ctx: Ctx, T: Flag[] = triage(ctx)) {
  const flagged = new Set(T.map((t) => t.m.id + ":" + t.d));
  return (Object.keys(GRADE) as Grade[]).map((g) => ({
    g,
    items: SUP.filter((x) => x.g === g)
      .map((x) => ({ ...x, rel: x.helps.filter(([m, d]) => flagged.has(m + ":" + d)).map(([m]) => m) }))
      .sort((a, b) => b.rel.length - a.rel.length),
  }));
}

export function erList(ctx: Ctx) {
  const anything = ctx.s.stack.length > 0 || ctx.s.train;
  return ER.map((e) => ({ t: e.t, d: e.d, yours: anything ? e.rel(ctx) : false })).sort(
    (a, b) => Number(b.yours) - Number(a.yours),
  );
}

// ---------- organ strain: what the stack is known to do + what your labs confirm
const comb = (a: number, b: number) => 100 * (1 - (1 - a / 100) * (1 - b / 100));

export interface StrainPred {
  c: Compound;
  f: Pick<Effect, "d" | "k" | "why"> & { m: string | null };
  w: number;
}
export interface StrainConf {
  t?: Flag;
  v?: string;
  s?: string;
  c?: string;
  w: number;
}
export interface Strain {
  id: string;
  n: string;
  sn: string;
  m: string[];
  pred: number;
  conf: number;
  tot: number;
  lv: { n: string; c: string };
  P: StrainPred[];
  C: StrainConf[];
  labs: number;
  touched: boolean;
}

export function strain(ctx: Ctx, T: Flag[] = triage(ctx)): Strain[] {
  const TB = Object.fromEntries(T.map((t) => [t.m.id, t]));
  const comps = ctx.active.filter((c) => c.id !== "training");
  return SYS.map((sy) => {
    let pred = 0;
    let conf = 0;
    const P: StrainPred[] = [];
    const C: StrainConf[] = [];
    const seen = new Set<string>();
    comps.forEach((c) => {
      c.fx.forEach((f) => {
        if (SYS_OF[f.m] !== sy.id || f.k === "artifact") return;
        const key = c.id + f.m;
        if (seen.has(key)) return;
        seen.add(key);
        const w = f.k === "risk" ? 16 : 5;
        pred = comb(pred, w);
        P.push({ c, f, w });
      });
      const hf = c.heart || HEART_FX[c.cls];
      if (sy.id === "heart" && hf) {
        pred = comb(pred, hf.w);
        P.push({ c, f: { m: null, d: "up", k: "risk", why: hf.why }, w: hf.w });
      }
    });
    pred = Math.min(pred, 60);
    let labs = 0;
    sy.m.forEach((id) => {
      if (ctx.v[id] == null) return;
      labs++;
      const t = TB[id];
      if (!t) return;
      const w = t.red.length ? 50 : t.cat === "risk" ? 26 : t.cat === "unexplained" ? 22 : t.cs.every((z) => z.f.k === "artifact") ? 2 : 6;
      conf = comb(conf, w);
      C.push({ t, w });
    });
    if (sy.id === "heart") {
      const sb = ctx.me("sys");
      const db = ctx.me("dia");
      const hr = ctx.me("hr");
      if (sb && db) {
        labs++;
        const b = bpCat(sb, db);
        const w = [0, 10, 25, 45, 70][b.r];
        if (w) {
          conf = comb(conf, w);
          C.push({ v: `Blood pressure ${sb}/${db}`, s: b.n, w, c: b.c });
        }
      }
      if (hr) {
        labs++;
        if (hr > 100) {
          conf = comb(conf, 30);
          C.push({ v: `Resting heart rate ${hr} bpm`, s: "Fast", w: 30, c: "var(--danger)" });
        }
      }
    }
    // once you have results for a system, what the stack *might* do counts less
    const ps = labs ? pred * 0.4 : pred;
    const cf = Math.round(conf);
    const tot = Math.round(comb(conf, ps));
    const lv =
      tot === 0 ? { n: "Not flagged", c: "var(--muted)" }
      : tot < 20 ? { n: "Low", c: "#9a978f" }
      : tot < 45 ? { n: "Moderate", c: "#c08a1e" }
      : tot < 70 ? { n: "High", c: "#d0602a" }
      : { n: "Severe", c: "#c42b2b" };
    return { ...sy, pred: ps, conf: Math.min(cf, tot), tot, lv, P, C, labs, touched: P.length > 0 || C.length > 0 };
  }).sort((a, b) => b.tot - a.tot || Number(b.touched) - Number(a.touched));
}

/** Which organ systems a compound touches, for the load map hover */
export function compSys(c: Compound): Set<string> {
  const set = new Set<string>();
  c.fx.forEach((f) => SYS_OF[f.m] && set.add(SYS_OF[f.m]));
  if (c.heart || HEART_FX[c.cls]) set.add("heart");
  return set;
}

/** Status word for a flag, shared by strain rows and the doctor sheet */
export const flagStatus = (t: Flag) =>
  t.red.length ? "Act now" : t.cat === "risk" ? "Real risk" : t.cat === "unexplained" ? "Unexplained" : "Expected";
export const flagColor = (t: Flag) => (t.red.length ? "var(--danger)" : CAT[t.cat].c);
