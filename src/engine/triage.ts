import { M } from "./data/markers";
import { RED } from "./data/redflags";
import type { Ctx } from "./ctx";
import type { Compound, Dir, Effect, Marker, Opt, RedFlag, State } from "./types";

export type Category = "risk" | "explained" | "unexplained";

export interface Cause {
  c: Compound;
  f: Effect;
}

export interface Flag {
  m: Marker;
  /** SI value */
  x: number;
  d: Dir;
  /** compounds in the active stack that push this marker the same way */
  cs: Cause[];
  cat: Category;
  red: RedFlag[];
  /** compounds that would explain it, but the cycle phase rules them out */
  gone: Compound[];
}

export const CAT: Record<Category | "red", { n: string; c: string; d: string }> = {
  red: { n: "Red flags", c: "var(--danger)", d: "Act on these whatever the cause" },
  risk: { n: "Real risks", c: "var(--risk)", d: "Explained by your stack, but actually harmful" },
  unexplained: { n: "Unexplained", c: "var(--warn)", d: "Nothing in your stack does this" },
  explained: { n: "Explained", c: "var(--calm)", d: "Lab artifacts or expected effects" },
};

export const KTAG: Record<Effect["k"], [string, string]> = {
  risk: ["Real risk", "var(--risk)"],
  expected: ["Expected", "var(--calm)"],
  artifact: ["Artifact", "var(--ok)"],
};

function optFor(m: Marker, sex: State["sex"]): Opt | null {
  if (!m.opt) return null;
  return "m" in m.opt ? m.opt[sex] : m.opt;
}

/**
 * Direction a value is off in, or null if fine. Outside the typical range
 * counts, and so does crossing a guideline limit (lipids).
 */
export function offDir(ctx: Ctx, m: Marker, x: number | null | undefined): Dir | null {
  if (x == null) return null;
  const [lo, hi] = ctx.ri(m);
  if (x > hi) return "up";
  if (x < lo) return "down";
  const O = optFor(m, ctx.s.sex);
  if (O) {
    if (O.l[1] != null && x > O.l[1]) return "up";
    if (O.l[0] != null && x < O.l[0]) return "down";
  }
  return null;
}

export function causesIn(list: Compound[], m: Marker, d: Dir): Cause[] {
  const out: Cause[] = [];
  list.forEach((c) => c.fx.forEach((f) => f.m === m.id && f.d === d && out.push({ c, f })));
  return out;
}

export const causes = (ctx: Ctx, m: Marker, d: Dir) => causesIn(ctx.active, m, d);

export const categoryOf = (cs: Cause[]): Category =>
  cs.some((z) => z.f.k === "risk") ? "risk" : cs.length ? "explained" : "unexplained";

export function redFlags(ctx: Ctx, m: Marker, x: number): RedFlag[] {
  return RED.filter((r) => r.m === m.id && r.test(x, ctx.ri(m)));
}

/** Every flagged result with its likely causes, in marker order. */
export function triage(ctx: Ctx): Flag[] {
  const res: Flag[] = [];
  for (const m of M) {
    const x = ctx.v[m.id];
    if (x == null) continue;
    const d = offDir(ctx, m, x);
    const red = redFlags(ctx, m, x);
    if (!d && !red.length) continue;
    const cs = d ? causes(ctx, m, d) : [];
    const gone =
      d && !cs.length ? causesIn(ctx.all.filter((c) => !ctx.cycActive(c)), m, d).map((z) => z.c) : [];
    res.push({ m, x, d: d || "up", cs, cat: categoryOf(cs), red, gone });
  }
  return res;
}

export interface Buckets {
  act: Flag[];
  fix: Flag[];
  exp: Flag[];
  /** results entered that aren't flagged */
  fine: number;
  /** results entered */
  n: number;
}

/** Split into act now / fix or ask about / expected, the three groups on the triage page. */
export function buckets(ctx: Ctx, T = triage(ctx)): Buckets {
  const n = M.filter((m) => ctx.v[m.id] != null).length;
  return {
    act: T.filter((t) => t.red.length),
    fix: T.filter((t) => !t.red.length && t.cat !== "explained").sort(
      (a, b) => (a.cat === "risk" ? 0 : 1) - (b.cat === "risk" ? 0 : 1),
    ),
    exp: T.filter((t) => !t.red.length && t.cat === "explained"),
    fine: n - T.length,
    n,
  };
}

/** Status label for a single marker row on the Bloodwork tab */
export function rowStatus(ctx: Ctx, m: Marker): { label: string; c: string } | null {
  const x = ctx.v[m.id];
  if (x == null) return null;
  const d = offDir(ctx, m, x);
  if (!d) return { label: "In range", c: "var(--ok)" };
  const cat = categoryOf(causes(ctx, m, d));
  return { label: (d === "up" ? "High" : "Low") + " · " + CAT[cat].n.replace(/s$/, ""), c: CAT[cat].c };
}

/** Markers the stack affects that haven't been entered, with which compounds affect each. */
export function untested(ctx: Ctx): { id: string; by: string[] }[] {
  const need = new Map<string, Set<string>>();
  ctx.all.forEach((c) =>
    c.fx.forEach((f) => {
      if (ctx.v[f.m] != null) return;
      if (!need.has(f.m)) need.set(f.m, new Set());
      need.get(f.m)!.add(c.name.split(" (")[0]);
    }),
  );
  return [...need].map(([id, s]) => ({ id, by: [...s] }));
}

/** Pre-draw checklist for this stack. Items may contain [Pn] citations. */
export function checklist(ctx: Ctx): string[] {
  const cls = new Set(ctx.s.stack.map((id) => ctx.all.find((c) => c.id === id)?.cls).filter(Boolean));
  const L = ["Morning draw, fasted 8+ hours, well hydrated."];
  L.push("No heavy lifting for 7 days before if you want clean liver and CK numbers. [P12]");
  if (ctx.has("creatine")) L.push("Keep taking creatine, but tell the doctor, or ask for cystatin C alongside creatinine. [P11] [P13]");
  if (cls.has("trt") || cls.has("inj")) L.push("Draw at the same point between injections every time, so results compare.");
  if (cls.has("inj") || cls.has("oral") || cls.has("sarm"))
    L.push("Ask for hematocrit, lipids with ApoB, a liver panel with GGT, and LH. [P2] [P22]");
  if (cls.has("gh")) L.push("Add IGF-1, fasting glucose and A1c. [P8]");
  L.push("Tell the doctor exactly what you take.");
  return L;
}
