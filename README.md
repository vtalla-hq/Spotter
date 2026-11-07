# Spotter

**Bloodwork triage for lifters. Is it your stack, or is it a problem?**

Standard lab reports flag lifters for everything: high creatinine from creatine, sky-high CK and AST after a heavy week, suppressed LH on a cycle. Spotter takes what you're actually taking and sorts every flag into:

- **Act now**: thresholds that matter whatever the cause (for example, hematocrit at or above 54%, or bilirubin more than double the limit)
- **Fix or ask about**: real harm from your stack, or something your stack doesn't explain
- **Expected from your stack**: lab artifacts and predictable effects you shouldn't panic over

## Features

- Stack picker covering supplements, TRT, injectable and oral steroids, SARMs, GH secretagogues, GLP-1 drugs, repair peptides and thyroid hormone
- 25 lifter-relevant markers with typical adult ranges, SI/US units and sex-specific ranges
- Per-marker distribution curves and estimated percentiles
- Paste-a-report parser for LifeLabs, Dynacare and hospital portal text
- Pre-draw checklist and "test these next" suggestions based on your stack
- **Health check**: a stack gap check (tests and habits your stack calls for), combo warnings for stacks that double up on the same harm, and supplements and habits rated Proven, Weak evidence or Avoid
- 30 cited sources (PubMed, guidelines, regulators). Every effect and cutoff links to one

## Privacy

Everything runs in your browser. Results are saved only to your browser's local storage and never leave your device.

## Not medical advice

Spotter is an educational tool. It does not give doses, cycles or PCT protocols. Many listed compounds are unapproved or have little human safety data. See a doctor about anything flagged.

## Running it

It's a single static `index.html` with no build step. Open it in a browser, or deploy to any static host (Vercel: Framework Preset "Other", no build command).
