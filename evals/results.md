# Extraction eval: results

How well does the upload path (`extractText` in `src/features/ocr.ts` → `parseReport` in `src/engine/parse.ts`) pull values out of lab reports? Measured on the synthetic golden set `evals/data/v1` (48 reports × text PDF / scanned PDF / phone photo = 144 runs, 1,730 labelled markers, 471 look-alike rows). See `evals/DATASET.md` and `docs/eval-spec.md`.

```bash
npm run eval                      # about 3.5 min on 4 cores; details in evals/out/summary.md
```

## Baseline (before any parser changes)

| | text PDF | OCR (scan + photo) | all |
|---|---|---|---|
| **End to end** (labelled marker found with the right SI value) | 95.4% | 80.5% (scan 86.4, photo 70.2) | **86.3%** |
| Marker recall | 95.4% | 89.5% | 91.8% |
| Marker precision | 100% | 99.4% | 99.6% |
| Value correct, when found | 100% | 89.9% | 94.0% |
| Wrong value **not** flagged "check this" in review | 0% | 4.7% | 2.8% |
| Unit system correct (where SI ≠ US) | 100% | 98.9% | 99.3% |
| Draw date correct | 77.1% | 69.8% | 72.2% |
| Look-alike false hits | 0 of 184 | 0 of 287 | **0 of 471** |
| Runtime per report, median / p95 | 0.26 s / 0.33 s | 1.8 s / 3.2 s | |

Headlines:

- **Text PDFs are close to solved.** Every marker the parser finds is right (value, unit and SI). The 4.6% it misses are all names it doesn't know (`ALK. PHOSPHATASE`, `T4, FREE`, `IGF I`, `Prostate Specific Ag`) plus one two-column table.
- **Look-alikes aren't a problem.** None of the 471 look-alike rows was taken for a real marker, including when the look-alike sits *above* the real one and when the real one is missing.
- **Dates are the weakest field.** 28% of reports get the wrong draw date, almost always the **birth date**, which then saves the draw under the wrong date.
- **OCR is where values go wrong**, mainly through dropped decimal points (`4.70 H` → `470H`). About half of those are flagged "check this" in review; the other half aren't.
- **Photos are the hardest input:** 84% recall, 83.5% value accuracy, and 7.2% of found values wrong without a flag.
- **Units are a non-issue.** Whenever the unit is on the line it's read correctly (100%). The few unit errors come from OCR mangling the unit and then guessing.

### By method, rendering and layout

| | reports | recall % | precision % | value % | SI value % | unit % (all / read from line) | date % | silent wrong % | look-alike hits | median ms | p95 ms |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **all** | 144 | 91.8 | 99.6 | 94.0 | 94.0 | 99.3 / 100.0 | 72.2 | 2.8 | 0 of 471 | 1467 | 2937 |
| method: pdf-text | 48 | 95.4 | 100.0 | 100.0 | 100.0 | 100.0 / 100.0 | 77.1 | 0.0 | 0 of 184 | 263 | 332 |
| method: ocr | 96 | 89.5 | 99.4 | 89.9 | 89.9 | 98.9 / 100.0 | 69.8 | 4.7 | 0 of 287 | 1761 | 3201 |
| render: pdf | 48 | 95.4 | 100.0 | 100.0 | 100.0 | 100.0 / 100.0 | 77.1 | 0.0 | 0 of 184 | 263 | 332 |
| render: scan | 48 | 92.6 | 99.5 | 93.3 | 93.3 | 99.3 / 100.0 | 77.1 | 3.4 | 0 of 184 | 2550 | 3409 |
| render: photo | 48 | 84.0 | 99.1 | 83.5 | 83.5 | 97.9 / 100.0 | 62.5 | 7.2 | 0 of 103 | 1467 | 1800 |
| layout: dynacare | 36 | 93.4 | 100.0 | 99.3 | 99.3 | 100.0 / 100.0 | 86.1 | 0.7 | 0 of 117 | 1389 | 2791 |
| layout: labcorp | 36 | 87.8 | 99.0 | 93.5 | 93.5 | 98.9 / 100.0 | 61.1 | 3.1 | 0 of 125 | 1515 | 3201 |
| layout: lifelabs | 36 | 98.0 | 100.0 | 92.7 | 92.7 | 98.4 / 100.0 | 100.0 | 3.9 | 0 of 132 | 1239 | 2796 |
| layout: quest | 36 | 87.6 | 99.4 | 90.3 | 90.3 | 100.0 / 100.0 | 41.7 | 3.3 | 0 of 97 | 1633 | 3409 |
| dynacare × pdf | 12 | 94.1 | 100.0 | 100.0 | 100.0 | 100.0 / 100.0 | 100.0 | 0.0 | 0 of 46 | 280 | 441 |
| dynacare × scan | 12 | 94.1 | 100.0 | 99.4 | 99.4 | 100.0 / 100.0 | 100.0 | 0.6 | 0 of 46 | 2641 | 2828 |
| dynacare × photo | 12 | 91.2 | 100.0 | 97.8 | 97.8 | 100.0 / 100.0 | 58.3 | 2.2 | 0 of 25 | 1389 | 1697 |
| labcorp × pdf | 12 | 94.0 | 100.0 | 100.0 | 100.0 | 100.0 / 100.0 | 66.7 | 0.0 | 0 of 50 | 260 | 336 |
| labcorp × scan | 12 | 90.5 | 98.7 | 91.4 | 91.4 | 98.6 / 100.0 | 66.7 | 3.3 | 0 of 50 | 2896 | 3456 |
| labcorp × photo | 12 | 72.7 | 97.3 | 83.3 | 83.3 | 96.7 / 100.0 | 50.0 | 9.7 | 0 of 25 | 1515 | 1761 |
| lifelabs × pdf | 12 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 / 100.0 | 100.0 | 0.0 | 0 of 52 | 255 | 308 |
| lifelabs × scan | 12 | 99.4 | 100.0 | 92.8 | 92.8 | 98.8 / 100.0 | 100.0 | 5.6 | 0 of 52 | 2661 | 2930 |
| lifelabs × photo | 12 | 90.4 | 100.0 | 74.7 | 74.7 | 93.8 / 100.0 | 100.0 | 9.3 | 0 of 28 | 1239 | 1678 |
| quest × pdf | 12 | 92.9 | 100.0 | 100.0 | 100.0 | 100.0 / 100.0 | 41.7 | 0.0 | 0 of 36 | 272 | 281 |
| quest × scan | 12 | 85.3 | 99.3 | 88.7 | 88.7 | 100.0 / 100.0 | 41.7 | 3.8 | 0 of 36 | 2285 | 3758 |
| quest × photo | 12 | 82.7 | 98.8 | 75.3 | 75.3 | 100.0 / 100.0 | 41.7 | 8.6 | 0 of 25 | 1667 | 1949 |

"unit % (all / read from line)": accuracy over all scored markers / over those whose unit came from the line (`by: "label"`). "silent wrong": wrong value and not flagged `check`, as a share of markers found. Runtime is `extractText + parseReport` in headless Chromium on 4 cores, one report at a time, and includes starting the Tesseract worker for every OCR report, as the app does.

## Failure categories

Every problem in the baseline run, grouped. Counts are markers (or reports, for dates).

| | Category | text PDF | OCR | Example | Plan |
|---|---|---|---|---|---|
| A | Name spelling the parser doesn't know | 29 | 35 | `ALK. PHOSPHATASE`, `T4, FREE`, `T4,Free(Direct)`, `IGF I, LC/MS`, `Prostate Specific Ag` | **Fix**: add the spellings as aliases. They're standard lab spellings, not one-offs. |
| B | OCR garbles a name the parser knows | 0 | 32 | `Hemoglobin Alc` (1→l) misses A1c **and** gets read as hemoglobin (5 false hits); `CYSTATINC` | **Fix**: normalise `a1c` OCR confusions (`alc`, `aic`) and the run-together `cystatinc`. |
| C | Two markers on one line (two-column table) | 2 | 4 | `HCT 0.42 L/L 0.40-0.52   HGB 185 H g/L 135-175` → only HCT read | **Fix**: when a second marker name starts after a column gap, split the line there. |
| D | OCR drops the decimal point | 0 | 64 | `TSH 4.70 H` → `470H`; `Potassium 4.4` → `44` | **Partial fix**: when a value with no decimal point is implausible and ÷10 or ÷100 puts it back in a plausible range, use that and keep "check this" on. Where the ×10 value is still plausible (LH 2.7 → 27), nothing in the text can tell them apart; that's left to review / the fallback. |
| E | OCR misreads the digits | 2* | 45 | `47` → `a7`, `556` → `$56`, `277` → `2717`, `7.1` → `7:1` | **Won't fix in the parser**: no general rule recovers a wrong digit. Implausible results are already flagged. (*the 2 text-PDF items are category C.) |
| F | OCR loses or garbles the test name | 0 | 35 | `Testosterone Beoav adabie`, names missing entirely on blurred photos | **Won't fix in the parser**: the name isn't in the text. It feeds the low-confidence signal (few markers found → suggest a better photo / the fallback). |
| G | False hit from a garbled look-alike | 0 | 1 | `Testosterone Beoav adabie 404` (bioavailable) read as total T | **Won't fix**: the exclusion word is destroyed by OCR. It's one case, the value is flagged as implausible, and the user reviews it. |
| I | Wrong draw date | 11 reports | 29 reports | see below | **Fix** the structural cases. 7 OCR-only cases (dates garbled) won't be fixed. |

Date failures in detail (all 11 text-PDF ones are structural, and they repeat in the OCR runs of the same reports, 22 of the 29):

1. **Birth date on the same line as "Collected"** (Quest style, `DOB: 09/15/1997 AGE: 29   Collected: 04/18/2026`): the parser takes the *first* date on a line that mentions collection.
2. **Dates in a labels row with the values on the row below** (LabCorp style, `Date Collected   Date Received …` / `07/10/2026   07/11/2026 …`): the hint and the date are on different lines, so it falls back to the first date on the page, which is the birth date.
3. **`findDate` gives up after an invalid first match**: with a DOB before 1990 first on the line, it returns nothing and never reaches the collection date, so a later "Received" date wins.

Fix: skip dates labelled DOB/birth, take the date that follows the hint word, map a labels row to the values row below by column, and keep looking after an invalid match.

## Worst 10 reports (baseline)


- **lifelabs-11 (photo, ocr)**: 1/12 correct, 0 false hits
  - missed **hemoglobin** (expected 170); line in text: _name not in extracted text_
  - missed **glucose** (expected 4.3); line in text: _name not in extracted text_
  - missed **creatinine** (expected 95); line in text: _name not in extracted text_
  - missed **cystatin** (expected 0.89); line in text: _name not in extracted text_
  - wrong value **urea**: got 85, expected 5.5 (not flagged), from `Urea                                       85                2571                    mmol`
  - missed **bili** (expected 10); line in text: _name not in extracted text_
  - missed **ck** (expected 239); line in text: _name not in extracted text_
  - missed **hdl** (expected 1.28); line in text: _name not in extracted text_
  - missed **lh** (expected 2.2); line in text: _name not in extracted text_
  - wrong value **tsh**: got 461, expected 4.61 (flagged), from `TSH                                      461       "      0.40400                 miu`
  - wrong value **ft4**: got 196, expected 19.6 (flagged), from `Free T4                                  196               100-230                 pmol`
- **labcorp-01 (photo, ocr)**: 1/9 correct, 1 false hits
  - missed **plt** (expected 105); line in text: _name not in extracted text_
  - wrong value **glucose**: got 95, expected 98 (not flagged), from `Glucose                          a                          95 0142026                 moi              70-108`
  - missed **a1c** (expected 5.2); line in text: _name not in extracted text_
  - wrong value **urea**: got 2, expected 12 (not flagged), from `BUN                                2                            13 ow14202¢                 mod               7-20`
  - missed **ck** (expected 283); line in text: _name not in extracted text_
  - missed **tg** (expected 238); line in text: _name not in extracted text_
  - missed **estradiol** (expected 21.4); line in text: _name not in extracted text_
  - missed **ft4** (expected 1.17); line in text: _name not in extracted text_
  - false hit **testo** = 404 from `Testosterone Beoav adabie         404                                                 noi`
  - wrong date: got null, expected 2026-10-05
- **labcorp-07 (photo, ocr)**: 4/12 correct, 0 false hits
  - missed **creatinine** (expected 0.61); line in text: _name not in extracted text_
  - missed **cystatin** (expected 0.52); line in text: _name not in extracted text_
  - missed **bili** (expected 1); line in text: _name not in extracted text_
  - missed **ck** (expected 115); line in text: `Creatine Kinase, Total           us                                                          uL                  40-320`
  - missed **estradiol** (expected 32.8); line in text: _name not in extracted text_
  - wrong value **tsh**: got 4, expected 0.71 (not flagged), from `TSH                           on                                                           uum              0.40-4.00`
  - missed **ft4** (expected 1.4); line in text: `T4 Free(Direct)                140                          1.49 08/26/2025                ng/dL                0.78-1.79`
  - missed **psa** (expected 0.54); line in text: `Prostate Specific Ag             0.54                              0.48 08/26/2025                   ng/mL                  <4.00`
- **quest-02 (photo, ocr)**: 4/11 correct, 0 false hits
  - wrong value **hemoglobin**: got 183, expected 18.3 (flagged), from `HEMOGLOBIN                                                                      183H                      13.5-17.5 g/dL                              EN`
  - wrong value **plt**: got 1131, expected 131 (not flagged), from `PLATELET COUNT                                                             1131L                     150-400 Thousand/ul                   EN`
  - missed **a1c** (expected 5.4); line in text: _name not in extracted text_
  - wrong value **cystatin**: got 48, expected 0.48 (flagged), from `CYSTATIN C                                                                   048L                    0.60-1.00 mg/L                           EN`
  - wrong value **hdl**: got 2, expected 42 (flagged), from `HDL CHOLESTEROL                                        a2                                              31-77 mg/dL                               EN`
  - missed **ft4** (expected 1.22); line in text: `T4, FREE                                                122                                       0.78-1.79 ng/dL                        EN`
  - missed **igf1** (expected 779); line in text: _name not in extracted text_
  - wrong date: got 1998-10-18, expected 2026-02-13
- **labcorp-06 (photo, ocr)**: 2/8 correct, 0 false hits
  - missed **hematocrit** (expected 33.7); line in text: _name not in extracted text_
  - missed **hemoglobin** (expected 13.8); line in text: _name not in extracted text_
  - missed **plt** (expected 307); line in text: _name not in extracted text_
  - missed **potassium** (expected 3.7); line in text: _name not in extracted text_
  - missed **bili** (expected 0.6); line in text: _name not in extracted text_
  - missed **ck** (expected 215); line in text: _name not in extracted text_
  - wrong date: got null, expected 2026-07-10
- **quest-01 (scan, ocr)**: 13/20 correct, 0 false hits
  - wrong value **hematocrit**: got 330, expected 33 (flagged), from `HEMATOCRIT                i                                                          330L                          40.0-52.0 %                                       EN`
  - wrong value **hemoglobin**: got 171, expected 17.1 (flagged), from `HEMOGLOBIN                                                  171                                                     13.5-17.5 g/dL                                    EN`
  - missed **a1c** (expected 5); line in text: _name not in extracted text_
  - missed **cystatin** (expected 0.84); line in text: `CYSTATINC                                              0.84                                              0.60-1.00 mg/L                               EN`
  - wrong value **lh**: got 27, expected 2.7 (not flagged), from `LH                                                                                     27                                       1.5-9.3 mIU/mL              EN`
  - missed **ft4** (expected 1.83); line in text: `T4, FREE                                                                                      1.83 H                0.78-1.79 ng/dL            EN`
  - missed **igf1** (expected 265); line in text: `IGF I, LC/MS                                                                    265                                    100-350 ng/mL             EN`
- **quest-05 (scan, ocr)**: 13/18 correct, 0 false hits
  - wrong value **creatinine**: got 115, expected 1.15 (flagged), from `CREATININE                                                     115                                               0.68-1.24 mg/dL                    EN`
  - wrong value **potassium**: got 45, expected 4.5 (flagged), from `POTASSIUM                                                     45                                                 3.5-5.0 mmol/L                      EN`
  - wrong value **lh**: got 7, expected 7.1 (not flagged), from `LH                                                                           7:1                                                        1.5-9.3 mIU/mL                        EN`
  - missed **ft4** (expected 1.61); line in text: `T4, FREE                                                      1.61                                             0.78-1.79 ng/dL                    EN`
  - missed **igf1** (expected 261); line in text: _name not in extracted text_
  - wrong date: got 1993-03-12, expected 2026-06-23
- **quest-10 (photo, ocr)**: 2/8 correct, 0 false hits
  - missed **hematocrit** (expected 59); line in text: `HEMATOCRIT                                  HOM            400-520 %                   EN`
  - wrong value **bili**: got 0, expected 0.7 (flagged), from `BILIRUBIN, TOTAL                        0                               021.2 mpi                     EN`
  - missed **alt** (expected 38); line in text: _name not in extracted text_
  - missed **lh** (expected 0.2); line in text: _name not in extracted text_
  - missed **igf1** (expected 277); line in text: _name not in extracted text_
  - missed **ferritin** (expected 537); line in text: `FERRITIN                                         SITH              30-400 ng/ml.                    EN`
- **labcorp-08 (photo, ocr)**: 9/14 correct, 0 false hits
  - missed **a1c** (expected 4.6); line in text: _name not in extracted text_
  - wrong value **bili**: got 3, expected 0.3 (not flagged), from `Bilirubin, Total ©                    03                                  0.3 05/20/2026                       mg/dL          02-12`
  - missed **ggt** (expected 26); line in text: `GGT™                                 26                                     23 05/20/2026                         uiL              <70`
  - wrong value **tg**: got 13, expected 113 (not flagged), from `Triglycerides *                       13                                                                              mg/dL           <266`
  - wrong value **lh**: got 29, expected 2.9 (not flagged), from `LH®                                   29                                    2.5 05/20/2026                        miU/mL         15-93`
- **labcorp-10 (scan, ocr)**: 10/14 correct, 0 false hits
  - wrong value **hematocrit**: got 434, expected 43.4 (flagged), from `Hematocrit °*                         434                                   43.0 03/26/2026                       %                36.0-47.0`
  - wrong value **hemoglobin**: got 153, expected 15.3 (flagged), from `Hemoglobin °*                            153                                        13.9 03/26/2026                          g/dL               12.016.0`
  - wrong value **plt**: got 203, expected 293 (not flagged), from `Platelets °*                            203                                                                              X10E3L 150-400`
  - missed **lh** (expected 0.2); line in text: _name not in extracted text_
  - wrong date: got 2003-05-24, expected 2026-06-19

## Caveats

- Synthetic data: the layouts copy table *structure*, and the photos are simulated (keystone, rotation, blur, contrast, light, JPEG). Real phone photos have other problems (curl, glare, shadows of hands, moiré on screens). Real reports go in `evals/data/private/` and are scored separately.
- Some names in the set are deliberately ones the parser doesn't know, because real labs print them that way. Category A is only a finding if those spellings are real, and they are standard on the lab styles they come from.
- OCR results are deterministic for a given Chromium + Tesseract build. CI allows a 0.5-point tolerance on the OCR metrics in case the WASM build differs between machines. Text PDF has to match exactly.
