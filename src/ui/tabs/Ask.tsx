import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { BYC } from "../../engine/data/compounds";
import type { Study } from "../../ask/pubmed";
import { milestone } from "../../features/analytics";
import { useStore } from "../store";

interface Answer {
  q: string;
  answer: string;
  studies: Study[];
  searches: string[];
  at: number;
}

const HIST = "spotter-ask";
const EXAMPLES = [
  "Does creatine actually hurt your kidneys?",
  "Why is my hematocrit high on TRT, and does donating blood help?",
  "Is high ALT and AST after heavy lifting normal?",
  "What does MK-677 do to fasting glucose?",
  "How long does LH take to recover after a cycle?",
  "Does fish oil raise HDL?",
];

function loadHist(): Answer[] {
  try {
    return JSON.parse(localStorage.getItem(HIST) ?? "[]");
  } catch {
    return [];
  }
}

export function AskTab() {
  const { s, ctx, T } = useStore();
  const [q, setQ] = useState("");
  const [useMine, setUseMine] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [hist, setHist] = useState<Answer[]>(loadHist);
  const box = useRef<HTMLTextAreaElement>(null);
  const hasMine = s.stack.length > 0 || T.length > 0;

  useEffect(() => {
    try {
      localStorage.setItem(HIST, JSON.stringify(hist.slice(0, 10)));
    } catch {
      /* ignore */
    }
  }, [hist]);

  const submit = async (question = q) => {
    const text = question.trim();
    if (text.length < 4 || busy) return;
    setErr("");
    setBusy("Starting…");
    const context =
      useMine && hasMine
        ? {
            sex: s.sex,
            stack: s.stack.map((id) => BYC[id]?.name.split(" (")[0]).filter(Boolean),
            phase: ctx.onCycleStack ? { pre: "before starting a cycle", on: "on cycle", off: "off cycle" }[s.cyc.ph] : undefined,
            // names and direction only, never the numbers
            flags: T.map((t) => `${t.m.name} ${t.d === "up" ? "high" : "low"}`),
          }
        : undefined;
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q: text, context }),
      });
      if (!r.body || !r.headers.get("content-type")?.includes("ndjson")) {
        const j = await r.json().catch(() => null);
        throw new Error(j?.m ?? (r.status === 404 ? "Ask isn't available here." : "Couldn't reach Ask. Try again."));
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let done: Answer | null = null;
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.t === "status") setBusy(ev.m);
          else if (ev.t === "error") throw new Error(ev.m);
          else if (ev.t === "done") done = { q: text, answer: ev.answer, studies: ev.studies, searches: ev.searches ?? [], at: Date.now() };
        }
      }
      if (!done) throw new Error("The answer got cut off. Try again.");
      setHist((h) => [done!, ...h].slice(0, 10));
      setQ("");
      milestone("asked", { studies: done.studies.length });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section data-tab="ask" className="on">
      <div className="hhero">
        <h1>Ask anything</h1>
        <p>Questions about bloodwork, training, supplements or what you're taking, answered from PubMed studies with every claim cited.</p>
      </div>

      <div className="panel askbox">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <textarea
            ref={box}
            value={q}
            maxLength={500}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="e.g. Why is my HDL so low on an oral, and does it come back?"
            aria-label="Your question"
            disabled={!!busy}
          />
          <div className="askfoot">
            {hasMine ? (
              <label className="switch">
                <input type="checkbox" checked={useMine} onChange={(e) => setUseMine(e.target.checked)} /> Use my stack and which results are flagged
                (not the numbers)
              </label>
            ) : (
              <span />
            )}
            <span className="cnt">{q.length}/500</span>
            <button className="btn primary" disabled={!!busy || q.trim().length < 4}>
              {busy ? "Working…" : "Ask"}
            </button>
          </div>
        </form>
        {busy && (
          <p className="askstatus" role="status">
            <i />
            {busy}
          </p>
        )}
        {err && <p className="askerr">{err}</p>}
        {!hist.length && !busy && (
          <div className="chips2 asksug">
            {EXAMPLES.map((x) => (
              <button
                key={x}
                className="cchip"
                onClick={() => {
                  setQ(x);
                  submit(x);
                }}
              >
                {x}
              </button>
            ))}
          </div>
        )}
        <p className="gnote">
          Your question goes to Spotter's server, PubMed and an AI model (Claude) to write the answer, and isn't saved anywhere but this browser.
          Don't include your name. Spotter won't give doses, cycles or PCT protocols.
        </p>
      </div>

      {hist.map((a, i) => (
        <AnswerCard key={a.at} a={a} first={i === 0} />
      ))}
      {hist.length > 0 && (
        <p className="policy">
          Answers summarise study abstracts and can miss nuance. They're not medical advice: check anything that matters with a doctor.{" "}
          <button className="linkish" onClick={() => setHist([])}>
            Clear history
          </button>
        </p>
      )}
    </section>
  );
}

function AnswerCard({ a, first }: { a: Answer; first: boolean }) {
  const num = Object.fromEntries(a.studies.map((s, i) => [s.pmid, i + 1]));
  return (
    <article className={"panel answer" + (first ? " latest" : "")}>
      <p className="aq">{a.q}</p>
      <div className="abody">
        <Rich text={a.answer} num={num} />
      </div>
      {a.studies.length > 0 && (
        <ol className="astudies">
          {a.studies.map((s) => (
            <li key={s.pmid} id={`a${a.at}-${s.pmid}`}>
              <span className="n">{num[s.pmid]}</span>
              <div>
                <a href={s.url} target="_blank" rel="noopener">
                  {s.title}
                </a>
                <small>
                  {s.journal}
                  {s.year ? ", " + s.year : ""}
                  {s.types.length ? " · " + s.types.slice(0, 2).join(", ") : ""} · PMID {s.pmid}
                </small>
              </div>
            </li>
          ))}
        </ol>
      )}
      {a.searches.length > 0 && <p className="asearch">Searched PubMed for: {a.searches.map((x) => `“${x}”`).join(", ")}</p>}
    </article>
  );
}

/** Minimal, safe rendering: paragraphs, bullet lists, **bold**, and [PMID:n] citations as numbered links. No HTML from the model. */
function Rich({ text, num }: { text: string; num: Record<string, number> }) {
  const inline = (s: string, k: string): ReactNode[] =>
    s.split(/(\*\*[^*]+\*\*|\[PMID:\d+\])/g).map((part, i, all) => {
      const key = k + "-" + i;
      const c = part.match(/^\[PMID:(\d+)\]$/);
      if (c) {
        const n = num[c[1]];
        // the split leaves an empty string between back-to-back citations
        const after = i >= 2 && all[i - 1] === "" && /^\[PMID:\d+\]$/.test(all[i - 2]);
        return n ? (
          <Fragment key={key}>
            {after && <span className="csep">,</span>}
            <a className="cite" href={`https://pubmed.ncbi.nlm.nih.gov/${c[1]}/`} target="_blank" rel="noopener" title={"PMID " + c[1]}>
              {n}
            </a>
          </Fragment>
        ) : null;
      }
      if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={key}>{part.slice(2, -2)}</strong>;
      return <Fragment key={key}>{part}</Fragment>;
    });
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter((l) => l.trim());
        if (lines.length && lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l)))
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""), `${i}-${j}`)}</li>
              ))}
            </ul>
          );
        return <p key={i}>{inline(lines.join(" ").replace(/^#+\s*/, ""), String(i))}</p>;
      })}
    </>
  );
}
