import { describe, expect, it } from "vitest";
import { BYID } from "./data/markers";
import { rangeFor } from "./ctx";
import { erf, niceStep, ordinal, percentile, Phi } from "./stats";
import { fmt, fmtInput, toSI, unitLabel } from "./units";

describe("normal distribution", () => {
  it("erf matches known values", () => {
    expect(erf(0)).toBeCloseTo(0, 6);
    expect(erf(1)).toBeCloseTo(0.8427, 4);
    expect(erf(-1)).toBeCloseTo(-0.8427, 4);
  });
  it("Phi(1.96) is 97.5%", () => {
    expect(Phi(1.96)).toBeCloseTo(0.975, 3);
  });
});

describe("percentiles", () => {
  it("puts the edges of the typical range at the 2.5th and 97.5th percentile", () => {
    for (const id of ["hematocrit", "alt", "ldl", "ferritin"]) {
      const m = BYID[id];
      const [lo, hi] = rangeFor(m, "m");
      expect(percentile(m, [lo, hi], lo)).toBeCloseTo(2.5, 1);
      expect(percentile(m, [lo, hi], hi)).toBeCloseTo(97.5, 1);
    }
  });
  it("puts the geometric midpoint of a log-normal marker at the 50th", () => {
    const m = BYID.alt;
    const r = rangeFor(m, "m");
    expect(percentile(m, r, Math.sqrt(r[0] * r[1]))).toBeCloseTo(50, 5);
  });
  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 50].map(ordinal)).toEqual(
      ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "50th"],
    );
    expect(ordinal(0.4)).toBe("<1st");
    expect(ordinal(99.6)).toBe(">99th");
  });
  it("rounds axis steps to 1, 2, 5 or 10", () => {
    expect(niceStep(0.13)).toBeCloseTo(0.1);
    expect(niceStep(23)).toBe(20);
    expect(niceStep(4.1)).toBe(5);
    expect(niceStep(8)).toBe(10);
  });
});

describe("units", () => {
  it("shows hematocrit as L/L or %", () => {
    const m = BYID.hematocrit;
    expect(fmt(m, "si", 0.53)).toBe("0.53");
    expect(fmt(m, "us", 0.53)).toBe("53");
    expect(unitLabel(m, "us")).toBe("%");
  });
  it("converts glucose and creatinine both ways", () => {
    expect(toSI(BYID.glucose, "us", 100)).toBeCloseTo(5.55, 2);
    expect(toSI(BYID.creatinine, "us", 1.0)).toBeCloseTo(88.4, 1);
    expect(fmt(BYID.creatinine, "us", 88.4)).toBe("1.00");
  });
  it("round-trips through the input box without drift", () => {
    for (const id of ["ldl", "testo", "estradiol", "bili", "ft4"]) {
      const m = BYID[id];
      const si = rangeFor(m, "m")[1];
      const typed = parseFloat(fmtInput(m, "us", si));
      expect(toSI(m, "us", typed)).toBeCloseTo(si, 1);
    }
  });
  it("leaves blanks blank", () => {
    expect(fmt(BYID.alt, "si", undefined)).toBe("");
    expect(fmtInput(BYID.alt, "si", null)).toBe("");
  });
});
