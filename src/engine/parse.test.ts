import { describe, expect, it } from "vitest";
import { cleanNumbers, findDate, inferUnit, parseReport } from "./parse";
import { BYID } from "./data/markers";

const P = (text: string, units: "si" | "us" = "si", sex: "m" | "f" = "m") => {
  const r = parseReport(text, { units, sex });
  return { ...r, by: Object.fromEntries(r.values.map((v) => [v.id, v])) };
};

describe("basic lines", () => {
  it("reads the original paste format", () => {
    const r = P("Hematocrit 0.53 L/L\nALT 78 U/L\nHDL Cholesterol 0.62 mmol/L\nCK 1450 U/L");
    expect(r.by.hematocrit.si).toBe(0.53);
    expect(r.by.alt.si).toBe(78);
    expect(r.by.hdl.si).toBe(0.62);
    expect(r.by.ck.si).toBe(1450);
  });
  it("keeps the first result when a marker appears twice", () => {
    expect(P("ALT 78\nALT 40").by.alt.si).toBe(78);
  });
  it("ignores lines with no recognised marker", () => {
    expect(P("Patient: John Smith\nPhysician: Dr. Who").values).toEqual([]);
  });
});

describe("picking the right marker", () => {
  it("prefers the longest alias (A1c over hemoglobin)", () => {
    const r = P("Hemoglobin A1c 5.8 %");
    expect(r.by.a1c.si).toBe(5.8);
    expect(r.by.hemoglobin).toBeUndefined();
  });
  it("skips Non-HDL cholesterol and cholesterol ratios", () => {
    const r = P("Non-HDL Cholesterol 3.9 mmol/L\nChol/HDL Ratio 4.2\nHDL Cholesterol 1.1 mmol/L");
    expect(r.by.hdl.si).toBe(1.1);
  });
  it("skips free testosterone and keeps total", () => {
    const r = P("Testosterone, Free 310 pmol/L\nTestosterone, Total 18.2 nmol/L");
    expect(r.by.testo.si).toBe(18.2);
  });
  it("skips red-cell indices that mention hemoglobin", () => {
    const r = P("Mean Corpuscular Hemoglobin 30 pg\nMCHC 340 g/L\nHemoglobin 152 g/L");
    expect(r.by.hemoglobin.si).toBe(152);
  });
  it("skips direct bilirubin and urine tests", () => {
    const r = P("Bilirubin, Direct 4\nCreatinine, Urine 12000 umol/L\nBilirubin, Total 14 umol/L\nCreatinine 98 umol/L");
    expect(r.by.bili.si).toBe(14);
    expect(r.by.creatinine.si).toBe(98);
  });
  it("doesn't read IGF-1's '1' as the value", () => {
    expect(P("IGF-1 310 ug/L").by.igf1.si).toBe(310);
  });
  it("doesn't read free T4's '4' as the value", () => {
    expect(P("Free T4 14 pmol/L").by.ft4.si).toBe(14);
  });
  it("doesn't mistake a value ending in 2 plus an H flag for a 2-hour glucose", () => {
    expect(P("Glucose Fasting   112   H   70 - 99   mg/dL").by.glucose.si).toBeCloseTo(6.22, 2);
    expect(P("Glucose 2 hr post 75g 9.1").by.glucose).toBeUndefined();
  });
  it("doesn't match ALT inside other words", () => {
    expect(P("Alternate address 123 Main St").values).toEqual([]);
  });
});

describe("result vs reference range", () => {
  it("takes the result when the range comes after it", () => {
    expect(P("ALT 78 H 10 - 50 U/L").by.alt.si).toBe(78);
  });
  it("takes the result when the range comes first", () => {
    expect(P("ALT (10-50 U/L) 78").by.alt.si).toBe(78);
    expect(P("LDL Cholesterol (<3.4) 4.1 mmol/L").by.ldl.si).toBe(4.1);
  });
  it("reads a result on the next line", () => {
    expect(P("Ferritin\n24 ug/L\nTSH 2.1").by.ferritin.si).toBe(24);
  });
  it("handles < and > results", () => {
    expect(P("LH <0.1 IU/L").by.lh.si).toBe(0.1);
  });
});

describe("units", () => {
  it("reads US units from the label even when SI is selected", () => {
    const r = P("Glucose, Fasting 99 mg/dL\nCreatinine 1.1 mg/dL\nLDL Cholesterol 155 mg/dL");
    expect(r.by.glucose.unit).toBe("us");
    expect(r.by.glucose.by).toBe("label");
    expect(r.by.glucose.si).toBeCloseTo(5.5, 1);
    expect(r.by.creatinine.si).toBeCloseTo(97.2, 0);
    expect(r.by.ldl.si).toBeCloseTo(4.01, 2);
  });
  it("reads SI labels even when US is selected", () => {
    const r = P("Glucose 5.4 mmol/L\nTestosterone 18 nmol/L", "us");
    expect(r.by.glucose.si).toBe(5.4);
    expect(r.by.testo.si).toBe(18);
  });
  it("normalises µ, u and mcg spellings", () => {
    expect(P("Creatinine 98 µmol/L", "us").by.creatinine.si).toBe(98);
    expect(P("Creatinine 98 umol/L", "us").by.creatinine.si).toBe(98);
    expect(P("Creatinine 98 μmol/L", "us").by.creatinine.si).toBe(98);
  });
  it("infers % for a bare hematocrit of 45", () => {
    const r = P("Hematocrit 45");
    expect(r.by.hematocrit.si).toBeCloseTo(0.45, 3);
    expect(r.by.hematocrit.by).toBe("plausible");
  });
  it("infers mg/dL for a bare glucose of 95", () => {
    expect(P("Glucose 95").by.glucose.si).toBeCloseTo(5.27, 2);
  });
  it("keeps the selected units when the value is plausible in them", () => {
    expect(P("Glucose 5.4").by.glucose.by).toBe("selected");
    expect(P("Glucose 99", "us").by.glucose.si).toBeCloseTo(5.5, 1);
  });
  it("flags values that are implausible in either unit for a check", () => {
    expect(P("ALT 7800").by.alt.check).toBe(true);
    expect(P("ALT 78").by.alt.check).toBe(false);
  });
  it("treats markers with the same unit both ways as unit-free", () => {
    expect(P("CK 1450").by.ck.by).toBe("same");
  });
  it("inferUnit picks the plausible reading", () => {
    expect(inferUnit(BYID.testo, "m", 520, "si").unit).toBe("us");
    expect(inferUnit(BYID.testo, "m", 18, "si").unit).toBe("si");
  });
});

describe("OCR noise", () => {
  it("fixes O for 0 and l for 1 inside numbers", () => {
    expect(cleanNumbers("alt 7O")).toBe("alt 70");
    expect(cleanNumbers("ck 1l50")).toBe("ck 1150");
    expect(cleanNumbers("hct O.45")).toBe("hct 0.45");
  });
  it("reads decimal commas but not thousands separators", () => {
    expect(cleanNumbers("ldl 4,1")).toBe("ldl 4.1");
    expect(cleanNumbers("ck 1,450")).toBe("ck 1450");
  });
  it("parses a noisy OCR'd table", () => {
    const text = [
      "LIFELABS   Collected: 2026-10-14 08:12",
      "Test            Result   Flag  Reference   Units",
      "Hematocrit      O.53     H     0.40-0.52   L/L",
      "Hemoglobin      178      H     135-175     g/L",
      "ALT             96       H     <50         U/L",
      "Creatine Kinase 2,100    H     40-320      U/L",
      "Cholesterol HDL 0,58     L     >1.00       mmol/L",
    ].join("\n");
    const r = P(text);
    expect(r.by.hematocrit.si).toBe(0.53);
    expect(r.by.hemoglobin.si).toBe(178);
    expect(r.by.alt.si).toBe(96);
    expect(r.by.ck.si).toBe(2100);
    expect(r.by.hdl.si).toBe(0.58);
    expect(r.date).toBe("2026-10-14");
  });
});

describe("dates", () => {
  it.each([
    ["Collected: 2026-10-14", "2026-10-14"],
    ["Date: 2026/3/5", "2026-03-05"],
    ["Collection Date Oct 14, 2026", "2026-10-14"],
    ["Specimen drawn 14-Oct-2026", "2026-10-14"],
    ["Drawn 10/14/2026", "2026-10-14"],
    ["Drawn 14/10/2026", "2026-10-14"],
  ])("reads %s", (s, d) => expect(findDate(s)).toBe(d));
  it("rejects nonsense dates", () => {
    expect(findDate("Ref 2026-14-40")).toBeNull();
  });
  it("prefers the collection date over other dates", () => {
    expect(P("Printed 2026-11-01\nCollected 2026-10-14\nALT 30").date).toBe("2026-10-14");
  });
  it("falls back to the first date", () => {
    expect(P("Report 2026-11-01\nALT 30").date).toBe("2026-11-01");
  });
});
