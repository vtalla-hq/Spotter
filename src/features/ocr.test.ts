import { describe, expect, it } from "vitest";
import { wordsToLines } from "./ocr";
import { parseReport } from "../engine/parse";

const w = (str: string, x: number, y: number, width = str.length * 5) => ({ str, x, y, w: width });

describe("rebuilding PDF rows from word positions", () => {
  it("puts words at the same height on one line, left to right, top line first", () => {
    const lines = wordsToLines([w("78", 200, 700), w("ALT", 50, 701), w("U/L", 300, 700), w("Hematocrit", 50, 720), w("0.53", 200, 719)]);
    expect(lines).toEqual(["Hematocrit   0.53", "ALT   78   U/L"]);
  });
  it("keeps a column gap so numbers in different columns don't merge", () => {
    const [line] = wordsToLines([w("CK", 50, 600), w("1450", 200, 600), w("40", 300, 600), w("-", 315, 600, 4), w("320", 322, 600)]);
    expect(parseReport(line, { units: "si", sex: "m" }).values[0].si).toBe(1450);
  });
  it("skips empty strings", () => {
    expect(wordsToLines([w(" ", 0, 0), w("ALT", 10, 0)])).toEqual(["ALT"]);
  });
});
