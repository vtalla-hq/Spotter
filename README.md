# Spotter

**Bloodwork triage for lifters. Is it your stack, or is it a problem?**

Live: [spotterlabs.vercel.app](https://spotterlabs.vercel.app)

Standard lab reports flag lifters for everything: high creatinine from creatine, sky-high CK and AST after a heavy week, suppressed LH on a cycle. Spotter takes what you're actually taking and sorts every flag into:

- **Act now**: thresholds that matter whatever the cause (for example, hematocrit at or above 54%, or bilirubin more than double the limit)
- **Fix or ask about**: real harm from your stack, or something your stack doesn't explain
- **Expected from your stack**: lab artifacts and predictable effects you shouldn't panic over

## Features

- **Upload your report**: drop in a lab PDF or a phone photo. PDFs are read from their text layer, rebuilding table rows from word positions; scans and photos go through OCR (Tesseract, run in the browser). The parser finds each marker, skips look-alikes (Non-HDL, free testosterone, MCHC, urine tests), takes the result instead of the reference range, reads the unit off the line or infers it from what's plausible, fixes OCR slips, and finds the collection date. You review every value before it's used.
- **Progress**: save each draw by date. An overview of every marker you track, a detailed chart with cycle phases shaded, a projection of when a trend crosses a line ("at this rate your hematocrit hits 54% around Dec 14"), recovery against your own pre-cycle baseline, and what changed since the last draw.
- **Accounts**: sign in to see your progress on any device, end-to-end encrypted (see below).
- 58 compounds: supplements, TRT, injectable and oral steroids, prohormones, SARMs and research chems, GH and secretagogues, GLP-1 drugs, peptides, ancillaries, fat burners, and other drugs lifters use
- 27 lifter-relevant markers with typical adult ranges, SI/US units and sex-specific ranges, per-marker distribution curves and estimated percentiles
- **Health check**: stack gap check, combo warnings, and supplements and habits rated Proven, Weak evidence or Avoid
- **Load map** and **organ strain scores** (0–100 per system, combining what your stack is known to do with what your bloodwork confirms)
- **Cycle timeline**, **Is your gear real?**, **Heart strain**, **Kidney score** (CKD-EPI 2021 with creatinine alone and with cystatin C)
- **Doctor sheet**, **ER signs** and a **share card** (counts only, no values)
- 67 cited sources (PubMed, guidelines, regulators). Every effect and cutoff links to one

## How it's built

Vite + React + TypeScript. The rules engine in `src/engine` is pure TypeScript with no DOM or storage access: every rule takes the user's state as a context object, so the same code runs in the browser and in the tests.

```
src/engine/       rules engine (pure)
  data/           markers, compounds, sources, actions, red flags
  triage.ts       flagging and cause attribution, cycle-phase aware
  health.ts       gear check, heart, eGFR, gaps, combos, organ strain
  parse.ts        lab report parser (text, PDF text, OCR output)
  trends.ts       draw series, linear fit, threshold projections, recovery
  vault.ts        AES-GCM encryption and draw merging for accounts
src/features/     OCR/PDF extraction, analytics, account client
src/ui/           React components
```

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # 149 unit tests (Vitest)
npm run build
```

## Privacy

Everything runs in your browser and is saved to local storage. Uploaded reports are read on your device: the OCR engine and English model are served from this site (`scripts/copy-ocr-assets.mjs`), so nothing goes to a third party. Analytics are cookieless Vercel Web Analytics and never include values or what you take.

## Accounts (optional)

Sign in with email and password to see your progress on any device. The password does double duty: Supabase checks it to sign you in, and the browser also derives an encryption key from it (PBKDF2-SHA256, 600k iterations) and seals everything with AES-256-GCM before upload. The server only stores ciphertext, and row-level security limits each user to their own row. Draws from every device are merged by id; signed-in changes save automatically a few seconds after you make them. Because the password is the key, resetting it would lose what's saved in the account (what's in the browser is kept).

Off until configured:

1. Create a free Supabase project and run `supabase/schema.sql` in its SQL editor.
2. In Supabase → Authentication → URL Configuration, set the site URL to `https://spotterlabs.vercel.app` and add `https://spotterlabs.vercel.app/**` as a redirect URL (used by the confirmation email).
3. In Vercel → Settings → Environment Variables, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Supabase → Project Settings → API), then redeploy.

## Analytics

Page views per tab, plus milestones counted once per session: `results_analyzed`, `report_imported`, `report_pdf` / `report_ocr`, `draw_saved`, `returned_with_second_draw`, `account_created`, `signed_in`. Custom events need Vercel Pro, so each milestone is also sent as a virtual page view under `/_m/…`, which shows up in the Pages panel on the free plan.

## Not medical advice

Spotter is an educational tool. It does not give doses, cycles or PCT protocols. Many listed compounds are unapproved or have little human safety data. See a doctor about anything flagged.
