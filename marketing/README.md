# Spotter marketing kit

## What's here

- `spotter-promo-9x16.mp4`: a 21-second vertical promo (1080×1920, 30 fps, H.264). It's cut on a 120 BPM beat from real app screens, using the sample cycle. Before posting, replace the placeholder beat with a trending sound inside TikTok or Reels; platform-licensed sounds get more reach than uploaded audio.
- `promo/`: the source of the video. To rebuild it, run `npm run build && npx vite preview`, then `node marketing/promo/capture.cjs marketing/promo`, then `node marketing/promo/render.cjs "$PWD/marketing/promo"`, then the ffmpeg command in `promo/encode.sh`.
- `public/og.png`: the link-preview card used when someone shares spotterlabs.vercel.app.

### Storyboard

| Time | Beat | On screen |
|---|---|---|
| 0–2.5s | Hook | "POV: your labs came back", then a red counter ticking to **17 flags** |
| 2.5–6s | Meme | "Lab report: Creatinine HIGH" / "You: on creatine". "Lab report: CK 2100 · AST 71" / "You: hit legs tuesday" |
| 6–10s | Product | A phone scrolls the real triage screen to the verdict |
| 10–13.5s | Payoff | Three cards slam in: Act now (hematocrit 55%), Fix or ask (HDL), Expected (creatine and leg day) |
| 13.5–16s | Trust | Sources tab, then Ask: "answered from PubMed" |
| 16–18s | Objection | "Private. Runs in your browser. Free." |
| 18–21s | End card | Logo, the tagline, and the URL |

## What's trending (checked November 2026)

- **"Lab results" reactions and the "TrenTok" backlash.** Steroid content on TikTok has drawn more than 580 million views, and the counter-narrative from lab owners and doctors is about the "worst bloodwork we've ever seen". Spotter fits on the responsible side of that conversation: show what's harmless versus what's dangerous, never how to use anything.
- **Maxxing** (protein-maxxing, creatine-maxxing). The creatine-and-creatinine scare is a perfect, safe hook for the mainstream lifting audience.
- **Longevity and "self-preservation" fitness.** Bloodwork tracking and knowing your markers are rising topics.
- **Higgsfield viral presets** turn one photo into a ready-made effect clip. Current ones include Bullet Time, Earth Zoom, Float Spin, and Fallen Angel. "Viral Cut" style beat-synced edits are still the default format.

## Higgsfield prompt pack

Use image-to-video with an app screenshot or a stock photo of a lifter. Keep clips to 5 seconds and stitch three of them together.

1. **Bullet Time lab reveal.** Input: a photo of a lifter mid-deadlift. Prompt: *"Bullet-time orbit around a muscular lifter frozen mid-deadlift in a dim gym, chalk dust suspended in the air, a glowing red lab report hologram floats beside him reading 'CREATININE HIGH', cinematic, shallow depth of field, 9:16."* Overlay the caption "is it your creatine… or your kidneys?"
2. **Earth Zoom into the phone.** Input: a phone screenshot of the triage verdict (open the app, tap **Try a sample cycle**, and scroll to the verdict). Prompt: *"Camera dives from space through clouds into a gym, then into a phone screen showing a bloodwork app with red, orange and green verdict cards, smooth continuous zoom, 9:16."*
3. **Doctor vs. gym bro split.** Prompt: *"Split screen, left a worried doctor holding a lab printout with red flags, right a calm lifter scrolling his phone; the phone glows and the red flags on the printout turn green one by one, comedic timing, bright lighting, 9:16."*

Keep the end card from the promo (logo, tagline and URL) as the final 3 seconds of every cut.

## Hooks to A/B test (first 1.5 seconds)

- "Your doctor saw high creatinine. You take creatine. Who's right?"
- "17 red flags on my bloodwork. Only 1 actually mattered."
- "POV: you do bloodwork 9 weeks into a cycle" (organic only; see the rules below)
- "Leg day the week of your blood test? Watch your AST."

## Rules for posting

- Never show doses, cycles, sourcing or PCT. Spotter doesn't give them, and the content shouldn't either.
- Paid ads on Meta and TikTok reject steroid and SARM references. Run paid with the creatine, TRT or training angle only. Keep steroid angles to organic posts, and frame them around safety (what to monitor, when to see a doctor).
- Always say "not medical advice" in the caption. For anything in "act now", tell people to see a doctor.

## Captions and hashtags

> Your labs flag lifters for everything. Spotter tells you which flags are your stack and which are a real problem, with the study behind each one. Free, private, runs in your browser. Not medical advice.
> #bloodwork #creatine #trt #gymtok #liftingtips #labresults #mensHealth
