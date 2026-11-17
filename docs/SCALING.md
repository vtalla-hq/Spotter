# Scaling Spotter

Spotter is mostly a static site. Triage, OCR and charts run in the browser, so 10 users and 100,000 users cost about the same. Only four things grow with traffic. They're listed below in the order you'll hit them.

## 1. Signup emails (the first wall)

Supabase's built-in email sender is for testing. It sends only a few emails an hour, so a post that takes off will strand most of the people trying to sign up at "check your email".

**Fix before any launch:** in Supabase → Authentication → SMTP, plug in a real sender (Resend, Postmark or SES). It takes about 10 minutes. Then raise the email rate limit under Authentication → Rate Limits.

## 2. Supabase free tier

- **Pausing:** free projects pause after a week with no activity. Once there's steady traffic that stops mattering, but a pause before launch turns off accounts and Ask's library. Upgrade to Pro ($25/mo) once accounts matter.
- **Storage:** each user is one encrypted row, capped at 512 KB, and a real vault is around 5–30 KB. The 500 MB free database holds tens of thousands of users.
- **Auth:** the free plan covers a large number of monthly active users. Accounts are optional anyway, so most visitors never touch it.

## 3. Ask (the only per-use cost)

Rough cost per question on `claude-haiku-5-5` ($0.10 / $0.50 per million input/output tokens): about 3–5 model turns, about 20–40k input tokens (much of it read from cache), and about 1–2k output tokens. That works out to **well under a cent per question**. The default global cap of 400 questions a day is therefore only a few dollars a day.

- Check the real numbers in the logs: filter Vercel logs on `"ev":"ask"` and sum `input`, `cacheRead` and `output`.
- Once a week of logs confirms the cost, raise `ASK_GLOBAL_PER_DAY`. Keep a monthly spend limit set in the Anthropic console as the backstop.
- Set `NCBI_API_KEY`. PubMed allows 3 requests a second without a key and 10 with one, and each question makes 2–6 requests. The in-memory cache and retries absorb bursts, but not sustained load.
- Watch Anthropic's rate limits for your account tier. Retries handle short spikes; at sustained high volume, request a tier increase.

## 4. Vercel

- **Hobby is for non-commercial use.** Move to Pro before adding ads, affiliate links or paid features.
- **Bandwidth:** a first visit is about 100 KB of JS plus fonts. OCR users download about 4 MB once, and now cache it for good. Static pages and the learn guide are cached at the edge.
- **Functions:** only `/api/ask` runs server-side, with a 60-second limit. Each question takes a few seconds of streaming.

## Growth levers already built

| Lever | Where | What to do next |
|---|---|---|
| SEO guide: 86 static pages, one per marker and compound | `/learn`, `src/seo/pages.ts` | Submit `https://spotterlabs.vercel.app/sitemap.xml` in Google Search Console. Pages target searches like "high hematocrit on TRT" and "creatine creatinine". |
| Link previews | `public/og.png`, meta tags in `index.html` | Nothing to do. Every shared link now shows a card. |
| Share card and Doctor sheet | in-app | These are the built-in viral loops. Feature them in content. |
| Installable app | `public/manifest.webmanifest` | People can add it to their home screen, which helps bring them back for their next draw. |
| Promo video and prompt pack | `marketing/` | Post three hooks, keep whichever wins, and remake it with Higgsfield. |
| Analytics milestones | `src/features/analytics.ts` | Track `results_analyzed` → `draw_saved` → `returned_with_second_draw`. That's the retention funnel. |

## Next things worth building

1. **Error monitoring** (Sentry, or Vercel's built-in) on the client and on `/api/ask`. You can't see OCR or parser failures today, and those are where real reports break.
2. **Parser feedback loop.** When someone corrects a value on the review screen, count which marker and lab format failed (no values, just the marker id and a format hash). That shows which labs to fix first.
3. **Answer cache for common Ask questions.** The suggested-question chips are fixed text, so their answers could be cached for a day. This is safe because the text is ours, not the user's.
4. **Offline support.** A service worker would cache the app shell, since triage works with no network.
5. **Uptime check** on `/` and on `/api/ask` with a canned question (free with Better Stack or UptimeRobot).
