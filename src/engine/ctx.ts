import { BYC, TRAIN } from "./data/compounds";
import type { ClassId, Compound, MeKey, Range, State } from "./types";
import type { Marker } from "./types";

/** Steroids and SARMs can't explain a draw taken before starting, or 12+ weeks after stopping. */
export const CYCLE_CLASSES = new Set<ClassId>(["inj", "oral", "sarm"]);

/**
 * A read-only view of the user's situation with the helpers every rule needs.
 * Build one per render with makeCtx(state) and pass it to engine functions.
 */
export interface Ctx {
  s: State;
  /** current results, SI */
  v: Record<string, number | undefined>;
  has: (id: string) => boolean;
  cls: (c: ClassId) => boolean;
  nCls: (c: ClassId) => number;
  /** numeric vital (age, BP, HR), or null if blank or invalid */
  me: (k: MeKey) => number | null;
  ri: (m: Marker) => Range;
  onCycleStack: boolean;
  /** weeks in, or weeks since stopping; null if blank */
  wk: number | null;
  /** off cycle for 12+ weeks */
  lapsed: boolean;
  /** compounds in the stack, plus hard training if ticked */
  all: Compound[];
  /** the subset that can explain this draw, given the cycle phase */
  active: Compound[];
  cycActive: (c: Compound) => boolean;
}

export function rangeFor(m: Marker, sex: State["sex"]): Range {
  return Array.isArray(m.ri) ? m.ri : m.ri[sex];
}

export function makeCtx(s: State): Ctx {
  const comps = s.stack.map((id) => BYC[id]).filter(Boolean);
  const onCycleStack = comps.some((c) => CYCLE_CLASSES.has(c.cls));
  const n = parseInt(s.cyc.wk, 10);
  const wk = Number.isFinite(n) && n >= 0 ? n : null;
  const lapsed = s.cyc.ph === "off" && wk != null && wk >= 12;
  const cycActive = (c: Compound) => {
    if (!CYCLE_CLASSES.has(c.cls) || !onCycleStack) return true;
    return s.cyc.ph === "on" || (s.cyc.ph === "off" && !lapsed);
  };
  const all = s.train ? [...comps, TRAIN] : comps;
  return {
    s,
    v: s.vals,
    has: (id) => s.stack.includes(id),
    cls: (c) => comps.some((x) => x.cls === c),
    nCls: (c) => comps.filter((x) => x.cls === c).length,
    me: (k) => {
      const x = parseFloat(s.me[k] ?? "");
      return Number.isFinite(x) && x > 0 ? x : null;
    },
    ri: (m) => rangeFor(m, s.sex),
    onCycleStack,
    wk,
    lapsed,
    all,
    active: all.filter(cycActive),
    cycActive,
  };
}

/** "Testosterone (TRT dose)" → "Testosterone" */
export const shortName = (c: Compound) => c.name.split(" (")[0];
