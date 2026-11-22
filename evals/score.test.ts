import { describe, expect, it } from "vitest";
import { aggregate, score, type RunOutput } from "./score";
import type { Label } from "./gen/cases";

const label: Label = {
  id: "t-01", dataset: "v1", layout: "quest", sex: "m", units: "us", drawDate: "2026-03-14", photoPages: 1,
  markers: [
    { id: "glucose", value: 99, unit: "us", page: 1 },
    { id: "ck", value: 450, unit: "us", page: 1 },
    { id: "ldl", value: 131, unit: "us", page: 2 },
  ],
  lookalikes: [{ key: "non-hdl", page: 1 }],
};
const v = (id: string, raw: number, si: number, unit: "si" | "us" = "us", check = false, line = id) =>
  ({ id, raw, si, unit, by: "label" as const, check, line });
const out = (values: ReturnType<typeof v>[], date: string | null = "2026-03-14"): RunOutput =>
  ({ text: "", method: "pdf-text", pages: 2, ms: 10, parsed: { values, date } });

describe("score", () => {
  it("counts hits, misses, wrong values and false hits", () => {
    const s = score(label, "pdf", out([
      v("glucose", 99, 99 / 18.016),
      v("ck", 45, 45),
      v("hdl", 120, 3.1, "us", false, "NON-HDL CHOLESTEROL 120 mg/dL"),
    ]), {});
    expect(s.expected).toBe(3);
    expect(s.tp).toBe(2);
    expect(s.siOk).toBe(1);
    expect(s.silent).toBe(1);
    expect(s.fp).toBe(1);
    expect(s.fpLookalike).toBe(1);
    expect(s.dateOk).toBe(true);
    expect(s.problems.map((p) => p.kind).sort()).toEqual(["false-hit", "missed", "value"]);
  });
  it("only scores page 1 for photos", () => {
    const s = score(label, "photo", out([v("glucose", 99, 99 / 18.016)], null), {});
    expect(s.expected).toBe(2);
    expect(s.dateOk).toBe(false);
  });
  it("doesn't count a flagged wrong value as silent", () => {
    expect(score(label, "pdf", out([v("ck", 45, 45, "us", true)]), {}).silent).toBe(0);
  });
  it("aggregates micro-averaged", () => {
    const a = aggregate([score(label, "pdf", out([v("glucose", 99, 99 / 18.016)]), {}), score(label, "scan", out([]), {})]);
    expect(a.recall).toBeCloseTo(100 / 6);
    expect(a.precision).toBe(100);
    expect(a.date).toBe(100);
  });
});
