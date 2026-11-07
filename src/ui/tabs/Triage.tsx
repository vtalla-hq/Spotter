import { useEffect, useRef, useState } from "react";
import { useOpenDialog } from "../../App";
import { shortName } from "../../engine/ctx";
import { ACT } from "../../engine/data/actions";
import { BYC, CLS, COMP } from "../../engine/data/compounds";
import { PRESETS } from "../../engine/data/health";
import { BYID } from "../../engine/data/markers";
import { comboList, gapList } from "../../engine/health";
import { clearedState, sampleState } from "../../engine/state";
import { buckets, checklist, KTAG, untested, type Flag } from "../../engine/triage";
import { fmt, unitLabel } from "../../engine/units";
import type { ClassId } from "../../engine/types";
import { Cite } from "../Cite";
import { Go, Seg, Tag, uniq, vars } from "../bits";
import { useStore } from "../store";
import { BodyMap } from "./BodyMap";
import { StrainPanel } from "./Strain";

export function TriageTab() {
  const { s, ctx, T, set, go } = useStore();
  const open = useOpenDialog();
  const [openSys, setOpenSys] = useState<Set<string>>(new Set());
  const B = buckets(ctx, T);
  const hasVals = B.n > 0;
  const hasStack = s.stack.length > 0 || s.train;
  const sample = () => {
    set(sampleState);
    go("triage");
    scrollTo(0, 0);
  };
  const clear = () => {
    set(clearedState);
    setOpenSys(new Set());
    scrollTo(0, 0);
  };
  const openSpot = (id: string) => {
    setOpenSys((o) => new Set(o).add(id));
    setTimeout(() => document.getElementById("sys-" + id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
  };
  const anything = s.stack.length || s.train || hasVals || Object.keys(s.me).length;

  return (
    <section data-tab="triage" className="on">
      <div className="hero2">
        <div className="hcopy">
          <p className="kick">
            <i />
            Bloodwork triage for lifters
          </p>
          <h1>
            <span>Know your stack.</span> <span className="b">Know your blood.</span>
          </h1>
          <p>
            Lab reports flag lifters for everything. Spotter shows which organs your stack is loading, sorts every flag into ignore, fix or act
            now, and links the study behind each call.
          </p>
          <div className="btnrow">
            <button className="btn primary big" onClick={sample}>
              Try a sample cycle
            </button>
            <button className="btn big" onClick={() => open("import")}>
              Upload my lab report
            </button>
          </div>
          <ol className="steps">
            <li className={hasStack ? "done" : ""}>
              <b>1</b>Add your stack
            </li>
            <li className={hasVals ? "done" : ""}>
              <b>2</b>Enter your results
            </li>
            <li className={hasVals && hasStack ? "done" : ""}>
              <b>3</b>Read your triage
            </li>
          </ol>
        </div>
        <div className="hmap">
          <BodyMap onSpot={openSpot} />
          <div className="presets" aria-label="Quick stacks">
            <span className="t">Load a stack</span>
            {PRESETS.map(([n, ids]) => {
              const cur = [...s.stack].sort().join(",");
              return (
                <button
                  key={n}
                  aria-pressed={ids.split(",").sort().join(",") === cur}
                  onClick={() =>
                    set((x) => {
                      const stack = ids.split(",");
                      const cyc = stack.some((id) => ["inj", "oral", "sarm"].includes(BYC[id]?.cls)) ? x.cyc : { ...x.cyc, ph: "on" as const };
                      return { ...x, stack, cyc, example: false };
                    })
                  }
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="panel stackp">
        <div className="stackrow">
          <div className="stackchips">
            {s.stack.length ? (
              s.stack.map((id) => {
                const c = BYC[id];
                return (
                  <span className="schip" key={id} style={vars({ "--c": CLS[c.cls].c })}>
                    {c.name} <small>{CLS[c.cls].n}</small>
                    <button aria-label={"Remove " + c.name} onClick={() => set((x) => ({ ...x, stack: x.stack.filter((y) => y !== id), example: false }))}>
                      ×
                    </button>
                  </span>
                );
              })
            ) : (
              <span className="empty">Nothing added yet. Add creatine, TRT, a cycle, peptides, anything.</span>
            )}
          </div>
          <Picker />
        </div>
        <div className="stackfoot">
          <label className="switch">
            <input type="checkbox" checked={s.train} onChange={(e) => set((x) => ({ ...x, train: e.target.checked, example: false }))} /> Trained
            hard in the 7 days before the draw
          </label>
          <span className="btnrow">
            <button className="btn" onClick={sample}>
              Try a sample cycle
            </button>
            <button className="btn" onClick={() => open("import")}>
              Upload or paste report
            </button>
            <Go tab="bloodwork" className="btn" style={{ textDecoration: "none", color: "inherit" }}>
              Type in results
            </Go>
            {hasVals && (
              <>
                <button className="btn" onClick={() => open("save")}>
                  Save this draw
                </button>
                <button className="btn" onClick={() => open("doc")}>
                  Doctor sheet
                </button>
                <button className="btn" onClick={() => open("share")}>
                  Share card
                </button>
              </>
            )}
            {!!anything && (
              <button className="btn" onClick={clear}>
                Clear all
              </button>
            )}
          </span>
        </div>
        {ctx.onCycleStack && (
          <div className="cycrow">
            <span>When was this blood drawn?</span>
            <Seg
              label="Cycle phase"
              value={s.cyc.ph}
              options={[["pre", "Before starting"], ["on", "On cycle"], ["off", "Off cycle"]]}
              onChange={(ph) => set((x) => ({ ...x, cyc: { ...x.cyc, ph }, example: false }))}
            />
            {s.cyc.ph !== "pre" && (
              <label>
                <input
                  className="wkin"
                  inputMode="numeric"
                  aria-label="Weeks"
                  value={s.cyc.wk}
                  onChange={(e) => {
                    const wk = e.target.value.replace(/\D/g, "").slice(0, 3);
                    set((x) => ({ ...x, cyc: { ...x.cyc, wk } }));
                  }}
                />{" "}
                <span>{s.cyc.ph === "off" ? "weeks since stopping" : "weeks in"}</span>
              </label>
            )}
          </div>
        )}
      </div>

      {s.example && (
        <div className="notice">
          <span>
            <b>This is a sample cycle.</b> Swap in your own stack and results, or clear it.
          </span>
          <span className="btnrow">
            <button className="btn" onClick={clear}>
              Clear sample
            </button>
          </span>
        </div>
      )}

      <div className="verdict">
        {!hasVals ? (
          <p className="vline">Add your results to see your triage.</p>
        ) : (
          <div className="vbig">
            <span style={vars({ "--c": "var(--danger)" })}>
              <b>{B.act.length}</b>act now
            </span>
            <span style={vars({ "--c": "var(--risk)" })}>
              <b>{B.fix.length}</b>fix or ask about
            </span>
            <span style={vars({ "--c": "var(--calm)" })}>
              <b>{B.exp.length}</b>expected from your stack
            </span>
            <span style={vars({ "--c": "var(--ok)" })}>
              <b>{B.fine}</b>in range
            </span>
          </div>
        )}
      </div>

      {(s.stack.length > 0 || hasVals) && <StrainPanel open={openSys} setOpen={setOpenSys} />}

      {s.stack.length > 0 && <HealthLink />}
      {s.draws.length > 0 && <TrendsLink />}

      <div className="groups">
        {B.act.length > 0 && (
          <div className="group">
            <h2 style={vars({ "--c": "var(--danger)" })}>
              <i />
              Act now
            </h2>
            <p>Past a threshold that matters whatever caused it.</p>
            <div className="cards">
              {B.act.map((t) => (
                <FlagCard key={t.m.id} t={t} c="var(--danger)" />
              ))}
            </div>
          </div>
        )}
        {B.fix.length > 0 && (
          <div className="group">
            <h2 style={vars({ "--c": "var(--risk)" })}>
              <i />
              Fix or ask about
            </h2>
            <p>Real harm from your stack, or something your stack doesn't explain.</p>
            <div className="cards">
              {B.fix.map((t) => (
                <FlagCard key={t.m.id} t={t} c={t.cat === "risk" ? "var(--risk)" : "var(--warn)"} />
              ))}
            </div>
          </div>
        )}
        {B.exp.length > 0 && (
          <div className="group">
            <h2 style={vars({ "--c": "var(--calm)" })}>
              <i />
              Expected from your stack
            </h2>
            <p>Flagged by the lab, but explained by what you take or how you train. Don't panic over these.</p>
            <ul className="explist">
              {B.exp.map((t) => (
                <li key={t.m.id}>
                  <Go tab="bloodwork" sel={t.m.id}>
                    <strong>{t.m.name}</strong>{" "}
                    <span className="num">
                      {fmt(t.m, s.units, t.x)} {unitLabel(t.m, s.units)}
                    </span>
                  </Go>
                  <span>
                    {t.cs.map((z) => shortName(z.c)).join(" + ")} · {uniq(t.cs.map((z) => KTAG[z.f.k][0].toLowerCase())).join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {hasVals && !T.length && (
          <div className="panel">
            <p style={{ margin: 0 }}>Nothing flagged. Every value you entered is in its typical range.</p>
          </div>
        )}
      </div>

      <Prep />

      <div className="how">
        <h2>
          Lab ranges are written for people who don't lift. <span>Spotter reads them for people who do.</span>
        </h2>
        <div className="how3">
          <div style={vars({ "--c": "#facc15" })}>
            <span className="k">Warm-up</span>
            <h3>Load your stack</h3>
            <p>
              Pick anything from creatine to clenbuterol. The load map shows which organs each one works on, and whether that's harm, an expected
              change or just a lab artifact.
            </p>
          </div>
          <div style={vars({ "--c": "#3b82f6" })}>
            <span className="k">Working set</span>
            <h3>Run your bloods</h3>
            <p>Upload a photo or PDF of your report. Every flag lands in act now, fix, or expected, with the paper behind the call one tap away.</p>
          </div>
          <div style={vars({ "--c": "#22c55e" })}>
            <span className="k">Cool-down</span>
            <h3>Track it</h3>
            <p>Save each draw to see your trend, when a marker will cross a line, and how far you've recovered. Print a doctor sheet any time.</p>
          </div>
        </div>
      </div>
      <p className="policy">
        Spotter doesn't give doses, cycles or PCT protocols. For anything in "Act now," see a doctor who knows exactly what you're on. Chest pain,
        yellow eyes or sudden weakness?{" "}
        <Go tab="er" style={{ color: "var(--danger)", fontWeight: 700 }}>
          See ER signs
        </Go>
        .
      </p>
    </section>
  );
}

function Picker() {
  const { s, set } = useStore();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("click", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("click", click);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const query = q.trim().toLowerCase();
  const groups = (Object.keys(CLS) as ClassId[])
    .map((k) => ({ k, list: COMP.filter((c) => c.cls === k && (!query || (c.name + " " + c.aka).toLowerCase().includes(query))) }))
    .filter((g) => g.list.length);
  return (
    <div className="picker" ref={ref}>
      <button ref={btn} className="btn primary" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        + Add to stack
      </button>
      <div className={"pop" + (open ? " open" : "")} role="dialog" aria-label="Choose compounds">
        {open && (
          <>
            <input autoFocus type="search" placeholder="Search: tren, MK-677, creatine…" aria-label="Search compounds" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="opts">
              {groups.length ? (
                groups.map((g) => (
                  <div key={g.k}>
                    <div className="grp">{CLS[g.k].n}</div>
                    {g.list.map((c) => {
                      const on = s.stack.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          className="opt"
                          role="menuitemcheckbox"
                          aria-checked={on}
                          onClick={() =>
                            set((x) => ({ ...x, stack: on ? x.stack.filter((y) => y !== c.id) : [...x.stack, c.id], example: false }))
                          }
                        >
                          <span className="box">{on ? "✓" : ""}</span>
                          <span>
                            <strong>{c.name}</strong>
                            <small>{c.aka}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))
              ) : (
                <p className="empty" style={{ padding: 8 }}>
                  No match. Try another name.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FlagCard({ t, c }: { t: Flag; c: string }) {
  const { s, ctx } = useStore();
  const [lo, hi] = ctx.ri(t.m);
  const acts = ACT[t.m.id]?.[t.d] ?? [];
  const cycleCauses = t.cs.some((z) => ["inj", "oral", "sarm"].includes(z.c.cls));
  const goneNames = uniq(t.gone.map(shortName)).join(", ");
  return (
    <article className="card" style={vars({ "--c": c })}>
      <div className="top">
        <h3>
          {t.m.name} <span className="dir">{t.d === "up" ? "high" : "low"}</span>
        </h3>
        <span className="val">
          {fmt(t.m, s.units, t.x)} <small>{unitLabel(t.m, s.units)}</small>
        </span>
      </div>
      <div className="rng">
        Typical {fmt(t.m, s.units, lo)}–{fmt(t.m, s.units, hi)}
      </div>
      {t.red.map((r, i) => (
        <p className="flagline" key={i}>
          <Cite text={r.txt} />
        </p>
      ))}
      <ul className="why">
        {t.gone.length > 0 && (
          <li>
            <Tag c="var(--warn)">{s.cyc.ph === "pre" ? "Baseline" : "Should have cleared"}</Tag>
            <span>
              {s.cyc.ph === "pre" ? (
                `This draw is from before you started ${goneNames}, so it isn't the cause. Worth sorting out before you start.`
              ) : (
                <Cite text={`You're 12+ weeks off ${goneNames}. Most people were back to baseline by 3 months, so it's worth a doctor visit. [P2] [P34]`} />
              )}
            </span>
          </li>
        )}
        {s.cyc.ph === "off" && !ctx.lapsed && cycleCauses && (
          <li>
            <Tag c="var(--calm)">Off cycle</Tag>
            <span>
              {ctx.wk != null ? `You're ${ctx.wk} week${ctx.wk === 1 ? "" : "s"} off. ` : ""}
              <Cite text="In HAARLEM, blood changes from a cycle were back to baseline about 3 months after stopping. Retest after 12 weeks. [P2] [P34]" />
            </span>
          </li>
        )}
        {t.cs.map((z, i) => (
          <li key={i}>
            <Tag c={KTAG[z.f.k][1]}>{KTAG[z.f.k][0]}</Tag>
            <span>
              <strong>{z.c.name}:</strong> <Cite text={z.f.why} />
            </span>
          </li>
        ))}
        {!t.cs.length && !t.gone.length && (
          <li>
            <Tag c="var(--warn)">Unexplained</Tag>
            <span>Nothing in your stack pushes this {t.d === "up" ? "up" : "down"}. Bring it to a doctor.</span>
          </li>
        )}
      </ul>
      {acts.length > 0 && (
        <details className="todo">
          <summary>What to do</summary>
          <ul>
            {acts.map((a, i) => (
              <li key={i}>
                <Cite text={a} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function HealthLink() {
  const { ctx } = useStore();
  const G = gapList(ctx);
  const C = comboList(ctx);
  const d = G.filter((g) => g.done).length;
  return (
    <div className="hlink">
      <span>
        Health check: {G.length ? `${d}/${G.length} monitoring gaps covered` : "no extra monitoring needed"}
        {C.length ? ` · ${C.length} combo warning${C.length > 1 ? "s" : ""}` : ""}
      </span>
      <Go tab="health">Open health check →</Go>
    </div>
  );
}

function TrendsLink() {
  const { s } = useStore();
  const n = s.draws.length;
  return (
    <div className="hlink">
      <span>
        {n} saved draw{n === 1 ? "" : "s"}
        {s.drawDate ? ` · showing ${s.drawDate}` : ""}
      </span>
      <Go tab="trends">See your trends →</Go>
    </div>
  );
}

function Prep() {
  const { ctx } = useStore();
  const L = checklist(ctx);
  const need = untested(ctx);
  const rows = ctx.all;
  return (
    <details className="panel moreinfo">
      <summary>Prep for your next blood test</summary>
      <div className="two" style={{ marginTop: 16 }}>
        <div>
          <p className="eyebrow">Before the draw</p>
          <ul className="check">
            {L.map((x, i) => (
              <li key={i}>
                <span>
                  <Cite text={x} />
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow">Test these next</p>
          <p className="sub">
            {need.length
              ? "Your stack affects these, but you haven't entered them."
              : rows.length
                ? "You've covered every marker your stack affects."
                : "Add your stack to see what to test."}
          </p>
          <div className="watch">
            {need.map((x) => (
              <span key={x.id}>
                {BYID[x.id].name}
                <small>{x.by.join(", ")}</small>
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="eyebrow" style={{ marginTop: 22 }}>
        What your stack does to bloodwork
      </p>
      <div className="fxwrap">
        <table className="fx">
          <tbody>
            {rows.length ? (
              rows.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>
                    {c.fx.length ? (
                      c.fx.map((x, i) => (
                        <span key={i} className="eff" style={vars({ "--c": KTAG[x.k][1] })}>
                          {x.d === "up" ? "↑" : "↓"} {BYID[x.m].name}
                        </span>
                      ))
                    ) : (
                      <span className="empty">No known effects on routine markers.</span>
                    )}
                    {c.note && (
                      <div className="note">
                        <Cite text={c.note} />
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty" style={{ fontWeight: 400 }}>
                  Add compounds to see what they do to bloodwork.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}
