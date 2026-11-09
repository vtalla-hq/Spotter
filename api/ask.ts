// Vercel function: POST /api/ask
// Streams newline-delimited JSON: {t:"status",m} … then {t:"done",answer,studies,searches} or {t:"error",m}.
import { ask, MAX_QUESTION, type AskContext } from "../src/ask/agent";
import { addStudies, bump, hashKey, type StoreCfg } from "../src/ask/store";
import { SRC } from "../src/engine/data/sources";

export const config = { maxDuration: 60 };

const PER_DAY = Number(process.env.ASK_PER_DAY ?? 15);
const GLOBAL_PER_DAY = Number(process.env.ASK_GLOBAL_PER_DAY ?? 400);

// Spotter's own vetted sources that have PMIDs, offered to the model first
const LIBRARY = Object.values(SRC)
  .filter((s) => s.id.startsWith("PMID"))
  .map((s) => `PMID ${s.id.replace(/\D/g, "")}: ${s.t.slice(0, 150)}`)
  .join("\n");

// fallback limiter when the database isn't configured (per warm instance, best effort)
const mem = new Map<string, number>();

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function POST(req: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(503, { t: "error", m: "Ask isn't switched on yet." });

  let body: { q?: unknown; context?: AskContext };
  try {
    body = await req.json();
  } catch {
    return json(400, { t: "error", m: "Bad request." });
  }
  const q = typeof body.q === "string" ? body.q.trim() : "";
  if (q.length < 4) return json(400, { t: "error", m: "Ask a full question." });
  if (q.length > MAX_QUESTION) return json(400, { t: "error", m: `Keep it under ${MAX_QUESTION} characters.` });

  const ctx = sanitize(body.context);
  const store: StoreCfg | null =
    process.env.SUPABASE_SERVICE_ROLE_KEY && (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)
      ? { url: (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY }
      : null;

  // rate limit: per person (hashed IP) and a global daily cap to bound cost
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const who = await hashKey(ip, process.env.ASK_SALT ?? apiKey.slice(-12));
  try {
    if (store) {
      const [mine, all] = await Promise.all([bump(store, who), bump(store, "global")]);
      if (mine > PER_DAY) return json(429, { t: "error", m: `That's ${PER_DAY} questions today. Come back tomorrow.` });
      if (all > GLOBAL_PER_DAY) return json(429, { t: "error", m: "Ask is at its daily limit. Try again tomorrow." });
    } else {
      const day = new Date().toISOString().slice(0, 10);
      const k = day + who;
      const n = (mem.get(k) ?? 0) + 1;
      mem.set(k, n);
      if (n > PER_DAY) return json(429, { t: "error", m: `That's ${PER_DAY} questions today. Come back tomorrow.` });
    }
  } catch {
    /* if the limiter is down, still answer */
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: unknown) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const res = await ask(q, {
          apiKey,
          model: process.env.ASK_MODEL,
          context: ctx,
          library: LIBRARY,
          ncbiKey: process.env.NCBI_API_KEY,
          onStatus: (m) => send({ t: "status", m }),
        });
        if (store) await addStudies(store, res.studies).catch(() => {});
        send({ t: "done", ...res, studies: res.studies.map(({ abstract: _a, ...s }) => s) });
      } catch (e) {
        console.error(e);
        send({ t: "error", m: "Couldn't answer that right now. Try again in a minute." });
      }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}

function sanitize(c: any): AskContext | undefined {
  if (!c || typeof c !== "object") return undefined;
  const strs = (a: unknown, n: number) =>
    Array.isArray(a) ? a.filter((x) => typeof x === "string").slice(0, n).map((x) => x.slice(0, 60)) : undefined;
  return {
    sex: c.sex === "f" ? "f" : c.sex === "m" ? "m" : undefined,
    stack: strs(c.stack, 20),
    phase: typeof c.phase === "string" ? c.phase.slice(0, 60) : undefined,
    flags: strs(c.flags, 20),
  };
}
