/**
 * Tiny in-memory LRU with a TTL. Lives as long as a warm server instance, so
 * popular PubMed searches and abstracts are fetched once per instance instead
 * of once per question. Only public PubMed data goes in here, never questions.
 */
export class TtlCache<V> {
  private m = new Map<string, { v: V; exp: number }>();
  hits = 0;
  misses = 0;
  constructor(
    private max = 500,
    private ttlMs = 6 * 3600_000,
    private now: () => number = Date.now,
  ) {}

  get(k: string): V | undefined {
    const e = this.m.get(k);
    if (!e || e.exp <= this.now()) {
      if (e) this.m.delete(k);
      this.misses++;
      return undefined;
    }
    // refresh recency
    this.m.delete(k);
    this.m.set(k, e);
    this.hits++;
    return e.v;
  }

  set(k: string, v: V): void {
    this.m.delete(k);
    this.m.set(k, { v, exp: this.now() + this.ttlMs });
    while (this.m.size > this.max) this.m.delete(this.m.keys().next().value!);
  }

  get size() {
    return this.m.size;
  }
}
