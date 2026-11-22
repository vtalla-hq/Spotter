/**
 * Extraction eval runner. Serves the app with Vite, opens evals/harness.html in
 * headless Chromium and runs the real extractText + parseReport on every file in
 * the golden set, then scores against the labels.
 *
 *   npm run eval                       full run, summary to stdout + evals/out/
 *   npm run eval -- --only quest-0     subset by id prefix
 *   npm run eval -- --render pdf       one rendering (pdf | scan | photo)
 *   npm run eval -- --update-baseline  write evals/baseline.json
 *   npm run eval -- --check            fail if below evals/baseline.json
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { DATASET, NAMES, type Label } from "./gen/cases";
import { aggregate, endToEnd, RENDERS, score, type Agg, type Render, type ReportScore, type RunOutput } from "./score";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "evals", "out");
const arg = (k: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const flag = (k: string) => process.argv.includes(k);
const only = arg("--only");
const onlyRender = arg("--render") as Render | null;
const jobs = Number(arg("--jobs") ?? 1);
const FILE: Record<Render, string> = { pdf: ".pdf", scan: ".scan.pdf", photo: ".photo.jpg" };

/** Headline metrics guarded by CI. */
export const GUARDED = ["recall", "precision", "value", "si", "unit", "date"] as const;
const TOL_PP = 0.5;

function loadSet(dir: string): Label[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Label)
    .filter((l) => !only || l.id.startsWith(only));
}

const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : "–");
function table(rows: [string, Agg][]): string {
  const head = "| | reports | recall % | precision % | value % | SI value % | unit % (all / read from line) | date % | silent wrong % | look-alike hits | median ms | p95 ms |\n|---|---|---|---|---|---|---|---|---|---|---|---|";
  return (
    head +
    "\n" +
    rows
      .map(
        ([k, a]) =>
          `| ${k} | ${a.reports} | ${f1(a.recall)} | ${f1(a.precision)} | ${f1(a.value)} | ${f1(a.si)} | ${f1(a.unit)} / ${f1(a.unitLabelled)} | ${f1(a.date)} | ${f1(a.silent)} | ${a.lookalikeHits} of ${a.lookalikeRows} | ${Math.round(a.msMedian)} | ${Math.round(a.msP95)} |`,
      )
      .join("\n")
  );
}

export function groups(scores: ReportScore[]): [string, Agg][] {
  const by = (k: string, f: (r: ReportScore) => boolean): [string, Agg] => [k, aggregate(scores.filter(f))];
  const out: [string, Agg][] = [by("**all**", () => true)];
  for (const m of ["pdf-text", "ocr"]) out.push(by(`method: ${m}`, (r) => r.method === m));
  for (const r of RENDERS) out.push(by(`render: ${r}`, (x) => x.render === r));
  for (const l of [...new Set(scores.map((s) => s.layout))]) out.push(by(`layout: ${l}`, (r) => r.layout === l));
  for (const l of [...new Set(scores.map((s) => s.layout))])
    for (const r of RENDERS) out.push(by(`${l} × ${r}`, (x) => x.layout === l && x.render === r));
  return out.filter(([, a]) => a.reports > 0);
}

function worst(scores: ReportScore[], n: number): string {
  const bad = (r: ReportScore) => r.expected - r.siOk + r.fp + (r.dateOk ? 0 : 1);
  return [...scores]
    .sort((a, b) => bad(b) - bad(a))
    .slice(0, n)
    .map((r) => {
      const lines = r.problems.map((p) => {
        switch (p.kind) {
          case "missed":
            return `  - missed **${p.id}** (expected ${p.expected}); line in text: ${p.textLine ? "`" + p.textLine + "`" : "_name not in extracted text_"}`;
          case "value":
            return `  - wrong value **${p.id}**: got ${p.got}, expected ${p.expected}${p.flagged ? " (flagged)" : " (not flagged)"}, from \`${p.line}\``;
          case "unit":
            return `  - wrong unit **${p.id}**: got ${p.got} (${p.by}), expected ${p.expected}, from \`${p.line}\``;
          case "false-hit":
            return `  - false hit **${p.id}** = ${p.got}${p.lookalike ? ` (look-alike: ${p.lookalike})` : ""} from \`${p.line}\``;
          case "date":
            return `  - wrong date: got ${p.got}, expected ${p.expected}`;
        }
      });
      return `- **${r.id} (${r.render}, ${r.method})**: ${r.siOk}/${r.expected} correct, ${r.fp} false hits\n${lines.join("\n")}`;
    })
    .join("\n");
}

function problemCounts(scores: ReportScore[]): string {
  const c = new Map<string, number>();
  for (const r of scores)
    for (const p of r.problems) {
      const k = `${p.kind}${"id" in p ? ` ${p.id}` : ""} [${r.layout}/${r.render}]`;
      c.set(k, (c.get(k) ?? 0) + 1);
    }
  return [...c.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `| ${k} | ${n} |`)
    .join("\n");
}

async function main() {
  execFileSync("node", ["scripts/copy-ocr-assets.mjs"], { cwd: ROOT, stdio: "ignore" });
  const server = await createServer({ root: ROOT, logLevel: "error", server: { port: 0 }, configFile: join(ROOT, "vite.config.ts") });
  await server.listen();
  const base = server.resolvedUrls!.local[0].replace(/\/$/, "");
  const browser = await chromium.launch();

  const sets: { name: string; dir: string; urlDir: string; labels: Label[] }[] = [
    { name: DATASET, dir: join(ROOT, "evals/data", DATASET), urlDir: `/evals/data/${DATASET}`, labels: [] },
    { name: "private", dir: join(ROOT, "evals/data/private"), urlDir: "/evals/data/private", labels: [] },
  ];
  for (const s of sets) s.labels = loadSet(s.dir);

  const results: Record<string, { scores: ReportScore[]; raw: Record<string, RunOutput> }> = {};
  try {
    for (const set of sets) {
      if (!set.labels.length) continue;
      const tasks: { label: Label; render: Render }[] = [];
      for (const label of set.labels)
        for (const render of RENDERS) {
          if (onlyRender && render !== onlyRender) continue;
          if (existsSync(join(set.dir, label.id + FILE[render]))) tasks.push({ label, render });
        }
      const scores: ReportScore[] = [];
      const raw: Record<string, RunOutput> = {};
      let next = 0;
      const worker = async () => {
        const page = await browser.newPage();
        page.setDefaultTimeout(180_000);
        await page.goto(`${base}/evals/harness.html`);
        await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready === true);
        while (next < tasks.length) {
          const { label, render } = tasks[next++];
          const url = `${set.urlDir}/${label.id}${FILE[render]}`;
          const out = (await page.evaluate(
            ([u, o]) => (window as any).runOne(u, o),
            [url, { units: label.units, sex: label.sex }] as const,
          )) as RunOutput;
          raw[`${label.id}:${render}`] = out;
          const s = score(label, render, out, NAMES[label.layout] ?? {});
          scores.push(s);
          process.stdout.write(`${label.id}:${render} ${s.siOk}/${s.expected} fp=${s.fp} date=${s.dateOk ? "ok" : "x"} ${out.ms}ms\n`);
        }
        await page.close();
      };
      await Promise.all(Array.from({ length: jobs }, worker));
      scores.sort((a, b) => (a.id + a.render).localeCompare(b.id + b.render));
      results[set.name] = { scores, raw };
    }
  } finally {
    await browser.close();
    await server.close();
  }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "report.json"), JSON.stringify(results, null, 1));
  let md = "";
  for (const [name, { scores }] of Object.entries(results)) {
    md += `## ${name}\n\nEnd to end (labelled markers extracted with the right SI value): **${f1(endToEnd(scores))}%**\n\n${table(groups(scores))}\n\n`;
    md += `### Worst reports\n\n${worst(scores, 12)}\n\n### Problem counts\n\n| problem [layout/render] | n |\n|---|---|\n${problemCounts(scores)}\n\n`;
  }
  writeFileSync(join(OUT, "summary.md"), md);
  const main = results[DATASET]?.scores ?? [];
  console.log("\n" + table(groups(main).slice(0, 9 + 4)));
  console.log(`\nend to end: ${f1(endToEnd(main))}%   details: evals/out/summary.md`);

  // baseline
  const metrics = (rs: ReportScore[]) => {
    const pick = (a: Agg) => Object.fromEntries(GUARDED.map((k) => [k, +a[k].toFixed(2)]));
    return {
      overall: pick(aggregate(rs)),
      "method:pdf-text": pick(aggregate(rs.filter((r) => r.method === "pdf-text"))),
      "method:ocr": pick(aggregate(rs.filter((r) => r.method === "ocr"))),
      endToEnd: +endToEnd(rs).toFixed(2),
    };
  };
  const full = !only && !onlyRender;
  const bpath = join(ROOT, "evals", "baseline.json");
  if (flag("--update-baseline")) {
    if (!full) throw new Error("--update-baseline needs a full run");
    writeFileSync(bpath, JSON.stringify({ dataset: DATASET, tolerancePP: TOL_PP, ...metrics(main) }, null, 2) + "\n");
    console.log("baseline written");
  }
  if (flag("--check")) {
    if (!full) throw new Error("--check needs a full run");
    const b = JSON.parse(readFileSync(bpath, "utf8"));
    const now = metrics(main) as Record<string, any>;
    const fails: string[] = [];
    const better: string[] = [];
    for (const g of ["overall", "method:pdf-text", "method:ocr"]) {
      // the text-PDF path is deterministic, so it must match exactly
      const tol = g === "method:pdf-text" ? 1e-9 : b.tolerancePP;
      for (const k of GUARDED) {
        if (now[g][k] < b[g][k] - tol) fails.push(`${g} ${k}: ${now[g][k]} < baseline ${b[g][k]}`);
        else if (now[g][k] > b[g][k] + tol) better.push(`${g} ${k}: ${now[g][k]} > baseline ${b[g][k]}`);
      }
    }
    if (better.length) console.log(`Improved, so update the baseline (npm run eval -- --update-baseline):\n  ${better.join("\n  ")}`);
    if (fails.length) {
      console.error(`Accuracy dropped below the baseline:\n  ${fails.join("\n  ")}`);
      process.exit(1);
    }
    console.log("At or above baseline.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
