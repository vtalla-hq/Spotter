import { useEffect, useMemo, useState } from "react";
import { shortName } from "../../engine/ctx";
import { ACT } from "../../engine/data/actions";
import { COMP, TRAIN } from "../../engine/data/compounds";
import { BYID } from "../../engine/data/markers";
import { RED } from "../../engine/data/redflags";
import { SRC, SRC_ORDER, srcNum } from "../../engine/data/sources";
import { useStore } from "../store";

/** Where each source is used, so people can see what a paper backs up */
function usage(): Record<string, Set<string>> {
  const used: Record<string, Set<string>> = {};
  const add = (id: string, what: string) => (used[id] ??= new Set()).add(what);
  const ids = (s: string) => [...s.matchAll(/\[(P\d+)\]/g)].map((m) => m[1]);
  [...COMP, TRAIN].forEach((c) => ids(JSON.stringify(c)).forEach((id) => add(id, shortName(c))));
  Object.entries(ACT).forEach(([k, v]) => ids(JSON.stringify(v)).forEach((id) => add(id, BYID[k].name)));
  RED.forEach((r) => ids(r.txt).forEach((id) => add(id, BYID[r.m].name + " red flag")));
  (
    [
      ["P31", "Kidney score"], ["P13", "Kidney score"], ["P32", "Gear check"], ["P34", "Gear check"], ["P34", "Cycle timeline"],
      ["P2", "Cycle timeline"], ["P33", "Heart strain"], ["P33", "ER signs"], ["P3", "Heart strain"], ["P24", "Heart strain"], ["P6", "ER signs"],
    ] as const
  ).forEach(([k, v]) => add(k, v));
  return used;
}

export function SourcesTab() {
  const { flash } = useStore();
  const used = useMemo(usage, []);
  return (
    <section data-tab="sources" className="on">
      <div className="panel prose">
        <p className="eyebrow">Sources</p>
        <p>
          Each effect, cutoff and action links to one of these. Where Spotter says something without a citation, it's standard lab physiology or a
          common-sense step, not a research finding.
        </p>
        <ol className="srclist">
          {SRC_ORDER.map((id) => (
            <li key={id} id={"src-" + id} className={flash === id ? "flash" : undefined}>
              <span className="n">[{srcNum(id)}]</span>
              <div>
                <a href={SRC[id].u} target="_blank" rel="noopener">
                  {SRC[id].t}
                </a>{" "}
                <span className="num" style={{ fontSize: 12, color: "var(--muted)" }}>
                  {SRC[id].id}
                </span>
                <div className="used">Used for: {[...(used[id] ?? [])].slice(0, 8).join(", ")}</div>
              </div>
            </li>
          ))}
        </ol>
        <AskLibrary />
        <p style={{ marginTop: 16 }}>
          <strong>How triage works.</strong> A marker is flagged when it's outside its typical adult range, or far from its guideline target for
          lipids and glucose. Spotter then checks your stack and your training for anything known to push that marker the same way. If something
          does and the effect is a lab artifact, it's filed as explained. If the effect is real harm, it's filed as a real risk. If nothing explains
          it, it's unexplained. A small set of thresholds are red flags whatever the cause.
        </p>
        <p>
          <strong>Ranges.</strong> Typical adult ranges used by Canadian labs. IGF-1, LH and estradiol depend heavily on age, sex and cycle phase, so
          your lab's printed range comes first.
        </p>
        <p>
          <strong>Trends.</strong> Projections fit a straight line through your last four saved draws and only show when the trend covers at least 2%
          of the typical range a month and crosses a line within a year. Real biology isn't linear, so treat a projected date as a nudge to retest,
          not a forecast.
        </p>
        <p>
          <strong>Privacy.</strong> Everything runs in your browser. Reports you upload are read on your device, never sent anywhere. If you sign
          in, your data is encrypted with your password before it leaves the browser, so the server only ever stores scrambled bytes.
        </p>
      </div>
    </section>
  );
}

interface LibStudy {
  pmid: string;
  title: string;
  journal: string | null;
  year: number | null;
  types: string[];
  url: string;
  cited: number;
}

/** Studies the Ask feature has read and cited, shared by everyone. Grows as people ask. */
function AskLibrary() {
  const [list, setList] = useState<LibStudy[] | null>(null);
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  useEffect(() => {
    if (!url || !key) return;
    fetch(`${url}/rest/v1/studies?select=pmid,title,journal,year,types,url,cited&order=cited.desc,last_at.desc&limit=200`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setList(Array.isArray(d) ? d : []))
      .catch(() => setList([]));
  }, [url, key]);
  if (!list?.length) return null;
  return (
    <>
      <p className="eyebrow" style={{ marginTop: 26 }}>
        Added by Ask · {list.length} stud{list.length === 1 ? "y" : "ies"}
      </p>
      <p>Papers the Ask tab has read and cited to answer people's questions. The library grows every time someone asks.</p>
      <ol className="srclist lib">
        {list.map((s) => (
          <li key={s.pmid}>
            <span className="n">{s.cited}×</span>
            <div>
              <a href={s.url} target="_blank" rel="noopener">
                {s.title}
              </a>{" "}
              <span className="num" style={{ fontSize: 12, color: "var(--muted)" }}>
                {[s.journal, s.year].filter(Boolean).join(", ")} · PMID {s.pmid}
              </span>
              {s.types?.length > 0 && <div className="used">{s.types.slice(0, 2).join(", ")}</div>}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
