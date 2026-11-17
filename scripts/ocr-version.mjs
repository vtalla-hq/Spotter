// A short id for the OCR engine build, from the installed package versions.
// The OCR files are served under /ocr/<id>/, so they can be cached forever and
// an upgrade can never mix an old worker with a new core.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";

const require = createRequire(import.meta.url);

export function ocrVersion() {
  const v = ["tesseract.js", "tesseract.js-core", "@tesseract.js-data/eng"]
    .map((n) => n + "@" + JSON.parse(readFileSync(require.resolve(n + "/package.json"), "utf8")).version)
    .join(",");
  return createHash("sha256").update(v).digest("hex").slice(0, 10);
}
