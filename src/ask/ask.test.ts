import { describe, expect, it } from "vitest";
import { ask, cleanCitations, contextLine } from "./agent";
import { parseArticles, parseSummary } from "./pubmed";
import { hashKey } from "./store";

const XML = `<?xml version="1.0"?><PubmedArticleSet>
<PubmedArticle><MedlineCitation><PMID Version="1">11111111</PMID><Article>
<Journal><JournalIssue><PubDate><Year>2021</Year></PubDate></JournalIssue><Title>Scandinavian journal</Title><ISOAbbreviation>Scand J Med Sci Sports</ISOAbbreviation></Journal>
<ArticleTitle>Androgen use &amp; hematocrit in <i>men</i></ArticleTitle>
<Abstract><AbstractText Label="BACKGROUND">Steroids raise hematocrit.</AbstractText><AbstractText Label="RESULTS">Hematocrit rose by 3&#37;.</AbstractText></Abstract>
<PublicationTypeList><PublicationType>Journal Article</PublicationType><PublicationType>Randomized Controlled Trial</PublicationType></PublicationTypeList>
</Article></MedlineCitation></PubmedArticle>
<PubmedArticle><MedlineCitation><PMID Version="1">22222222</PMID><Article>
<Journal><JournalIssue><PubDate><MedlineDate>2019 Jan-Feb</MedlineDate></PubDate></JournalIssue><ISOAbbreviation>Nutrients</ISOAbbreviation></Journal>
<ArticleTitle>Creatine and kidneys</ArticleTitle>
</Article></MedlineCitation></PubmedArticle>
</PubmedArticleSet>`;

describe("PubMed parsing", () => {
  it("reads PMID, title, journal, year, types and labelled abstract", () => {
    const [a, b] = parseArticles(XML);
    expect(a.pmid).toBe("11111111");
    expect(a.title).toBe("Androgen use & hematocrit in men");
    expect(a.journal).toBe("Scand J Med Sci Sports");
    expect(a.year).toBe(2021);
    expect(a.types).toEqual(["Randomized Controlled Trial"]);
    expect(a.abstract).toBe("BACKGROUND: Steroids raise hematocrit. RESULTS: Hematocrit rose by 3%.");
    expect(a.url).toBe("https://pubmed.ncbi.nlm.nih.gov/11111111/");
    expect(b.year).toBe(2019);
    expect(b.abstract).toBe("(no abstract)");
  });
  it("trims long abstracts at a word", () => {
    const long = XML.replace("Steroids raise hematocrit.", "word ".repeat(1000));
    expect(parseArticles(long, 100)[0].abstract!.length).toBeLessThanOrEqual(101);
  });
  it("reads esummary results in search order and skips errors", () => {
    const json = { result: { uids: ["2", "1"], "1": { title: "One", source: "BMJ", pubdate: "2020 Mar", pubtype: ["Journal Article", "Meta-Analysis"] }, "2": { title: "Two", source: "JAMA", pubdate: "2018" }, "3": { error: "x" } } };
    const s = parseSummary(json, ["2", "1", "3"]);
    expect(s.map((x) => x.pmid)).toEqual(["2", "1"]);
    expect(s[1].types).toEqual(["Meta-Analysis"]);
    expect(s[1].year).toBe(2020);
  });
});

describe("citations", () => {
  const read = new Set(["11111111", "22222222"]);
  it("normalises styles and keeps order of first citation", () => {
    const r = cleanCitations("A [PMID: 22222222]. B (PMID 11111111). C [PMID:22222222].", read);
    expect(r.text).toBe("A [PMID:22222222]. B [PMID:11111111]. C [PMID:22222222].");
    expect(r.cited).toEqual(["22222222", "11111111"]);
  });
  it("drops citations to papers that weren't read", () => {
    const r = cleanCitations("Made up claim [PMID:99999999]. Real [PMID:11111111].", read);
    expect(r.text).toBe("Made up claim. Real [PMID:11111111].");
    expect(r.cited).toEqual(["11111111"]);
  });
  it("splits grouped citations", () => {
    expect(cleanCitations("X [PMID: 11111111, 22222222, 99999999]", read).text).toBe("X [PMID:11111111][PMID:22222222]");
  });
});

describe("context", () => {
  it("summarises only what was shared", () => {
    expect(contextLine(undefined)).toBe("");
    expect(contextLine({ sex: "m", stack: ["Testosterone"], flags: ["Hematocrit high"] })).toBe(
      "\n\n(About me: male; takes: Testosterone; flagged results: Hematocrit high.)",
    );
  });
});

describe("the ask loop", () => {
  // a fake model that searches, reads, then answers citing one real and one made-up paper
  function fakeFetch() {
    const calls: { url: string; body?: any }[] = [];
    let turn = 0;
    const f = (async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body });
      const ok = (data: unknown, text = false) =>
        ({ ok: true, status: 200, json: async () => data, text: async () => (text ? data : JSON.stringify(data)) }) as Response;
      if (url.includes("esearch")) return ok({ esearchresult: { idlist: ["11111111", "22222222"] } });
      if (url.includes("esummary")) return ok({ result: { "11111111": { title: "Androgens", source: "X", pubdate: "2021" }, "22222222": { title: "Creatine", source: "Y", pubdate: "2019" } } });
      if (url.includes("efetch")) return ok(XML, true);
      turn++;
      if (turn === 1) return ok({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "a", name: "search_pubmed", input: { query: "steroids hematocrit" } }] });
      if (turn === 2) return ok({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "b", name: "read_abstracts", input: { pmids: ["11111111"] } }] });
      return ok({ stop_reason: "end_turn", content: [{ type: "text", text: "Yes, it rises [PMID:11111111], maybe a lot [PMID:33333333]." }] });
    }) as unknown as typeof fetch;
    return { f, calls };
  }

  it("searches, reads, answers and keeps only real citations", async () => {
    const { f, calls } = fakeFetch();
    const status: string[] = [];
    const r = await ask("Does test raise hematocrit?", { apiKey: "k", fetch: f, onStatus: (m) => status.push(m) });
    expect(r.answer).toBe("Yes, it rises [PMID:11111111], maybe a lot.");
    expect(r.studies.map((s) => s.pmid)).toEqual(["11111111"]);
    expect(r.searches).toEqual(["steroids hematocrit"]);
    expect(status.some((m) => m.includes("Searching PubMed"))).toBe(true);
    // the model saw the search results and the abstract
    const lastModelCall = calls.filter((c) => c.url.includes("anthropic")).pop()!;
    const toolText = JSON.stringify(lastModelCall.body.messages);
    expect(toolText).toContain("PMID 11111111");
    expect(toolText).toContain("Steroids raise hematocrit");
    expect(lastModelCall.body.system).toContain("Never give doses");
  });

  it("forces an answer on the last turn", async () => {
    let n = 0;
    const f = (async (url: string, init?: RequestInit) => {
      if (!url.includes("anthropic")) return { ok: true, json: async () => ({ esearchresult: { idlist: [] } }) } as Response;
      n++;
      const body = JSON.parse(String(init!.body));
      if (body.tool_choice.type === "none") return { ok: true, json: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "Not enough evidence." }] }) } as Response;
      return { ok: true, json: async () => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "x" + n, name: "search_pubmed", input: { query: "q" } }] }) } as Response;
    }) as unknown as typeof fetch;
    const r = await ask("Anything?", { apiKey: "k", fetch: f });
    expect(r.answer).toBe("Not enough evidence.");
    expect(n).toBe(6);
  });
});

describe("rate-limit keys", () => {
  it("hashes IPs so the raw address is never stored", async () => {
    const a = await hashKey("1.2.3.4", "s");
    expect(a).toMatch(/^[0-9a-f]{24}$/);
    expect(a).not.toContain("1.2.3.4");
    expect(await hashKey("1.2.3.4", "s")).toBe(a);
    expect(await hashKey("1.2.3.4", "t")).not.toBe(a);
  });
});
