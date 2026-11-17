/**
 * fetch with retries for the upstreams Ask depends on (Anthropic, NCBI).
 * Retries rate limits (429), overload (529) and other 5xx, and network errors,
 * with jittered exponential backoff that honours Retry-After. Anything else
 * (400s) is returned to the caller untouched.
 */

type Fetch = typeof fetch;

export interface RetryOpts {
  /** total attempts, including the first (default 3) */
  tries?: number;
  /** first backoff in ms (default 600) */
  baseMs?: number;
  /** never wait longer than this between attempts (default 8000) */
  maxWaitMs?: number;
  fetch?: Fetch;
  sleep?: (ms: number) => Promise<void>;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const retryable = (status: number) => status === 429 || status === 408 || status >= 500;

/** Parse Retry-After (seconds or an HTTP date) into ms, or null. */
export function retryAfterMs(h: string | null, now = Date.now()): number | null {
  if (!h) return null;
  const s = Number(h);
  if (Number.isFinite(s)) return Math.max(0, s * 1000);
  const t = Date.parse(h);
  return Number.isFinite(t) ? Math.max(0, t - now) : null;
}

export async function fetchRetry(url: string, init: RequestInit | undefined, o: RetryOpts = {}): Promise<Response> {
  const f = o.fetch ?? fetch;
  const sleep = o.sleep ?? wait;
  const tries = Math.max(1, o.tries ?? 3);
  const base = o.baseMs ?? 600;
  const cap = o.maxWaitMs ?? 8000;
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    const final = i === tries - 1;
    try {
      const r = await f(url, init);
      if (r.ok || !retryable(r.status) || final || r.headers?.get?.("x-should-retry") === "false") return r;
      const backoff = base * 2 ** i * (0.75 + Math.random() * 0.5);
      await sleep(Math.min(cap, retryAfterMs(r.headers?.get?.("retry-after") ?? null) ?? backoff));
    } catch (e) {
      lastErr = e;
      if (final) throw e;
      await sleep(Math.min(cap, base * 2 ** i));
    }
  }
  throw lastErr ?? new Error("fetchRetry: no attempts");
}
