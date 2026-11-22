# Extraction eval: spec

Goal: measure how accurately the existing upload path (`src/features/ocr.ts` → `src/engine/parse.ts`) extracts lab values. Then fix what's worth fixing, and test whether an opt-in LLM fallback helps on the reports where the rules fail. No rebuild of extraction.

## Slices (each runs before the next starts)

1. **Golden set**: generator + labels, dataset `v1`
2. **Runner**: real `extractText` + `parseReport` over the set, with metrics
3. **Baseline**: `evals/results.md` + `evals/baseline.json`, worst failures listed
4. **Fixes**: one entry per failure category, either fixed (with a regression test in `parse.test.ts`) or written off with a reason. Before/after numbers.
5. **LLM experiment**: Haiku vs Sonnet vs rules on the low-confidence subset. Recommendation.
6. **CI**: a GitHub Action that fails when the eval drops below the baseline

## 1. Golden set (`evals/`)

```
evals/
  gen/            generator (TypeScript, run with Playwright's Chromium)
    layouts/      one HTML template per layout
    cases.ts      seeded case builder
  data/v1/
    <case>.json         label
    <case>.pdf          text-layer PDF
    <case>.scan.pdf     image-only PDF (page rendered to PNG, wrapped back in a PDF)
    <case>.photo.jpg    degraded "phone photo"
  DATASET.md      version history, how to regenerate
```

- **Layouts**: four templates that copy the *table structure* of LifeLabs, Dynacare, Quest and LabCorp reports: column order (Test / Result / Flag / Range / Units vs. Test / Result / Units / Range), flag style (H/L, HIGH, an `H` glued to the value), where the range goes, date formats, two-column panels, wrapped test names. No logos or brand names. Each page uses a fictional lab name and the watermark "SYNTHETIC TEST REPORT, NOT A REAL RESULT". Layout ids: `lifelabs`, `dynacare`, `quest`, `labcorp`.
- **Cases**: about 12 per layout (48 cases, 144 files), built from a fixed seed. Each case draws:
  - 8–20 of the 27 markers, with values sampled around and outside the reference range (about 30% flagged)
  - units: SI for the Canadian layouts, US for the American ones, plus some mixed cases (US layout with SI values for a few markers, and vice versa), and some lines with no unit at all
  - look-alikes the parser should skip: Non-HDL, Chol/HDL ratio, free and bioavailable testosterone, MCH/MCHC, MPV, direct bilirubin, urine creatinine and urine glucose, CK-MB, free PSA, eGFR
  - dates: collection, received, reported and printed dates on the same page, in different formats, with the collection date not always first
  - multi-page reports in some cases
- **Photo degradation** (seeded): rotation of ±1–4°, slight perspective, Gaussian blur, lower contrast, uneven lighting gradient, JPEG quality 60–80, downscale to phone resolution
- **Labels** (`<case>.json`):
  ```json
  { "id": "quest-07", "layout": "quest", "dataset": "v1", "sex": "m",
    "drawDate": "2026-03-14",
    "markers": [{ "id": "glucose", "value": 112, "unit": "us" }],
    "lookalikes": ["non-hdl", "free-testosterone"] }
  ```
  `value` is the number as printed, and `unit` is the unit system it's printed in. The SI value is derived from `markers.ts`, so there's one source of truth. If a line has no unit, the label still records which system the value is in.
- **Versioning**: the rendered files are committed (target under 15 MB), so the baseline doesn't drift with Chromium rendering. Any change to the generator or labels bumps to `data/v2/`, and the old version stays put until the baseline moves.
- Synthetic only. Real reports can go later in `evals/data/private/`, which is gitignored. The runner picks them up if they're present.

## 2. Runner (`evals/run.ts`, `npm run eval`)

- Starts the Vite dev server and opens `evals/harness.html` in headless Chromium (the Playwright that's already installed, pinned as a devDependency). The harness imports the real `extractText` and `parseReport` and hands each file to them as a `File`. The OCR assets come from `public/ocr`, as in production.
- The parser runs with the case's `sex`, and with `units` set to the layout's native system, matching what a user would have selected.
- **Scoring per report**, then aggregated:
  - **Marker recall**: labelled markers found / labelled markers
  - **Marker precision**: correct marker ids / extracted markers. False hits get their own count, split into those triggered by a look-alike line and others.
  - **Value accuracy**: of the markers found, the share where `raw` equals the printed value (within 1e-6), and the share where `si` is within 0.5% of the label's SI value (the number the user sees)
  - **Unit accuracy**: of the markers found, the share where the unit system matches the label, split into `by: label` vs inferred
  - **Date accuracy**: the share of reports where `date === drawDate`
  - **Runtime**: wall time of `extractText + parseReport` per report (median and p95)
- **Splits**: overall; by method (`pdf-text` / `ocr`); by rendering (text PDF / scanned PDF / photo); by layout
- **Output**: `evals/out/report.json` (per-report detail, gitignored) and a summary table on stdout. `--update-baseline` writes `evals/baseline.json`.

## 3. Baseline and fixes

- `evals/results.md`: dataset version, headline table, the splits, the 10 worst reports with their failing lines (expected vs got), and failures grouped by category (e.g. "range picked as result", "unit from wrong column", "wrong date chosen", "OCR digit slip", "look-alike matched").
- Every category gets one of two outcomes: a fix in `parse.ts` (or a minimal `wordsToLines`/`prepCanvas` tweak if that's where the bug is) with a regression test, or a written reason it's not worth fixing (rare layout, would break other cases, or OCR-only and better handled by user review or the fallback). Before/after numbers go in `results.md`.
- No fitting to the golden set: every fix has to be a general rule that would also hold on a real report.

## 4. LLM fallback experiment

- **Low-confidence signal** (computed from data we already have):
  - fewer than 5 markers found, or
  - 25% or more of found values have their unit inferred (`by: plausible`) or are flagged `check`, or
  - no date found, or
  - OCR mean confidence below 70. This needs one small change to `ocr.ts`: return Tesseract's `data.confidence` as an optional `confidence` on `Extracted`.

  The thresholds get tuned once on the baseline numbers, before any model is called, and are reported along with how many reports they flag and how many failures they catch.
- **Function**: `api/extract.ts` (Vercel, same style as `api/ask.ts`) takes `{ text, units, sex }`, where `text` is the extracted text only, never the file. It calls Claude with a strict output schema: `{ date: string|null, markers: [{ id: enum(27 ids), value: number, unit: "si"|"us", line: string }] }`. The output is validated server-side, and anything that isn't a known id or whose `line` isn't in the input text is dropped. It needs `ANTHROPIC_API_KEY`, and when that's missing it returns 503 the way Ask does.
- **Experiment** (`evals/llm.ts`): calls the same handler locally, on the flagged subset only, for Haiku and Sonnet (current model ids, looked up at run time). It reports the same metrics as the rules (rules / rules+Haiku / rules+Sonnet), plus cost per report from token counts and latency (median and p95). The set is synthetic, so no user data goes anywhere. I'll ask for an Anthropic key through the secure credential form when I get here. Only `api.groq.com` is set up today.
- **Recommendation** in `results.md`. If it ships: an off-by-default checkbox on each upload, worded along the lines of "Send the extracted text (not the file) to Anthropic to double-check the values. Not stored." Plus a README Privacy section update. The review step still applies to every value. If it doesn't ship, the function and checkbox stay out of the app and the experiment code stays in `evals/`.

## 5. CI (`.github/workflows/eval.yml`)

- Runs on push and PR when `src/engine/parse.ts`, `src/features/ocr.ts`, `src/engine/data/markers.ts` or `evals/**` change. Steps: `npm ci`, install Playwright Chromium, `npm run eval -- --check`.
- `--check` fails if any headline metric (overall recall, precision, value, unit, date, plus recall by method) drops more than 0.5 percentage points below `evals/baseline.json`. The tolerance covers floating-point and WASM SIMD differences between machines; the text-PDF split must match exactly. Improvements pass and print a reminder to update the baseline.
- The LLM experiment doesn't run in CI, since it needs a key and costs money.

## Out of scope

Rewriting OCR or the parser, real user uploads, image upload to an LLM, and UI changes beyond the opt-in checkbox (only if it ships).

## Git

Commits authored as `vtalla-hq <vtalla-hq@users.noreply.github.com>` (matching history), no co-author trailers, one or more commits per slice, pushed to `claude/sleepy-einstein-iinf9z`.
