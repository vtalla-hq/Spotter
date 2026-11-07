import { BYC, CLS } from "./data/compounds";
import type { Ctx } from "./ctx";
import { bpCat, egfr, gapList } from "./health";
import { triage, type Flag } from "./triage";
import { fmt, unitLabel } from "./units";

export interface DoctorSheet {
  sex: string;
  age: number | null;
  stack: { name: string; cls: string }[];
  phase: string | null;
  trained: boolean;
  bp: string;
  hr: string;
  egfr: string;
  rows: { name: string; result: string; typical: string; status: string; from: string }[];
  tests: string[];
  questions: string[];
}

const PHASE_ORDER = (t: Flag) => (t.red.length ? 0 : t.cat === "risk" ? 1 : t.cat === "unexplained" ? 2 : 3);

/** Everything for the printable one-page summary. Lists what you take, not how much. */
export function doctorSheet(ctx: Ctx, T: Flag[] = triage(ctx)): DoctorSheet {
  const s = ctx.s;
  const u = s.units;
  const E = egfr(ctx);
  const sy = ctx.me("sys");
  const di = ctx.me("dia");
  const hr = ctx.me("hr");
  const wk = ctx.wk;
  const phase = ctx.onCycleStack
    ? { pre: "Before starting (baseline draw)", on: "On cycle" + (wk != null ? ", week " + wk : ""), off: "Off cycle" + (wk != null ? ", " + wk + " weeks since stopping" : "") }[s.cyc.ph]
    : null;
  const status = (t: Flag) =>
    t.red.length ? "Act now" : t.cat === "risk" ? "Real risk" : t.cat === "unexplained" ? (t.gone.length ? "Not explained by current phase" : "Unexplained") : "Expected";
  const rows = T.slice()
    .sort((a, b) => PHASE_ORDER(a) - PHASE_ORDER(b))
    .map((t) => {
      const [lo, hi] = ctx.ri(t.m);
      return {
        name: t.m.name,
        result: fmt(t.m, u, t.x) + " " + unitLabel(t.m, u),
        typical: fmt(t.m, u, lo) + "–" + fmt(t.m, u, hi),
        status: status(t),
        from: t.cs.length ? [...new Set(t.cs.map((z) => z.c.name.split(" (")[0]))].join(", ") : "–",
      };
    });
  const tests = gapList(ctx)
    .filter((g) => !g.done && !/Blood pressure|cardio|Protein|Heart scan/.test(g.t))
    .map((g) => g.t.replace(" tested", "").replace(" (optional)", ""));
  const Q: string[] = [];
  T.filter((t) => t.red.length).forEach((t) =>
    Q.push(`My ${t.m.name.toLowerCase()} is ${fmt(t.m, u, t.x)} ${unitLabel(t.m, u)}. What should we do about it?`),
  );
  T.filter((t) => !t.red.length && t.cat === "unexplained").forEach((t) =>
    Q.push(`My ${t.m.name.toLowerCase()} is ${t.d === "up" ? "high" : "low"} and my stack doesn't explain it. What could be causing it?`),
  );
  if (sy && di && bpCat(sy, di).r >= 2) Q.push(`My blood pressure is ${sy}/${di}. Should we confirm it with home readings?`);
  if ((ctx.cls("inj") || ctx.cls("oral")) && !s.hab.echo) Q.push("Should I get an echocardiogram?");
  if (ctx.has("creatine") && E && E.ecc == null) Q.push("Can we add cystatin C, since creatine raises creatinine?");
  return {
    sex: s.sex === "f" ? "Female" : "Male",
    age: ctx.me("age"),
    stack: s.stack.filter((id) => BYC[id]).map((id) => ({ name: BYC[id].name, cls: CLS[BYC[id].cls].n })),
    phase,
    trained: s.train,
    bp: sy && di ? `${sy}/${di} mmHg (${bpCat(sy, di).n.toLowerCase()})` : "not recorded",
    hr: hr ? hr + " bpm" : "not recorded",
    egfr: E ? `${Math.round(E.ecr)} (creatinine)` + (E.ecc != null ? `, ${Math.round(E.ecc)} (creatinine + cystatin C)` : "") : "",
    rows,
    tests,
    questions: Q,
  };
}
