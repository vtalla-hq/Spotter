import { describe, expect, it } from "vitest";
import { ask, cleanCitations, contextLine, libraryLine, redactDoses, SYSTEM } from "./agent";
import { parseArticles, parseSummary } from "./pubmed";
import { findStudies, hashKey, rankStudies, terms } from "./store";

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
  it("handles gpt-oss lenticular brackets", () => {
    expect(cleanCitations("X 【PMID:11111111】.", read).text).toBe("X [PMID:11111111].");
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
      const tool = (id: string, name: string, args: unknown) => ok({ choices: [{ message: { content: null, tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] } }] });
      if (turn === 1) return { ok: false, status: 400, text: async () => "model gone" } as Response;
      if (turn === 2) return tool("a", "search_pubmed", { query: "steroids hematocrit" });
      if (turn === 3) return tool("b", "read_abstracts", { pmids: ["11111111"] });
      return ok({ choices: [{ message: { content: "Yes, it rises [PMID:11111111], maybe a lot [PMID:33333333]." } }] });
    }) as unknown as typeof fetch;
    return { f, calls };
  }

  it("falls back, searches, reads, answers and keeps only real citations", async () => {
    const { f, calls } = fakeFetch();
    const status: string[] = [];
    const history = [{ role: "user" as const, content: "earlier q" }, { role: "assistant" as const, content: "earlier a" }];
    const r = await ask("Does test raise hematocrit?", { apiKey: "k", fetch: f, history, onStatus: (m) => status.push(m) });
    expect(r.answer).toBe("Yes, it rises [PMID:11111111], maybe a lot.");
    expect(r.studies.map((s) => s.pmid)).toEqual(["11111111"]);
    expect(r.searches).toEqual(["steroids hematocrit"]);
    expect(status.some((m) => m.includes("Searching PubMed"))).toBe(true);
    // the model saw the search results and the abstract
    const modelCalls = calls.filter((c) => c.url.includes("groq"));
    expect(modelCalls[0].body.model).toBe("openai/gpt-oss-120b");
    expect(modelCalls[1].body.model).toBe("openai/gpt-oss-20b");
    const last = modelCalls.pop()!.body;
    expect(last.max_tokens).toBe(800);
    const toolText = JSON.stringify(last.messages);
    expect(toolText).toContain("PMID 11111111");
    expect(toolText).toContain("Steroids raise hematocrit");
    expect(last.messages[0].content).toContain("Never give doses");
    expect(last.messages[1].content).toBe("earlier q");
  });

  it("forces an answer on the last turn", async () => {
    let n = 0;
    const f = (async (url: string, init?: RequestInit) => {
      if (!url.includes("groq")) return { ok: true, json: async () => ({ esearchresult: { idlist: [] } }) } as Response;
      n++;
      const body = JSON.parse(String(init!.body));
      if (body.tool_choice === "none") return { ok: true, json: async () => ({ choices: [{ message: { content: "Not enough evidence." } }] }) } as Response;
      return { ok: true, json: async () => ({ choices: [{ message: { tool_calls: [{ id: "x" + n, function: { name: "search_pubmed", arguments: '{"query":"q"}' } }] } }] }) } as Response;
    }) as unknown as typeof fetch;
    const r = await ask("Anything?", { apiKey: "k", fetch: f });
    expect(r.answer).toBe("Not enough evidence.");
    expect(n).toBe(6);
  });
});

describe("dose limits", () => {
  it("strips dose amounts from sentences about drugs", () => {
    expect(redactDoses("Trials used testosterone 200 mg/week. Hematocrit rose.")).toBe("Trials used testosterone [dose removed]. Hematocrit rose.");
    expect(redactDoses("Anavar at 10–20 mg a day raised ALT; tamoxifen 20mg daily too.")).toBe("Anavar at [dose removed] raised ALT; tamoxifen [dose removed] daily too.");
    expect(redactDoses("HCG 500 IU every week")).toBe("HCG [dose removed]");
  });

  it("catches a dose a few sentences after the drug is named (seen live)", () => {
    const live =
      "Weekly testosterone enanthate doses from 25 mg to 600 mg raised hematocrit.\n- **Hematocrit rise is predictable:** every ~ 100 mg increase per week tends to raise hematocrit by ~ 1–2 %.";
    expect(redactDoses(live)).toBe(
      "Weekly testosterone enanthate doses from [dose removed] raised hematocrit.\n- **Hematocrit rise is predictable:** every ~ [dose removed] increase per week tends to raise hematocrit by ~ 1–2 %.",
    );
    // the question alone is enough to put the whole answer in drug mode
    expect(redactDoses("Most people use 250 mg a week.", "first cycle?")).toBe("Most people use [dose removed].");
    // a supplement sentence keeps its range even then
    expect(redactDoses("Creatine at 3–5 g/day is fine.", "I'm on TRT")).toBe("Creatine at 3–5 g/day is fine.");
  });

  it("leaves lab values and supplement intakes alone", () => {
    const labs = "On TRT your testosterone was 25 nmol/L, hemoglobin 17 g/dL, eGFR 95 mL/min and LDL 3.4 mmol/L.";
    expect(redactDoses(labs)).toBe(labs);
    const creatine = "Creatine is usually taken at 3–5 g/day [PMID:12345678]. Vitamin D above 4000 IU a day isn't advised.";
    expect(redactDoses(creatine)).toBe(creatine);
  });

  it("is applied to every answer", async () => {
    const f = (async () =>
      ({ ok: true, json: async () => ({ choices: [{ message: { content: "Studies gave nandrolone 300 mg per week." } }] }) }) as Response) as unknown as typeof fetch;
    expect((await ask("Does deca lower HDL?", { apiKey: "k", fetch: f })).answer).toBe("Studies gave nandrolone [dose removed].");
  });

  it("allows cited supplement ranges but never drug doses in the prompt", () => {
    expect(SYSTEM).toContain("Never give doses for drugs");
    expect(SYSTEM).toMatch(/over-the-counter supplements.*usual intake range/s);
  });
});

describe("the shared library", () => {
  const lib = [
    { pmid: "12345678", title: "Creatine supplementation and kidney function: a meta-analysis", journal: "J Ren Nutr", year: 2019, types: ["Meta-Analysis"], url: "https://pubmed.ncbi.nlm.nih.gov/12345678/", cited: 1 },
    { pmid: "23456789", title: "Kidney outcomes in creatine users", journal: "X", year: 2021, types: [], url: "https://pubmed.ncbi.nlm.nih.gov/23456789/", cited: 9 },
    { pmid: "34567890", title: "Creatine and sprint performance", journal: "Y", year: 2020, types: [], url: "https://pubmed.ncbi.nlm.nih.gov/34567890/", cited: 50 },
  ];

  it("turns a question into safe search terms", () => {
    expect(terms("Does creatine harm my kidneys?")).toEqual(["creatine", "harm", "kidneys"]);
    expect(terms("x' | !! & (y)")).toEqual([]);
    expect(terms("ALT/AST after deadlifts; anti-inflammatory?").every((t) => /^[a-z0-9]+$/.test(t))).toBe(true);
  });

  it("keeps titles matching two or more terms, best match then most cited", () => {
    const ts = terms("Does creatine harm my kidneys?");
    expect(rankStudies(lib, ts).map((s) => s.pmid)).toEqual(["23456789", "12345678"]);
    expect(rankStudies(lib, ["creatine"]).map((s) => s.pmid)).toEqual(["34567890", "23456789", "12345678"]);
  });

  it("reads matches from Supabase with an OR'd full-text query", async () => {
    let seen = "";
    const f = (async (url: string) => {
      seen = url;
      return { ok: true, json: async () => lib } as Response;
    }) as unknown as typeof fetch;
    const out = await findStudies({ url: "https://db.example", serviceKey: "k", fetch: f }, "Does creatine harm my kidneys?");
    const u = new URL(seen);
    expect(u.pathname).toBe("/rest/v1/studies");
    expect(u.searchParams.get("title")).toBe("fts(english).creatine | harm | kidneys");
    expect(out.map((s) => s.pmid)).toEqual(["23456789", "12345678"]);
    expect(out[0]).not.toHaveProperty("cited");
  });

  it("offers library studies to the model, which still has to read them to cite", async () => {
    let body: any;
    const f = (async (_url: string, init?: RequestInit) => {
      body = JSON.parse(String(init!.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content: "Fine [PMID:12345678]." } }] }) } as Response;
    }) as unknown as typeof fetch;
    const r = await ask("Does creatine harm my kidneys?", { apiKey: "k", fetch: f, library: lib.slice(0, 1) });
    expect(body.messages.at(-1).content).toContain("PMID 12345678 | 2019 | J Ren Nutr | Meta-Analysis | Creatine supplementation");
    // never read in this conversation, so the citation is dropped
    expect(r.answer).toBe("Fine.");
    expect(libraryLine([])).toBe("");
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
