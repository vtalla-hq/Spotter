/**
 * PubMed through NCBI E-utilities. Used by the Ask server function, kept
 * here so the parsing can be unit-tested without a network.
 * https://www.ncbi.nlm.nih.gov/books/NBK25499/
 */

export interface Study {
  pmid: string;
  title: string;
  journal: string;
  year: number | null;
  /** e.g. "Randomized Controlled Trial", "Meta-Analysis" */
  types: string[];
  abstract?: string;
  url: string;
}

const EU = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
export const pubmedUrl = (pmid: string) => `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

type Fetch = typeof fetch;

function params(p: Record<string, string>, apiKey?: string) {
  const q = new URLSearchParams({ db: "pubmed", tool: "spotter", email: "spotter@users.noreply.github.com", ...p });
  if (apiKey) q.set("api_key", apiKey);
  return q.toString();
}

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const first = (xml: string, tag: string) => {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  return m ? decode(m[1]) : "";
};
const all = (xml: string, tag: string) =>
  [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m);

/** Parse an efetch PubmedArticleSet into studies with abstracts. */
export function parseArticles(xml: string, maxAbstract = 2200): Study[] {
  return all(xml, "PubmedArticle").map((m) => {
    const a = m[1];
    const pmid = first(a, "PMID");
    const parts = all(a, "AbstractText").map((t) => {
      const label = t[0].match(/Label="([^"]+)"/)?.[1];
      const txt = decode(t[1]);
      return label ? `${label}: ${txt}` : txt;
    });
    let abstract = parts.join(" ");
    if (abstract.length > maxAbstract) abstract = abstract.slice(0, maxAbstract).replace(/\s\S*$/, "") + "…";
    const year = parseInt(first(a, "PubDate").match(/\d{4}/)?.[0] ?? first(a, "MedlineDate").match(/\d{4}/)?.[0] ?? "", 10);
    return {
      pmid,
      title: first(a, "ArticleTitle"),
      journal: first(a, "ISOAbbreviation") || first(a, "Title"),
      year: Number.isFinite(year) ? year : null,
      types: all(a, "PublicationType").map((t) => decode(t[1])).filter((t) => t !== "Journal Article"),
      abstract: abstract || "(no abstract)",
      url: pubmedUrl(pmid),
    };
  });
}

/** Parse an esummary JSON result into studies without abstracts, in the order given. */
export function parseSummary(json: any, ids: string[]): Study[] {
  const r = json?.result ?? {};
  return ids
    .filter((id) => r[id] && !r[id].error)
    .map((id) => {
      const x = r[id];
      const year = parseInt(String(x.pubdate ?? "").slice(0, 4), 10);
      return {
        pmid: id,
        title: decode(String(x.title ?? "")),
        journal: decode(String(x.source ?? "")),
        year: Number.isFinite(year) ? year : null,
        types: (x.pubtype ?? []).filter((t: string) => t !== "Journal Article"),
        url: pubmedUrl(id),
      };
    });
}

export async function search(query: string, opts: { max?: number; apiKey?: string; fetch?: Fetch } = {}): Promise<Study[]> {
  const f = opts.fetch ?? fetch;
  const max = Math.min(Math.max(opts.max ?? 8, 1), 12);
  const s = await f(EU + "esearch.fcgi?" + params({ term: query, retmax: String(max), sort: "relevance", retmode: "json" }, opts.apiKey));
  if (!s.ok) throw new Error("PubMed search failed (" + s.status + ")");
  const ids: string[] = (await s.json())?.esearchresult?.idlist ?? [];
  if (!ids.length) return [];
  const sum = await f(EU + "esummary.fcgi?" + params({ id: ids.join(","), retmode: "json" }, opts.apiKey));
  if (!sum.ok) throw new Error("PubMed summary failed (" + sum.status + ")");
  return parseSummary(await sum.json(), ids);
}

export async function abstracts(pmids: string[], opts: { apiKey?: string; fetch?: Fetch } = {}): Promise<Study[]> {
  const f = opts.fetch ?? fetch;
  const ids = [...new Set(pmids.map((p) => String(p).replace(/\D/g, "")).filter(Boolean))].slice(0, 10);
  if (!ids.length) return [];
  const r = await f(EU + "efetch.fcgi?" + params({ id: ids.join(","), rettype: "abstract", retmode: "xml" }, opts.apiKey));
  if (!r.ok) throw new Error("PubMed fetch failed (" + r.status + ")");
  return parseArticles(await r.text());
}
