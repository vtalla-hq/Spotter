// Loaded by evals/run.ts in headless Chromium. Runs the production upload path on one file.
import { extractText } from "../src/features/ocr";
import { parseReport } from "../src/engine/parse";
import type { Sex, Units } from "../src/engine/types";

async function runOne(url: string, opts: { units: Units; sex: Sex }) {
  const blob = await (await fetch(url)).blob();
  const name = url.split("/").pop()!;
  const file = new File([blob], name, { type: name.endsWith(".pdf") ? "application/pdf" : "image/jpeg" });
  const t0 = performance.now();
  const ex = await extractText(file, () => {});
  const parsed = parseReport(ex.text, opts);
  return { ...ex, parsed, ms: Math.round(performance.now() - t0) };
}

(window as unknown as { runOne: typeof runOne; ready: boolean }).runOne = runOne;
(window as unknown as { ready: boolean }).ready = true;
