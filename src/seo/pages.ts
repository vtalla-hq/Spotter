/**
 * Static "learn" pages, one per marker and one per compound, generated from the
 * same data the app uses. They're plain HTML (no JS), so search engines and
 * link previews read them, and every page sends people into the app.
 * Pure: returns { path, html } and the sitemap; scripts/build-seo.mjs writes them.
 */
import { CLS, COMP, TRAIN } from "../engine/data/compounds";
import { BYID, M, PANELS } from "../engine/data/markers";
import { SRC } from "../engine/data/sources";
import type { Compound, Dir, Effect, Kind, Marker, Range } from "../engine/types";

export const SITE = "https://spotterlabs.vercel.app";

export interface Page {
  path: string;
  title: string;
  description: string;
  html: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const slug = (s: string, keepParens = false) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, (m) => (keepParens ? " " + m.slice(1, -1) + " " : ""))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const markerPath = (m: Marker) => `/learn/${slug(m.name)}`;
export const compoundPath = (c: Compound) => `/learn/${slug(c.name, true)}-bloodwork`;

const KIND: Record<Kind, { label: string; blurb: string }> = {
  risk: { label: "Real risk", blurb: "worth acting on or asking a doctor about" },
  expected: { label: "Expected effect", blurb: "predictable, but worth knowing" },
  artifact: { label: "Lab artifact", blurb: "shows up on the report, no harm by itself" },
};
const ARROW: Record<Dir, string> = { up: "↑", down: "↓" };

/** Replace [P12] style refs with numbered links, collecting the sources used. */
function cite(text: string, used: string[]): string {
  return esc(text)
    .replace(/\s*\[(P\d+)\]/g, (_, id: string) => {
      if (!SRC[id]) return "";
      if (!used.includes(id)) used.push(id);
      return `<sup><a href="#src-${id}">${used.indexOf(id) + 1}</a></sup>`;
    })
    .trim();
}
const plain = (t: string) => t.replace(/\s*\[P\d+\]/g, "").trim();

function sourcesList(used: string[]): string {
  if (!used.length) return "";
  return `<h2>Sources</h2><ol class="src">${used
    .map((id) => `<li id="src-${id}"><a href="${esc(SRC[id].u)}" rel="noopener">${esc(SRC[id].t)}</a></li>`)
    .join("")}</ol>`;
}

function fmtRange(m: Marker, r: Range): string {
  const [usUnit, f] = m.us;
  const u = (x: string) => (x === "%" ? x : " " + x);
  const si = `${r[0]}–${r[1]}${u(m.unit)}`;
  if (f === 1 && usUnit === m.unit) return si;
  const d = m.dp[1];
  return `${si} (${(r[0] * f).toFixed(d)}–${(r[1] * f).toFixed(d)}${u(usUnit)})`;
}

function rangeText(m: Marker): string {
  const ri = m.ri;
  if (Array.isArray(ri)) return `<p>Typical adult range: <b>${fmtRange(m, ri)}</b>.</p>`;
  return `<p>Typical adult range: men <b>${fmtRange(m, ri.m)}</b>, women <b>${fmtRange(m, ri.f)}</b>.</p>`;
}

const ALL = [...COMP, TRAIN];
const effectsOn = (markerId: string) =>
  ALL.flatMap((c) => c.fx.filter((e) => e.m === markerId).map((e) => ({ c, e }))).sort(
    (a, b) => ["risk", "expected", "artifact"].indexOf(a.e.k) - ["risk", "expected", "artifact"].indexOf(b.e.k),
  );

function layout(p: { path: string; title: string; description: string; body: string; crumbs: [string, string][] }): string {
  const url = SITE + p.path;
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "MedicalWebPage", name: p.title, description: p.description, url, isPartOf: { "@type": "WebSite", name: "Spotter", url: SITE } },
      {
        "@type": "BreadcrumbList",
        itemListElement: p.crumbs.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + path })),
      },
    ],
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${url}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Spotter">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
<style>
:root{--bg:#f6f6f3;--paper:#fff;--ink:#1b1c19;--muted:#66645d;--line:#e4e2db;--ok:#15803d;--warn:#a16207;--risk:#c2410c;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#0d0e0c;--paper:#161714;--ink:#f1efe7;--muted:#a3a094;--line:#2c2e29;--ok:#4ade80;--warn:#facc15;--risk:#fb923c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main,header,footer{max-width:760px;margin:0 auto;padding:0 16px}
header{padding-top:18px;display:flex;justify-content:space-between;align-items:center;gap:12px}
header a{color:var(--ink);text-decoration:none;font-weight:800;letter-spacing:.02em}
nav.crumbs{font-size:13px;color:var(--muted);margin:22px 0 4px}nav.crumbs a{color:var(--muted)}
h1{font-size:clamp(28px,6vw,40px);line-height:1.1;margin:6px 0 12px}h2{font-size:20px;margin:32px 0 10px}
p.lede{font-size:19px;color:var(--muted)}
a{color:inherit}
.cta{display:inline-block;background:var(--ink);color:var(--bg);padding:12px 18px;border-radius:6px;font-weight:700;text-decoration:none;margin:8px 0}
ul.fx{list-style:none;padding:0;margin:0}ul.fx li{background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:12px 14px;margin:8px 0}
.tag{font:700 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;padding:3px 6px;border-radius:4px;border:1px solid currentColor;margin-right:6px;white-space:nowrap}
.k-risk{color:var(--risk)}.k-expected{color:var(--warn)}.k-artifact{color:var(--ok)}
ol.src{font-size:14px;color:var(--muted);padding-left:20px}ol.src li{margin:6px 0}
.grid{columns:2 220px;column-gap:24px;padding-left:18px}.grid li{margin:4px 0;break-inside:avoid}
footer{font-size:13px;color:var(--muted);border-top:1px solid var(--line);margin-top:48px;padding-top:16px;padding-bottom:40px}
</style>
</head>
<body>
<header><a href="/">SPOTTER</a><a class="cta" href="/" style="margin:0;padding:8px 14px;font-size:14px">Check your bloodwork</a></header>
<main>
<nav class="crumbs">${p.crumbs.map(([n, path], i) => (i === p.crumbs.length - 1 ? esc(n) : `<a href="${path}">${esc(n)}</a>`)).join(" / ")}</nav>
${p.body}
</main>
<footer>Spotter is free, runs in your browser, and is not medical advice or a guide to using any drug. If you have chest pain, yellow eyes or skin, dark urine with muscle pain, or sudden swelling or shortness of breath, get urgent care.</footer>
</body>
</html>
`;
}

export function markerPage(m: Marker): Page {
  const used: string[] = [];
  const fx = effectsOn(m.id);
  const item = ({ c, e }: { c: Compound; e: Effect }) =>
    `<li><span class="tag k-${e.k}">${KIND[e.k].label}</span> <b>${c.id === "training" ? esc(c.name) : `<a href="${compoundPath(c)}">${esc(c.name)}</a>`}</b> ${ARROW[e.d]}<br>${cite(e.why, used)}</li>`;
  const up = fx.filter((x) => x.e.d === "up");
  const down = fx.filter((x) => x.e.d === "down");
  const harmless = fx.filter((x) => x.e.k === "artifact").map((x) => x.c.name);
  const title = `High or low ${m.name} in lifters: stack effect or real problem? | Spotter`;
  const description = plain(
    `${m.what} ${harmless.length ? `${harmless.slice(0, 3).join(", ")} can shift it with no harm. ` : ""}See what raises and lowers ${m.name}, the typical range, and when it matters.`,
  ).slice(0, 300);
  const body = `
<p class="eyebrow" style="font:700 12px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0">${esc(PANELS[m.panel])} marker</p>
<h1>${esc(m.name)} for lifters</h1>
<p class="lede">${esc(m.what)}</p>
${rangeText(m)}
<a class="cta" href="/bloodwork/${m.id}">See where your ${esc(m.name)} falls</a>
${up.length ? `<h2>What raises ${esc(m.name)}</h2><ul class="fx">${up.map(item).join("")}</ul>` : ""}
${down.length ? `<h2>What lowers ${esc(m.name)}</h2><ul class="fx">${down.map(item).join("")}</ul>` : ""}
${!fx.length ? `<p>None of the ${COMP.length} compounds Spotter tracks has a known effect on ${esc(m.name)}, so an abnormal result here isn't explained by your stack.</p>` : ""}
<h2>Your stack or a real problem?</h2>
<p>A flag on a standard report doesn't say why. Spotter takes what you're actually taking, when the blood was drawn in your cycle, and whether you trained hard that week, then sorts every flag into <b>act now</b>, <b>fix or ask about</b>, and <b>expected from your stack</b>, with the study behind each call. It's free and your results never leave your browser.</p>
<a class="cta" href="/">Triage your report</a>
${sourcesList(used)}`;
  const path = markerPath(m);
  return { path, title, description, html: layout({ path, title, description, body, crumbs: [["Spotter", "/"], ["Learn", "/learn"], [m.name, path]] }) };
}

export function compoundPage(c: Compound): Page {
  const used: string[] = [];
  const rows = [...c.fx].sort((a, b) => ["risk", "expected", "artifact"].indexOf(a.k) - ["risk", "expected", "artifact"].indexOf(b.k));
  const title = `${c.name} bloodwork: what it does to your labs | Spotter`;
  const markers = [...new Set(c.fx.map((e) => BYID[e.m]?.name).filter(Boolean))];
  const description = (
    markers.length
      ? `How ${c.name} shows up on blood tests: ${markers.slice(0, 5).join(", ")}. Which changes are harmless lab effects and which are real risks, with sources.`
      : `${c.name} has no known effect on standard blood markers. What that means for your bloodwork, with sources.`
  ).slice(0, 300);
  const body = `
<p class="eyebrow" style="font:700 12px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0">${esc(CLS[c.cls].n)}</p>
<h1>${esc(c.name)} and your bloodwork</h1>
${c.aka ? `<p class="lede">Also searched as: ${esc(c.aka)}.</p>` : ""}
${c.note ? `<p>${cite(c.note, used)}</p>` : ""}
${
  rows.length
    ? `<h2>What it does to your labs</h2><ul class="fx">${rows
        .map(
          (e) =>
            `<li><span class="tag k-${e.k}">${KIND[e.k].label}</span> <b><a href="${markerPath(BYID[e.m])}">${esc(BYID[e.m]?.name ?? e.m)}</a></b> ${ARROW[e.d]}<br>${cite(e.why, used)}</li>`,
        )
        .join("")}</ul>
<p style="font-size:14px;color:var(--muted)">${(["risk", "expected", "artifact"] as Kind[]).map((k) => `<b>${KIND[k].label}</b>: ${KIND[k].blurb}`).join(". ")}.</p>`
    : `<p>No known effect on the standard markers Spotter tracks. If something is flagged while you take it, your stack probably doesn't explain it.</p>`
}
<h2>Check your own report</h2>
<p>Add ${esc(c.name)} and anything else you take, upload or paste your lab report, and Spotter tells you which flags are your stack and which need attention. Free, private, nothing uploaded.</p>
<a class="cta" href="/">Triage your report</a>
${sourcesList(used)}`;
  const path = compoundPath(c);
  return { path, title, description, html: layout({ path, title, description, body, crumbs: [["Spotter", "/"], ["Learn", "/learn"], [c.name, path]] }) };
}

export function indexPage(): Page {
  const title = "Lifter bloodwork guide: every marker and compound | Spotter";
  const description = `What ${M.length} blood markers mean for lifters and what ${COMP.length} supplements, TRT, steroids, SARMs, peptides and GLP-1 drugs do to them, with sources.`;
  const byCls = Object.entries(CLS)
    .map(([id, cl]) => {
      const cs = COMP.filter((c) => c.cls === id);
      return cs.length ? `<h2>${esc(cl.n)}</h2><ul class="grid">${cs.map((c) => `<li><a href="${compoundPath(c)}">${esc(c.name)}</a></li>`).join("")}</ul>` : "";
    })
    .join("");
  const body = `
<h1>Bloodwork for lifters</h1>
<p class="lede">${esc(description)}</p>
<a class="cta" href="/">Triage your own report</a>
<h2>Markers</h2>
<ul class="grid">${M.map((m) => `<li><a href="${markerPath(m)}">${esc(m.name)}</a></li>`).join("")}</ul>
${byCls}`;
  return { path: "/learn", title, description, html: layout({ path: "/learn", title, description, body, crumbs: [["Spotter", "/"], ["Learn", "/learn"]] }) };
}

export function allPages(): Page[] {
  return [indexPage(), ...M.map(markerPage), ...COMP.map(compoundPage)];
}

export const APP_ROUTES = ["/", "/health", "/progress", "/ask", "/er", "/sources", ...M.map((m) => `/bloodwork/${m.id}`)];

export function sitemap(pages: Page[], lastmod: string): string {
  const urls = [...APP_ROUTES, ...pages.map((p) => p.path)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${lastmod}</lastmod></url>`).join("\n")}
</urlset>
`;
}

export const robots = () => `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`;

