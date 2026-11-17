// Copies the OCR engine and English model into public/ocr/<version> so reports
// are read entirely on the user's device, with no third-party CDN involved.
// The versioned folder lets vercel.json cache these files as immutable.
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { ocrVersion } from "./ocr-version.mjs";

const require = createRequire(import.meta.url);
const pkgDir = (name) => dirname(require.resolve(name + "/package.json"));
const root = "public/ocr";
const out = join(root, ocrVersion());
rmSync(root, { recursive: true, force: true });
mkdirSync(join(out, "lang"), { recursive: true });

const files = [
  [join(pkgDir("tesseract.js"), "dist/worker.min.js"), "worker.min.js"],
  // LSTM-only builds; the worker picks one based on the browser's SIMD support
  ...["lstm", "simd-lstm", "relaxedsimd-lstm"].map((v) => [
    join(pkgDir("tesseract.js-core"), `tesseract-core-${v}.wasm.js`),
    `tesseract-core-${v}.wasm.js`,
  ]),
  [join(pkgDir("@tesseract.js-data/eng"), "4.0.0_best_int/eng.traineddata.gz"), "lang/eng.traineddata.gz"],
];
for (const [from, to] of files) copyFileSync(from, join(out, to));
console.log(`OCR assets copied to ${out}`);
