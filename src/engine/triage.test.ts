import { describe, expect, it } from "vitest";
import { makeCtx } from "./ctx";
import { BYID, M } from "./data/markers";
import { COMP } from "./data/compounds";
import { SRC } from "./data/sources";
import { ACT } from "./data/actions";
import { RED } from "./data/redflags";
import { SAMPLE } from "./data/sample";
import { buckets, checklist, offDir, rowStatus, triage, untested } from "./triage";
import { EMPTY_STATE, type State } from "./types";

const st = (p: Partial<State>): State => ({ ...EMPTY_STATE, ...p });
const flag = (s: State, id: string) => triage(makeCtx(s)).find((t) => t.m.id === id);

describe("offDir", () => {
  const ctx = makeCtx(st({}));
  it("is null inside the typical range", () => {
    expect(offDir(ctx, BYID.alt, 30)).toBeNull();
  });
  it("flags values above and below the range", () => {
    expect(offDir(ctx, BYID.alt, 51)).toBe("up");
    expect(offDir(ctx, BYID.ferritin, 20)).toBe("down");
  });
  it("is null for a missing value", () => {
    expect(offDir(ctx, BYID.alt, undefined)).toBeNull();
  });
  it("uses sex-specific ranges", () => {
    expect(offDir(makeCtx(st({ sex: "m" })), BYID.hematocrit, 0.5)).toBeNull();
    expect(offDir(makeCtx(st({ sex: "f" })), BYID.hematocrit, 0.5)).toBe("up");
  });
  it("flags LDL past the guideline limit even inside the lab range", () => {
    // typical range tops out at 5.0, but 3.4 is the guideline limit
    expect(offDir(ctx, BYID.ldl, 3.8)).toBe("up");
    expect(offDir(ctx, BYID.ldl, 3.0)).toBeNull();
  });
  it("uses sex-specific HDL limits", () => {
    expect(offDir(makeCtx(st({ sex: "f" })), BYID.hdl, 1.05)).toBe("down");
    expect(offDir(makeCtx(st({ sex: "m" })), BYID.hdl, 1.05)).toBeNull();
  });
});

describe("triage categories", () => {
  it("files creatinine from creatine as explained (lab artifact)", () => {
    const f = flag(st({ stack: ["creatine"], vals: { creatinine: 130 } }), "creatinine");
    expect(f?.cat).toBe("explained");
    expect(f?.cs[0].f.k).toBe("artifact");
  });
  it("files the same creatinine with no stack as unexplained", () => {
    expect(flag(st({ vals: { creatinine: 130 } }), "creatinine")?.cat).toBe("unexplained");
  });
  it("files high hematocrit on testosterone as a real risk", () => {
    expect(flag(st({ stack: ["testc"], vals: { hematocrit: 0.53 } }), "hematocrit")?.cat).toBe("risk");
  });
  it("raises a red flag at the 54% hematocrit hold point whatever the cause", () => {
    const f = flag(st({ vals: { hematocrit: 0.54 } }), "hematocrit");
    expect(f?.red.length).toBe(1);
  });
  it("raises the ALT red flag at 5x the upper limit, using the sex-specific limit", () => {
    expect(flag(st({ vals: { alt: 251 } }), "alt")?.red.length).toBe(1);
    expect(flag(st({ vals: { alt: 249 } }), "alt")?.red.length).toBe(0);
    // women's upper limit is 35, so 5x is 175
    expect(flag(st({ sex: "f", vals: { alt: 180 } }), "alt")?.red.length).toBe(1);
  });
  it("explains CK, AST and ALT after hard training", () => {
    const s = st({ train: true, vals: { ck: 1500, ast: 60, alt: 60, ggt: 30 } });
    const T = triage(makeCtx(s));
    expect(T.map((t) => t.m.id).sort()).toEqual(["alt", "ast", "ck"]);
    expect(T.every((t) => t.cat === "explained")).toBe(true);
  });
  it("prefers risk when one cause is an artifact and another is real harm", () => {
    const f = flag(st({ train: true, stack: ["anavar"], vals: { alt: 90 } }), "alt");
    expect(f?.cat).toBe("risk");
    expect(f?.cs.length).toBeGreaterThanOrEqual(2);
  });
  it("doesn't flag a result in range", () => {
    expect(triage(makeCtx(st({ vals: { alt: 30, hdl: 1.3 } })))).toEqual([]);
  });
});

describe("cycle phase", () => {
  const base = { stack: ["testc"], vals: { hematocrit: 0.53 } };
  it("blames the cycle for a draw on cycle", () => {
    expect(flag(st({ ...base, cyc: { ph: "on", wk: "6" } }), "hematocrit")?.cat).toBe("risk");
  });
  it("doesn't blame the cycle for a baseline draw", () => {
    const f = flag(st({ ...base, cyc: { ph: "pre", wk: "" } }), "hematocrit");
    expect(f?.cat).toBe("unexplained");
    expect(f?.gone.map((c) => c.id)).toEqual(["testc"]);
  });
  it("still blames the cycle under 12 weeks off", () => {
    expect(flag(st({ ...base, cyc: { ph: "off", wk: "8" } }), "hematocrit")?.cat).toBe("risk");
  });
  it("stops blaming the cycle at 12+ weeks off", () => {
    const f = flag(st({ ...base, cyc: { ph: "off", wk: "12" } }), "hematocrit");
    expect(f?.cat).toBe("unexplained");
    expect(f?.gone.length).toBe(1);
  });
  it("keeps blaming non-cycle compounds whatever the phase", () => {
    const f = flag(st({ stack: ["creatine", "testc"], cyc: { ph: "pre", wk: "" }, vals: { creatinine: 130 } }), "creatinine");
    expect(f?.cat).toBe("explained");
  });
});

describe("buckets", () => {
  it("splits the sample into all three groups", () => {
    const s = st({ stack: SAMPLE.stack, train: true, cyc: SAMPLE.cyc, vals: SAMPLE.vals });
    const B = buckets(makeCtx(s));
    expect(B.act.length).toBeGreaterThan(0);
    expect(B.fix.length).toBeGreaterThan(0);
    expect(B.exp.length).toBeGreaterThan(0);
    expect(B.act.length + B.fix.length + B.exp.length + B.fine).toBe(B.n);
    expect(B.n).toBe(Object.keys(SAMPLE.vals).length);
  });
  it("sorts real risks before unexplained flags", () => {
    const s = st({ stack: ["testc"], vals: { hematocrit: 0.53, ferritin: 10 } });
    const B = buckets(makeCtx(s));
    expect(B.fix.map((t) => t.cat)).toEqual(["risk", "unexplained"]);
  });
});

describe("rowStatus and helpers", () => {
  it("labels rows", () => {
    const ctx = makeCtx(st({ stack: ["creatine"], vals: { creatinine: 130, alt: 20 } }));
    expect(rowStatus(ctx, BYID.creatinine)?.label).toBe("High · Explained");
    expect(rowStatus(ctx, BYID.alt)?.label).toBe("In range");
    expect(rowStatus(ctx, BYID.ldl)).toBeNull();
  });
  it("lists markers the stack affects but that weren't tested", () => {
    const ids = untested(makeCtx(st({ stack: ["creatine"] }))).map((x) => x.id);
    expect(ids).toEqual(["creatinine"]);
  });
  it("adds stack-specific checklist items", () => {
    expect(checklist(makeCtx(st({ stack: ["mk677"] }))).some((x) => x.includes("IGF-1"))).toBe(true);
    expect(checklist(makeCtx(st({}))).some((x) => x.includes("IGF-1"))).toBe(false);
  });
});

describe("data integrity", () => {
  const cites = (s: string) => [...s.matchAll(/\[(P\d+)\]/g)].map((m) => m[1]);
  it("every compound effect points at a real marker", () => {
    for (const c of COMP) for (const f of c.fx) expect(BYID[f.m], `${c.id} → ${f.m}`).toBeDefined();
  });
  it("every citation points at a real source", () => {
    const text = JSON.stringify([COMP, ACT, RED.map((r) => r.txt)]);
    for (const id of cites(text)) expect(SRC[id], id).toBeDefined();
  });
  it("compound and marker ids are unique", () => {
    expect(new Set(COMP.map((c) => c.id)).size).toBe(COMP.length);
    expect(new Set(M.map((m) => m.id)).size).toBe(M.length);
  });
  it("every red flag and action is for a real marker", () => {
    for (const r of RED) expect(BYID[r.m]).toBeDefined();
    for (const k of Object.keys(ACT)) expect(BYID[k], k).toBeDefined();
  });
  it("every range is low < high and positive", () => {
    for (const m of M) {
      const rs = Array.isArray(m.ri) ? [m.ri] : [m.ri.m, m.ri.f];
      for (const [lo, hi] of rs) {
        expect(lo).toBeGreaterThan(0);
        expect(hi).toBeGreaterThan(lo);
      }
    }
  });
});
