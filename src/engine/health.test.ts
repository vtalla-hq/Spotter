import { describe, expect, it } from "vitest";
import { makeCtx } from "./ctx";
import { BYC } from "./data/compounds";
import { SAMPLE } from "./data/sample";
import {
  bpCat,
  hrCat,
  comboList,
  compSys,
  egfrFrom,
  erList,
  gapList,
  gearSignals,
  gearVerdict,
  gStage,
  heartSummary,
  heartTiles,
  kidneyNote,
  showGear,
  strain,
  supportList,
  timelineIndex,
} from "./health";
import { doctorSheet } from "./doctor";
import { EMPTY_STATE, type State } from "./types";

const st = (p: Partial<State>): State => ({ ...EMPTY_STATE, ...p });

describe("eGFR (CKD-EPI 2021)", () => {
  it("matches the published equation for a 40-year-old man with creatinine 1.0 mg/dL", () => {
    // 142 × (1.0/0.9)^-1.2 × 0.9938^40 ≈ 97.6
    const { ecr } = egfrFrom("m", 40, 88.4);
    expect(ecr).toBeCloseTo(97.6, 0);
  });
  it("matches for a 60-year-old woman with creatinine 0.7 mg/dL", () => {
    // 142 × 1 × 1 × 0.9938^60 × 1.012 ≈ 98.9
    expect(egfrFrom("f", 60, 0.7 * 88.4).ecr).toBeCloseTo(98.9, 0);
  });
  it("reads higher with cystatin C when creatinine is inflated by muscle", () => {
    const { ecr, ecc } = egfrFrom("m", 28, 135, 0.8);
    expect(ecc!).toBeGreaterThan(ecr + 10);
  });
  it("returns null for the combined estimate without cystatin C", () => {
    expect(egfrFrom("m", 30, 90).ecc).toBeNull();
  });
  it("stages by KDIGO cut-offs", () => {
    expect(gStage(95).g).toBe("G1");
    expect(gStage(60).g).toBe("G2");
    expect(gStage(59.9).g).toBe("G3a");
    expect(gStage(44).g).toBe("G3b");
    expect(gStage(20).g).toBe("G4");
    expect(gStage(10).g).toBe("G5");
  });
  it("tells you to trust the combined number when creatinine reads low", () => {
    const ctx = makeCtx(st({ stack: ["creatine"] }));
    expect(kidneyNote(ctx, { ecr: 70, ecc: 95 })).toMatch(/25 points lower/);
    expect(kidneyNote(ctx, { ecr: 70, ecc: null })).toMatch(/^Muscle and creatine/);
  });
});

describe("blood pressure (ACC/AHA 2017)", () => {
  it.each([
    [118, 78, "Normal"],
    [124, 78, "Elevated"],
    [132, 78, "Stage 1 high"],
    [118, 82, "Stage 1 high"],
    [142, 85, "Stage 2 high"],
    [181, 100, "Crisis range"],
    [85, 55, "Low"],
    [100, 58, "Low"],
    [65, 40, "Very low"],
    [1, 1, "Check this reading"],
    [80, 120, "Check this reading"],
    [400, 80, "Check this reading"],
  ])("%i/%i is %s", (s, d, n) => expect(bpCat(s, d).n).toBe(n));
});

describe("resting heart rate", () => {
  it.each([
    [1, false, "Check this reading"],
    [300, true, "Check this reading"],
    [25, true, "Very slow"],
    [35, true, "Slow"],
    [50, true, "Athlete-low"],
    [50, false, "Slow"],
    [70, false, "Normal"],
    [90, false, "Upper normal"],
    [110, false, "Fast"],
  ])("%i bpm (trained %s) is %s", (h, t, n) => expect(hrCat(h, t).n).toBe(n));
  it("doesn't call an impossible heart rate normal", () => {
    const t = heartTiles(makeCtx(st({ me: { hr: "1", sys: "1", dia: "1" } })));
    expect(t.find((x) => x.l === "Resting heart rate")?.s).toBe("Check this reading");
    expect(t.find((x) => x.l === "Blood pressure")?.s).toBe("Check this reading");
    expect(heartSummary(t).n).toBe("Not enough data");
  });
  it("counts a very slow heart rate as strain", () => {
    expect(heartSummary(heartTiles(makeCtx(st({ me: { hr: "28" } })))).n).toBe("High strain");
  });
});

describe("heart tiles", () => {
  it("summarises as not enough data when nothing is entered", () => {
    expect(heartSummary(heartTiles(makeCtx(st({})))).n).toBe("Not enough data");
  });
  it("puts hematocrit at the hold point as high strain", () => {
    expect(heartSummary(heartTiles(makeCtx(st({ vals: { hematocrit: 0.55 } })))).n).toBe("High strain");
  });
  it("recommends an echo on injectables", () => {
    const echo = heartTiles(makeCtx(st({ stack: ["testc"] }))).find((t) => t.l === "Heart scan");
    expect(echo?.s).toBe("Worth getting");
  });
});

describe("gear check", () => {
  it("doesn't apply to a natty stack", () => {
    expect(gearSignals(makeCtx(st({ stack: ["creatine"] })))).toBeNull();
  });
  it("looks real when LH is suppressed and testosterone is above range on test", () => {
    const sig = gearSignals(makeCtx(st({ stack: ["testc"], vals: { lh: 0.2, testo: 50 } })))!;
    expect(gearVerdict(sig).t).toBe("Looks real");
  });
  it("doesn't look real when LH is normal and testosterone is in range on test", () => {
    const sig = gearSignals(makeCtx(st({ stack: ["testc"], vals: { lh: 5, testo: 18 } })))!;
    expect(gearVerdict(sig).t).toBe("Doesn't look real");
  });
  it("expects low testosterone on a non-testosterone injectable", () => {
    const sig = gearSignals(makeCtx(st({ stack: ["tren"], vals: { testo: 4 } })))!;
    expect(sig[0].ok).toBe(true);
  });
  it("is hidden for a cycle stack drawn off cycle", () => {
    expect(showGear(makeCtx(st({ stack: ["testc"], cyc: { ph: "off", wk: "4" } })))).toBe(false);
    expect(showGear(makeCtx(st({ stack: ["testc"], cyc: { ph: "on", wk: "4" } })))).toBe(true);
  });
});

describe("timeline", () => {
  it.each([
    ["pre", "", 0],
    ["on", "4", 1],
    ["off", "4", 2],
    ["off", "14", 3],
  ] as const)("phase %s week %s is stage %i", (ph, wk, i) => {
    expect(timelineIndex(makeCtx(st({ stack: ["testc"], cyc: { ph, wk } })))).toBe(i);
  });
});

describe("gaps and combos", () => {
  it("asks for hematocrit, lipids and LH on a cycle", () => {
    const t = gapList(makeCtx(st({ stack: ["testc"] }))).map((g) => g.t);
    expect(t).toContain("Hematocrit tested");
    expect(t).toContain("LH");
  });
  it("marks a gap as done once the result is entered", () => {
    const g = gapList(makeCtx(st({ stack: ["testc"], vals: { hematocrit: 0.5 } }))).find((x) => x.t === "Hematocrit tested");
    expect(g?.done).toBe(true);
  });
  it("warns about two orals and an oral with a SARM", () => {
    const t = comboList(makeCtx(st({ stack: ["anavar", "dbol", "rad"] }))).map((c) => c.t);
    expect(t).toContain("Two orals at once");
    expect(t).toContain("Oral steroid + SARM");
  });
  it("finds no combos for creatine alone", () => {
    expect(comboList(makeCtx(st({ stack: ["creatine"] })))).toEqual([]);
  });
  it("ranks supplements that target a flagged marker first", () => {
    const proven = supportList(makeCtx(st({ vals: { hdl: 0.6 } })))[0];
    expect(proven.items[0].rel).toContain("hdl");
  });
  it("marks ER signs tied to the stack", () => {
    const L = erList(makeCtx(st({ stack: ["dnp"] })));
    expect(L[0].yours).toBe(true);
    expect(L[0].t).toMatch(/hot/);
  });
  it("marks no ER signs with an empty stack", () => {
    expect(erList(makeCtx(st({}))).some((e) => e.yours)).toBe(false);
  });
});

describe("organ strain", () => {
  it("scores zero everywhere with nothing entered", () => {
    expect(strain(makeCtx(st({}))).every((x) => x.tot === 0)).toBe(true);
  });
  it("puts the liver first on an oral with high ALT", () => {
    const L = strain(makeCtx(st({ stack: ["anavar"], vals: { alt: 140 } })));
    expect(L[0].id).toBe("liver");
    expect(L[0].tot).toBeGreaterThan(20);
  });
  it("keeps every score between 0 and 100 on the sample", () => {
    const L = strain(makeCtx(st({ stack: SAMPLE.stack, train: true, cyc: SAMPLE.cyc, vals: SAMPLE.vals, me: SAMPLE.me })));
    for (const x of L) {
      expect(x.tot).toBeGreaterThanOrEqual(0);
      expect(x.tot).toBeLessThanOrEqual(100);
      expect(x.conf).toBeLessThanOrEqual(x.tot);
    }
  });
  it("counts creatine as an artifact, not kidney strain", () => {
    const k = strain(makeCtx(st({ stack: ["creatine"] }))).find((x) => x.id === "kidney")!;
    expect(k.tot).toBe(0);
  });
  it("maps compounds to the systems they hit", () => {
    expect([...compSys(BYC.clen)]).toContain("heart");
    expect([...compSys(BYC.anavar)]).toContain("liver");
  });
});

describe("doctor sheet", () => {
  it("orders act-now first and writes questions", () => {
    const s = st({ stack: ["testc"], cyc: { ph: "on", wk: "6" }, vals: { hematocrit: 0.56, ferritin: 10 }, me: { sys: "142", dia: "91" } });
    const D = doctorSheet(makeCtx(s));
    expect(D.rows[0].status).toBe("Act now");
    expect(D.phase).toBe("On cycle, week 6");
    expect(D.questions.some((q) => q.includes("blood pressure is 142/91"))).toBe(true);
    expect(D.questions).toContain("Should I get an echocardiogram?");
  });
  it("lists compounds by name only, never doses", () => {
    const D = doctorSheet(makeCtx(st({ stack: ["testc", "anavar"] })));
    expect(D.stack.map((x) => x.name)).toEqual([BYC.testc.name, BYC.anavar.name]);
  });
});
