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

/** Hash an IP with a server secret so the rate-limit table never holds raw IPs. */
export async function hashKey(ip: string, secret: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret + "|" + ip));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}
