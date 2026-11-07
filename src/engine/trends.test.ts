import { describe, expect, it } from "vitest";
import { BYID } from "./data/markers";
import { changes, dayNum, fromDayNum, linearFit, project, projections, recovery, series } from "./trends";
import { saveDraw, loadDraw, deleteDraw, sampleState, normalize, clearedState } from "./state";
import { EMPTY_STATE, type Draw, type Phase, type State } from "./types";

let n = 0;
const draw = (date: string, vals: Record<string, number>, ph: Phase = "on"): Draw => ({
  id: "d" + n++, date, vals, stack: [], train: false, ph, wk: "",
});

describe("dates", () => {
  it("round-trips day numbers", () => {
    expect(fromDayNum(dayNum("2026-11-07"))).toBe("2026-11-07");
    expect(dayNum("2026-01-02") - dayNum("2026-01-01")).toBe(1);
  });
});

describe("linearFit", () => {
  it("fits a perfect line", () => {
    const f = linearFit([{ date: "", day: 0, v: 1 }, { date: "", day: 10, v: 2 }, { date: "", day: 20, v: 3 }])!;
    expect(f.slope).toBeCloseTo(0.1);
    expect(f.intercept).toBeCloseTo(1);
  });
  it("needs two different days", () => {
    expect(linearFit([{ date: "", day: 5, v: 1 }])).toBeNull();
    expect(linearFit([{ date: "", day: 5, v: 1 }, { date: "", day: 5, v: 2 }])).toBeNull();
  });
});

describe("projection", () => {
  it("projects hematocrit to the top of the range, then to 54%", () => {
    const pts = series([draw("2026-09-01", { hematocrit: 0.48 }), draw("2026-10-01", { hematocrit: 0.5 })], "hematocrit");
    const p = project(BYID.hematocrit, "m", pts)!;
    // +0.02 per 30 days from 0.50 → 0.52 in 30 days
    expect(p.label).toBe("the top of the typical range");
    expect(p.days).toBe(30);
    expect(p.date).toBe("2026-10-31");

    const past = series([draw("2026-09-01", { hematocrit: 0.52 }), draw("2026-10-01", { hematocrit: 0.53 })], "hematocrit");
    const q = project(BYID.hematocrit, "m", past)!;
    expect(q.label).toBe("the 54% hold point");
    expect(q.days).toBe(30);
  });
  it("projects downward trends to the bottom of the range", () => {
    const pts = series([draw("2026-08-01", { hdl: 1.4 }), draw("2026-09-01", { hdl: 1.2 }), draw("2026-10-01", { hdl: 1.0 })], "hdl");
    const p = project(BYID.hdl, "m", pts)!;
    expect(p.dir).toBe("down");
    expect(p.label).toBe("the bottom of the typical range");
  });
  it("doesn't project a flat or noisy trend", () => {
    const pts = series([draw("2026-09-01", { hematocrit: 0.48 }), draw("2026-10-01", { hematocrit: 0.4801 })], "hematocrit");
    expect(project(BYID.hematocrit, "m", pts)).toBeNull();
  });
  it("doesn't project from draws less than a week apart", () => {
    const pts = series([draw("2026-10-01", { hematocrit: 0.48 }), draw("2026-10-04", { hematocrit: 0.5 })], "hematocrit");
    expect(project(BYID.hematocrit, "m", pts)).toBeNull();
  });
  it("doesn't project more than a year out", () => {
    const pts = series([draw("2025-01-01", { hematocrit: 0.45 }), draw("2026-01-01", { hematocrit: 0.452 })], "hematocrit");
    expect(project(BYID.hematocrit, "m", pts)).toBeNull();
  });
  it("doesn't project a marker heading back toward the middle of its range", () => {
    // off-cycle hematocrit easing down from 0.50 is recovery, not a warning
    const pts = series([draw("2026-08-01", { hematocrit: 0.5 }, "off"), draw("2026-09-01", { hematocrit: 0.48 }, "off")], "hematocrit");
    expect(project(BYID.hematocrit, "m", pts)).toBeNull();
  });
  it("doesn't project when already past every threshold", () => {
    const pts = series([draw("2026-09-01", { hematocrit: 0.55 }), draw("2026-10-01", { hematocrit: 0.57 })], "hematocrit");
    expect(project(BYID.hematocrit, "m", pts)).toBeNull();
  });
  it("only fits the latest cycle phase", () => {
    const D = [
      draw("2026-03-01", { lh: 4.8 }, "pre"),
      draw("2026-06-01", { lh: 0.1 }, "on"),
      draw("2026-09-01", { lh: 2.1 }, "off"),
    ];
    expect(projections(D, "m")).toEqual([]);
    const D2 = [...D, draw("2026-10-01", { lh: 1.8 }, "off")];
    // two off-cycle draws, falling: projected from those only
    expect(projections(D2, "m")[0]?.dir).toBe("down");
  });
  it("sorts projections soonest first", () => {
    const D = [
      draw("2026-09-01", { hematocrit: 0.48, glucose: 5.0 }),
      draw("2026-10-01", { hematocrit: 0.5, glucose: 5.8 }),
    ];
    const P = projections(D, "m");
    expect(P.map((p) => p.id)).toEqual(["glucose", "hematocrit"]);
  });
});

describe("recovery", () => {
  it("measures how far back toward baseline", () => {
    const D = [
      draw("2026-01-01", { hdl: 1.2 }, "pre"),
      draw("2026-03-01", { hdl: 0.6 }, "on"),
      draw("2026-06-01", { hdl: 1.08 }, "off"),
    ];
    const r = recovery(D, "m");
    expect(r[0].id).toBe("hdl");
    expect(r[0].pct).toBe(80);
    expect(r[0].overshoot).toBe(false);
  });
  it("flags markers that overshot baseline, like testosterone crashing after a cycle", () => {
    const D = [draw("2026-01-01", { testo: 18 }, "pre"), draw("2026-03-01", { testo: 60 }), draw("2026-06-01", { testo: 9 }, "off")];
    const r = recovery(D, "m")[0];
    expect(r.overshoot).toBe(true);
    expect(r.pct).toBe(100);
  });
  it("only reports recovery once the latest draw is off cycle", () => {
    const D = [draw("2026-01-01", { hdl: 1.2 }, "pre"), draw("2026-03-01", { hdl: 0.6 }), draw("2026-06-01", { hdl: 0.7 }, "on")];
    expect(recovery(D, "m")).toEqual([]);
  });
  it("needs a baseline draw", () => {
    expect(recovery([draw("2026-03-01", { hdl: 0.6 }), draw("2026-06-01", { hdl: 1.0 })], "m")).toEqual([]);
  });
  it("ignores markers that barely moved", () => {
    const D = [draw("2026-01-01", { alt: 30 }, "pre"), draw("2026-03-01", { alt: 31 }), draw("2026-06-01", { alt: 30 })];
    expect(recovery(D, "m")).toEqual([]);
  });
});

describe("changes", () => {
  it("compares the last two draws", () => {
    const c = changes([draw("2026-01-01", { alt: 40 }), draw("2026-02-01", { alt: 50, ck: 300 })]);
    expect(c).toEqual([{ id: "alt", from: 40, to: 50, delta: 10, pct: 25 }]);
  });
});

describe("draw history", () => {
  it("saves, replaces same-day draws and loads them back", () => {
    let s: State = { ...EMPTY_STATE, vals: { alt: 40 }, stack: ["creatine"] };
    s = saveDraw(s, "2026-10-01");
    s = saveDraw({ ...s, vals: { alt: 45 } }, "2026-10-01");
    expect(s.draws.length).toBe(1);
    expect(s.draws[0].vals.alt).toBe(45);
    s = saveDraw({ ...s, vals: { alt: 60 } }, "2026-09-01");
    expect(s.draws.map((d) => d.date)).toEqual(["2026-09-01", "2026-10-01"]);
    const back = loadDraw({ ...s, vals: {} }, s.draws[0].id);
    expect(back.vals.alt).toBe(60);
    expect(back.drawDate).toBe("2026-09-01");
    expect(deleteDraw(s, s.draws[0].id).draws.length).toBe(1);
  });
  it("the sample comes with a history that shows projections", () => {
    const s = sampleState(EMPTY_STATE);
    expect(s.draws.length).toBe(4);
    expect(projections(s.draws, "m").length).toBeGreaterThan(0);
    expect(clearedState(s).draws).toEqual([]);
  });
  it("clearing keeps a real user's saved draws", () => {
    const s = saveDraw({ ...EMPTY_STATE, vals: { alt: 40 } }, "2026-10-01");
    expect(clearedState(s).draws.length).toBe(1);
  });
});

describe("normalize", () => {
  it("migrates v1 storage", () => {
    const s = normalize({ sex: "f", units: "us", stack: ["creatine", "made-up"], vals: { alt: 30, fake: 2, ldl: -1 }, cyc: { ph: "off", wk: "3" } });
    expect(s.sex).toBe("f");
    expect(s.stack).toEqual(["creatine"]);
    expect(s.vals).toEqual({ alt: 30 });
    expect(s.cyc).toEqual({ ph: "off", wk: "3" });
    expect(s.draws).toEqual([]);
  });
  it("survives junk", () => {
    expect(normalize(null).stack).toEqual([]);
    expect(normalize("x").vals).toEqual({});
    expect(normalize({ draws: [{ date: "bad" }, { date: "2026-01-01", vals: { alt: 3 } }] }).draws.length).toBe(1);
  });
});
