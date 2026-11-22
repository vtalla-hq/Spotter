# Golden set

Synthetic lab reports for measuring upload extraction (`src/features/ocr.ts` → `src/engine/parse.ts`). Every value, name and number is generated. None of it comes from a real person or report.

## v1 (current)

48 cases (12 per layout), each rendered three ways:

| File | What it exercises |
|---|---|
| `<id>.pdf` | text-layer PDF → pdf.js row rebuild |
| `<id>.scan.pdf` | image-only PDF (200 dpi JPEG, ±0.6° skew, speckle) → Tesseract |
| `<id>.photo.jpg` | page 1 as a phone photo: keystone, 1–4° rotation, blur, low contrast, uneven light, JPEG 60–80 → Tesseract |
| `<id>.json` | labels |

Layouts copy the table structure of four common report styles, with fictional lab names and a watermark:

- `lifelabs`: Test / Result / Flag / Range / Units, ISO dates, SI, some rows with no unit
- `dynacare`: caps monospace, flag glued to the result, `dd-MON-yyyy` dates, day-first DOB, sometimes a two-column CBC
- `quest`: In Range / Out Of Range columns, units only inside the reference range, US dates
- `labcorp`: a lab-code superscript after each test name, a previous-result column with its own date, dates in a labels row with the values on the row below, US units

Mix (seed `20261122`): 674 labelled markers, about 30% outside the range, 8 `<0.2` LH results, 23 rows with no unit, 6 cases mixing SI and US, 184 look-alike rows, half placed above the real marker and printed whether or not it is present (Non-HDL, Chol/HDL ratio, MCH/MCHC/MPV, free and bioavailable testosterone, eGFR, direct bilirubin, CK-MB, free PSA, urine creatinine/glucose/ACR), 25 two-page reports. Every page prints DOB, collected, received and reported dates (lifelabs adds printed).

### Label format

```json
{ "id": "quest-07", "dataset": "v1", "layout": "quest", "sex": "m", "units": "us",
  "drawDate": "2026-03-14",
  "markers": [{ "id": "glucose", "value": 112, "unit": "us", "page": 1 }],
  "lookalikes": [{ "key": "non-hdl", "page": 1 }], "photoPages": 1 }
```

`value` is the number as printed (`<0.2` is labelled `0.2`). `unit` is the unit system it's printed in, even when the line shows no unit. The photo shows page 1 only, so photo scoring uses only the `page: 1` markers.

## Regenerating

```bash
npx tsx evals/gen/render.ts
```

Labels are deterministic. PDF and JPEG bytes can differ between Chromium versions, which is why the rendered files are committed. Any change to the generator or labels must go in a new `data/vN/`, not over `v1`.

## Real reports

Put your own reports in `evals/data/private/` (gitignored), each with a `<name>.json` label in the same format. The runner scores them separately.
