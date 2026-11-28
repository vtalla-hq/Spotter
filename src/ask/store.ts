import type { Study } from "./pubmed";

/**
 * Server-side Supabase calls for Ask, made with the service key (never sent
 * to the browser). Two jobs: a daily rate limit, and the shared study library
 * that grows as people ask questions. Questions themselves are never stored.
 */

type Fetch = typeof fetch;

export interface StoreCfg {
  url: string;
  serviceKey: string;
  fetch?: Fetch;
}

const headers = (c: StoreCfg) => ({
  apikey: c.serviceKey,
  authorization: `Bearer ${c.serviceKey}`,
  "content-type": "application/json",
});

/** Count one use against a key for today; returns today's total. */
export async function bump(c: StoreCfg, key: string): Promise<number> {
  const f = c.fetch ?? fetch;
  const r = await f(`${c.url}/rest/v1/rpc/ask_bump`, { method: "POST", headers: headers(c), body: JSON.stringify({ k: key }) });
  if (!r.ok) throw new Error("rate limit store " + r.status);
  return Number(await r.json());
}

/** Add cited studies to the shared library, counting how often each gets cited. */
export async function addStudies(c: StoreCfg, studies: Study[]): Promise<void> {
  if (!studies.length) return;
  const f = c.fetch ?? fetch;
  const rows = studies.map((s) => ({ pmid: s.pmid, title: s.title, journal: s.journal, year: s.year, types: s.types, url: s.url }));
  const r = await f(`${c.url}/rest/v1/rpc/add_studies`, { method: "POST", headers: headers(c), body: JSON.stringify({ rows }) });
  if (!r.ok) throw new Error("library store " + r.status);
}

const STOP = new Set(
  "does doing what which when where with that this from have will about after before there their they them your into more than been also much many should could would make makes made over under some really safe good long term blood level levels people adults healthy effect effects affect".split(" "),
);

/** Content words of a question, safe to put in a tsquery (letters and digits only). */
export function terms(question: string): string[] {
  const words = (question.toLowerCase().match(/[a-z][a-z0-9-]*/g) ?? []).map((w) => w.replace(/-/g, ""));
  return [...new Set(words.filter((w) => w.length >= 4 && !STOP.has(w)))].slice(0, 8);
}

/** Best library matches: titles hitting the most question terms (at least two when there are two), most cited first. */
export function rankStudies<T extends { title: string; cited?: number }>(rows: T[], ts: string[], max = 5): T[] {
  const stems = ts.map((t) => (t.length > 5 ? t.slice(0, -2) : t)); // kidneys ~ kidney, steroids ~ steroid
  const need = Math.min(2, stems.length);
  return rows
    .map((r) => ({ r, n: stems.filter((s) => r.title.toLowerCase().includes(s)).length }))
    .filter((x) => x.n >= need)
    .sort((a, b) => b.n - a.n || (b.r.cited ?? 0) - (a.r.cited ?? 0))
    .slice(0, max)
    .map((x) => x.r);
}

/**
 * Studies already in the shared library that look relevant to a question: ones earlier
 * answers cited, and ones added by the offline, human-approved library builder
 * (github.com/vtalla-hq/agent-orchestrator). Ask still has to read an abstract to cite it.
 */
export async function findStudies(c: StoreCfg, question: string, max = 5): Promise<Study[]> {
  const ts = terms(question);
  if (!ts.length) return [];
  const f = c.fetch ?? fetch;
  const q = new URLSearchParams({
    select: "pmid,title,journal,year,types,url,cited",
    title: `fts(english).${ts.join(" | ")}`,
    order: "cited.desc",
    limit: "50",
  });
  const r = await f(`${c.url}/rest/v1/studies?${q}`, { headers: headers(c), signal: AbortSignal.timeout(2500) });
  if (!r.ok) throw new Error("library read " + r.status);
  return rankStudies((await r.json()) as (Study & { cited: number })[], ts, max).map(({ cited: _c, ...s }) => s);
}

/** Hash an IP with a server secret so the rate-limit table never holds raw IPs. */
export async function hashKey(ip: string, secret: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret + "|" + ip));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}
