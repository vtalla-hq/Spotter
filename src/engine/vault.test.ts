import { describe, expect, it } from "vitest";
import { fromB64, mergeStates, open, seal, toB64, WrongPassphrase } from "./vault";
import { EMPTY_STATE, type State } from "./types";

// fewer iterations so the suite stays fast; production uses 600k
const ITER = 1000;

describe("vault encryption", () => {
  it("round-trips data with the right passphrase", async () => {
    const data = { vals: { hematocrit: 0.53 }, stack: ["testc"] };
    const v = await seal(data, "correct horse battery staple", ITER);
    expect(await open(v, "correct horse battery staple")).toEqual(data);
  });
  it("never stores the plaintext", async () => {
    const v = await seal({ secret: "hematocrit 0.53" }, "pw", ITER);
    expect(JSON.stringify(v)).not.toContain("hematocrit");
    expect(atob(v.data)).not.toContain("hematocrit");
  });
  it("rejects a wrong passphrase", async () => {
    const v = await seal({ a: 1 }, "right", ITER);
    await expect(open(v, "wrong")).rejects.toBeInstanceOf(WrongPassphrase);
  });
  it("rejects tampered ciphertext", async () => {
    const v = await seal({ a: 1 }, "pw", ITER);
    const bytes = fromB64(v.data);
    bytes[0] ^= 1;
    await expect(open({ ...v, data: toB64(bytes) }, "pw")).rejects.toBeInstanceOf(WrongPassphrase);
  });
  it("uses a fresh salt and IV every time", async () => {
    const a = await seal({ a: 1 }, "pw", ITER);
    const b = await seal({ a: 1 }, "pw", ITER);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });
});

describe("mergeStates", () => {
  const S = (p: Partial<State>): State => ({ ...EMPTY_STATE, ...p });
  const d = (id: string, date: string, alt: number) => ({ id, date, vals: { alt }, stack: [], train: false, ph: "on" as const, wk: "" });
  it("keeps draws from both devices", () => {
    const local = S({ updatedAt: 2, draws: [d("a", "2026-01-01", 1)] });
    const remote = S({ updatedAt: 1, draws: [d("b", "2026-02-01", 2)] });
    expect(mergeStates(local, remote).draws.map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("takes the newer copy's settings and version of a shared draw", () => {
    const local = S({ updatedAt: 1, sex: "m", draws: [d("a", "2026-01-01", 1)] });
    const remote = S({ updatedAt: 5, sex: "f", draws: [d("a", "2026-01-01", 9)] });
    const m = mergeStates(local, remote);
    expect(m.sex).toBe("f");
    expect(m.draws[0].vals.alt).toBe(9);
    expect(m.updatedAt).toBe(5);
  });
});
