import { useMemo, useState } from "react";
import { useOpenDialog } from "../../App";
import { CYCLE_CLASSES } from "../../engine/ctx";
import { BYC } from "../../engine/data/compounds";
import { BYID, M } from "../../engine/data/markers";
import { deleteDraw, loadDraw, sampleState } from "../../engine/state";
import { changes, project, projections, recovery, series, TARGETS, type Projection } from "../../engine/trends";
import { factor, fmt, unitLabel } from "../../engine/units";
import type { Draw, Marker, Units } from "../../engine/types";
import { useAccount } from "../account";
import { Spark, TrendChart } from "../charts";
import { vars } from "../bits";
import { useStore } from "../store";

const PH: Record<Draw["ph"], string> = { pre: "Baseline", on: "On cycle", off: "Off cycle" };
const niceDate = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
const weeks = (d: number) => (d < 14 ? `${d} day${d === 1 ? "" : "s"}` : `${Math.round(d / 7)} weeks`);

/** monthly change with enough digits to not round to zero */
function perMonth(m: Marker, u: Units, v: number) {
  const x = Math.abs(v) * factor(m, u);
  return x >= 10 ? Math.round(x).toLocaleString("en-CA") : String(+x.toPrecision(2));
}

function AccountBar() {
  const A = useAccount();
  const open = useOpenDialog();
  if (A.account)
    return (
      <div className="acctbar in">
        <span>
          <b>Saved to your account</b> · {A.account.email} ·{" "}
          {A.status === "syncing" ? "saving…" : A.status === "error" ? <span style={{ color: "var(--danger)" }}>{A.error}</span> : "up to date"}
        </span>
        <button className="btn" onClick={() => open("account")}>
          Account
        </button>
      </div>
    );
  return (
    <div className="acctbar">
      <span>
        <b>Sign in to keep your progress.</b> Your draws are saved in this browser for now. With an account you can see them on any device,
        encrypted so only you can read them.
      </span>
      <button className="btn primary" onClick={() => open("account")}>
        Sign in
      </button>
    </div>
  );
}

export function TrendsTab() {
  const { s, ctx, set, go } = useStore();
  const open = useOpenDialog();
  const draws = s.draws;
  const P = useMemo(() => projections(draws, s.sex), [draws, s.sex]);
  const R = useMemo(() => recovery(draws, s.sex), [draws, s.sex]);
  const C = useMemo(() => changes(draws), [draws]);
  const projBy = Object.fromEntries(P.map((p) => [p.id, p]));
  // projected first, then out of range, then the rest in panel order
  const tracked = M.map((m) => ({ m, pts: series(draws, m.id) }))
    .filter((x) => x.pts.length >= 2)
    .map((x) => {
      const [lo, hi] = ctx.ri(x.m);
      const v = x.pts[x.pts.length - 1].v;
      return { ...x, out: v > hi || v < lo, proj: projBy[x.m.id] ?? null };
    })
    .sort((a, b) => Number(!!b.proj) - Number(!!a.proj) || Number(b.out) - Number(a.out));
  const [sel, setSel] = useState<string | null>(null);
  const cur = sel && tracked.some((x) => x.m.id === sel) ? sel : (tracked[0]?.m.id ?? null);
  const pick = (id: string) => {
    setSel(id);
    setTimeout(() => document.getElementById("detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 20);
  };

  if (!draws.length)
    return (
      <section data-tab="progress" className="on">
        <div className="hhero">
          <h1>Your progress</h1>
          <p>Save each draw and Spotter charts every marker, projects when one will cross a line, and shows how far you've recovered after a cycle.</p>
        </div>
        <AccountBar />
        <div className="panel">
          <p className="eyebrow">No saved draws yet</p>
          <p className="sub">
            Upload or enter your results, then hit "Save this draw" with the date it was taken. Two draws a week or more apart are enough for a trend.
            Mark one as "Before starting" to measure recovery against your own baseline.
          </p>
          <div className="btnrow">
            {Object.keys(s.vals).length > 0 ? (
              <button className="btn primary" onClick={() => open("save")}>
                Save my current results
              </button>
            ) : (
              <button className="btn primary" onClick={() => open("import")}>
                Upload a lab report
              </button>
            )}
            <button
              className="btn"
              onClick={() => {
                set(sampleState);
                scrollTo(0, 0);
              }}
            >
              See a sample history
            </button>
          </div>
        </div>
      </section>
    );

  return (
    <section data-tab="progress" className="on">
      <div className="hhero">
        <h1>Your progress</h1>
        <p>
          {draws.length} saved draw{draws.length === 1 ? "" : "s"}, {niceDate(draws[0].date)}
          {draws.length > 1 ? " to " + niceDate(draws[draws.length - 1].date) : ""}.
        </p>
      </div>

      {s.example ? (
        <div className="notice">
          <span>
            <b>This is a sample history.</b> Clear it from the Triage tab to start your own.
          </span>
        </div>
      ) : (
        <AccountBar />
      )}

      {P.length > 0 && (
        <div className="panel">
          <p className="eyebrow">At this rate</p>
          <ul className="proj">
            {P.slice(0, 6).map((p) => (
              <ProjLine key={p.id} p={p} onPick={() => pick(p.id)} />
            ))}
          </ul>
          <p className="gnote">
            Straight-line projection from your recent draws in the same cycle phase. Retest before the date, not after: a projection is a nudge, not
            a forecast.
          </p>
        </div>
      )}

      {tracked.length > 0 && cur && (
        <>
          <div className="sgrid">
            {tracked.map(({ m, pts, out, proj }) => {
              const last = pts[pts.length - 1].v;
              const prev = pts[pts.length - 2].v;
              const pct = prev ? Math.round(((last - prev) / Math.abs(prev)) * 100) : 0;
              return (
                <button key={m.id} className={"scard" + (m.id === cur ? " on" : "")} aria-pressed={m.id === cur} onClick={() => pick(m.id)}>
                  <span className="sh">
                    <span className="snm">{m.name}</span>
                    <span className={"sv" + (out ? " out" : "")}>
                      {fmt(m, s.units, last)} <small>{unitLabel(m, s.units)}</small>
                    </span>
                  </span>
                  <Spark pts={pts} r={ctx.ri(m)} proj={proj} />
                  <span className="sf">
                    <span title="Change since your previous draw">{pct === 0 ? "no change" : `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct)}%`}</span>
                    {proj && <span className="sp">line ~{new Date(proj.date + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <Detail id={cur} />
        </>
      )}

      {R.length > 0 && (
        <div className="panel">
          <p className="eyebrow">Recovery since your baseline</p>
          <ul className="recov">
            {R.map((r) => {
              const m = BYID[r.id];
              const c = r.overshoot ? "var(--risk)" : r.pct >= 80 ? "var(--ok)" : r.pct >= 40 ? "var(--warn)" : "var(--risk)";
              return (
                <li key={r.id} style={vars({ "--c": c })}>
                  <span className="nm">{m.name}</span>
                  <span className="rbar">
                    <i style={{ width: r.pct + "%" }} />
                  </span>
                  <b>{r.overshoot ? "past" : r.pct + "%"}</b>
                  <small>
                    {r.overshoot ? `Now ${r.latest < r.baseline ? "below" : "above"} where you started. ` : ""}
                    baseline {fmt(m, s.units, r.baseline)} · worst {fmt(m, s.units, r.worst)} · now {fmt(m, s.units, r.latest)} {unitLabel(m, s.units)}
                  </small>
                </li>
              );
            })}
          </ul>
          <p className="gnote">
            How far each marker has come back from its worst draw toward your own "before starting" draw. "Past" means it went beyond your baseline
            the other way: after a cycle, low testosterone or LH there usually means your own production hasn't recovered yet.
          </p>
        </div>
      )}

      {C.length > 0 && (
        <div className="panel">
          <p className="eyebrow">Since your last draw</p>
          <div className="fxwrap">
            <table className="fx">
              <thead>
                <tr>
                  <th>Marker</th>
                  <th>Before</th>
                  <th>Now</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {C.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).map((c) => {
                  const m = BYID[c.id];
                  return (
                    <tr key={c.id}>
                      <td>{m.name}</td>
                      <td className="num">{fmt(m, s.units, c.from)}</td>
                      <td className="num">
                        {fmt(m, s.units, c.to)} {unitLabel(m, s.units)}
                      </td>
                      <td className="num">
                        {c.delta > 0 ? "↑" : c.delta < 0 ? "↓" : "→"} {Math.abs(Math.round(c.pct))}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel">
        <p className="eyebrow">Saved draws</p>
        <div className="fxwrap">
          <table className="fx draws">
            <thead>
              <tr>
                <th>Date</th>
                <th>Phase</th>
                <th>Markers</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...draws].reverse().map((d) => (
                <tr key={d.id} className={d.date === s.drawDate ? "cur" : undefined}>
                  <td>{niceDate(d.date)}</td>
                  <td>
                    {d.ph === "pre" || d.stack.some((id) => CYCLE_CLASSES.has(BYC[id]?.cls)) ? PH[d.ph] + (d.wk && d.ph !== "pre" ? `, wk ${d.wk}` : "") : "–"}
                  </td>
                  <td className="num">{Object.keys(d.vals).length}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="btn"
                      onClick={() => {
                        set((x) => loadDraw(x, d.id));
                        go("triage");
                        scrollTo(0, 0);
                      }}
                    >
                      Open
                    </button>{" "}
                    <button
                      className="btn"
                      aria-label={"Delete draw from " + niceDate(d.date)}
                      onClick={() => {
                        if (confirmDelete(d.date)) set((x) => deleteDraw(x, d.id));
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {Object.keys(s.vals).length > 0 && (
          <div className="btnrow" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => open("save")}>
              Save current results
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// confirm() is blocked inside some embedded previews; fall back to deleting
function confirmDelete(date: string) {
  try {
    return confirm(`Delete the draw from ${niceDate(date)}? This can't be undone.`);
  } catch {
    return true;
  }
}

function ProjLine({ p, onPick }: { p: Projection; onPick: () => void }) {
  const { s } = useStore();
  const m = BYID[p.id];
  const near = p.days <= 42;
  const tv = fmt(m, s.units, p.target) + " " + unitLabel(m, s.units);
  return (
    <li style={vars({ "--c": near ? "var(--risk)" : "var(--warn)" })}>
      <button className="linkish" onClick={onPick}>
        <strong>{m.name}</strong>
      </button>{" "}
      {p.dir === "up" ? "is rising" : "is falling"} about {perMonth(m, s.units, p.per30)} {unitLabel(m, s.units)} a month and hits {p.label} ({tv})
      around <b>{niceDate(p.date)}</b>, in about {weeks(p.days)}.
    </li>
  );
}

function Detail({ id }: { id: string }) {
  const { s, ctx } = useStore();
  const m = BYID[id];
  const pts = series(s.draws, id);
  const proj = project(m, s.sex, pts);
  const r = ctx.ri(m);
  const lines = Object.values(TARGETS[id] ?? {}).map((t) => ({ v: t!.v, label: t!.label.replace(/^the /, "") }));
  return (
    <div className="panel" id="detail">
      <div className="dhead">
        <div>
          <p className="eyebrow">Over time</p>
          <h2>{m.name}</h2>
        </div>
        <span className="leg3">
          <i className="b" />
          typical range <i className="h" />
          on cycle <i className="o" />
          out of range <i className="p" />
          projected
        </span>
      </div>
      <TrendChart m={m} u={s.units} r={r} pts={pts} proj={proj} lines={lines} />
      <p className="gnote">
        Typical {fmt(m, s.units, r[0])}–{fmt(m, s.units, r[1])} {unitLabel(m, s.units)}. Hover or tap the chart for exact values.
      </p>
    </div>
  );
}
