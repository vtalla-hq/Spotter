import { useMemo, useState } from "react";
import { useOpenDialog } from "../../App";
import { BYID, M } from "../../engine/data/markers";
import { BYC } from "../../engine/data/compounds";
import { CYCLE_CLASSES } from "../../engine/ctx";
import { deleteDraw, loadDraw, sampleState } from "../../engine/state";
import { niceStep } from "../../engine/stats";
import { changes, fromDayNum, linearFit, project, projections, recovery, series, TARGETS, type Projection } from "../../engine/trends";
import { factor, fmt, unitLabel } from "../../engine/units";
import type { Draw, Marker } from "../../engine/types";
import { vars } from "../bits";
import { syncConfigured } from "../../features/sync";
import { useStore } from "../store";

const PH: Record<Draw["ph"], string> = { pre: "Baseline", on: "On cycle", off: "Off cycle" };
const niceDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
const weeks = (d: number) => (d < 14 ? `${d} day${d === 1 ? "" : "s"}` : `${Math.round(d / 7)} weeks`);

export function TrendsTab() {
  const { s, set, go } = useStore();
  const open = useOpenDialog();
  const draws = s.draws;
  const P = useMemo(() => projections(draws, s.sex), [draws, s.sex]);
  const R = useMemo(() => recovery(draws, s.sex), [draws, s.sex]);
  const C = useMemo(() => changes(draws), [draws]);
  const tracked = M.filter((m) => series(draws, m.id).length >= 2);
  const [sel, setSel] = useState<string | null>(null);
  const cur = sel && tracked.some((m) => m.id === sel) ? sel : (P[0]?.id ?? tracked[0]?.id ?? null);

  if (!draws.length)
    return (
      <section data-tab="trends" className="on">
        <div className="hhero">
          <h1>Track your bloodwork over time</h1>
          <p>Save each draw and Spotter charts every marker, projects when one will cross a line, and shows how far you've recovered after a cycle.</p>
        </div>
        <div className="panel">
          <p className="eyebrow">No saved draws yet</p>
          <p className="sub">
            Enter or upload your results, then hit "Save this draw" with the date it was taken. Two draws a week or more apart are enough for a trend.
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
    <section data-tab="trends" className="on">
      <div className="hhero">
        <h1>Your trends</h1>
        <p>
          {draws.length} saved draw{draws.length === 1 ? "" : "s"}, {niceDate(draws[0].date)}
          {draws.length > 1 ? " to " + niceDate(draws[draws.length - 1].date) : ""}.
        </p>
      </div>

      {s.example && (
        <div className="notice">
          <span>
            <b>This is a sample history.</b> Clear it from the Triage tab to start your own.
          </span>
        </div>
      )}

      {P.length > 0 && (
        <div className="panel">
          <p className="eyebrow">At this rate</p>
          <ul className="proj">
            {P.slice(0, 6).map((p) => (
              <ProjLine key={p.id} p={p} onPick={() => setSel(p.id)} />
            ))}
          </ul>
          <p className="gnote">
            Straight-line projection from your recent draws in the same cycle phase. Retest before the date, not after: a projection is a nudge,
            not a forecast.
          </p>
        </div>
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
            How far each marker has come back from its worst draw toward your own "before starting" draw. "Past" means it went beyond your
            baseline the other way: after a cycle, low testosterone or LH there usually means your own production hasn't recovered yet.
          </p>
        </div>
      )}

      {tracked.length > 0 && cur && (
        <div className="panel">
          <p className="eyebrow">Chart</p>
          <div className="chips2" style={{ marginBottom: 12 }}>
            {tracked.map((m) => (
              <button key={m.id} className="cchip" aria-pressed={m.id === cur} onClick={() => setSel(m.id)}>
                {m.name}
              </button>
            ))}
          </div>
          <TrendChart m={BYID[cur]} />
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
        <div className="btnrow" style={{ marginTop: 12 }}>
          {Object.keys(s.vals).length > 0 && (
            <button className="btn" onClick={() => open("save")}>
              Save current results
            </button>
          )}
          {syncConfigured && (
            <button className="btn" onClick={() => open("sync")}>
              Sync across devices
            </button>
          )}
        </div>
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

/** monthly change with enough digits to not round to zero */
function perMonth(m: Marker, u: "si" | "us", v: number) {
  const x = Math.abs(v) * factor(m, u);
  return x >= 10 ? Math.round(x).toLocaleString("en-CA") : String(+x.toPrecision(2));
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
      {p.dir === "up" ? "is rising" : "is falling"} about {perMonth(m, s.units, p.per30)} {unitLabel(m, s.units)} a month and hits {p.label} (
      {tv}) around <b>{niceDate(p.date)}</b>, in about {weeks(p.days)}.
    </li>
  );
}

function TrendChart({ m }: { m: Marker }) {
  const { s, ctx } = useStore();
  const pts = series(s.draws, m.id);
  const proj = project(m, s.sex, pts);
  const fit = linearFit(pts.slice(-4));
  const [lo, hi] = ctx.ri(m);
  const W = 640,
    H = 260,
    pl = 52,
    pr = 16,
    pt = 14,
    pb = 34;
  const d0 = pts[0].day;
  const d1 = Math.max(pts[pts.length - 1].day, proj ? pts[pts.length - 1].day + proj.days : 0, d0 + 7);
  const red = Object.values(TARGETS[m.id] ?? {}).map((t) => t!.v);
  const vals = [...pts.map((p) => p.v), lo, hi, ...(proj ? [proj.target] : [])];
  let y0 = Math.min(...vals);
  let y1 = Math.max(...vals);
  red.forEach((r) => {
    if (r > y1 && r - y1 < (y1 - y0) * 0.5) y1 = r;
    if (r < y0 && y0 - r < (y1 - y0) * 0.5) y0 = r;
  });
  const pad = (y1 - y0) * 0.12 || 1;
  y0 = Math.max(0, y0 - pad);
  y1 = y1 + pad;
  const X = (d: number) => pl + ((d - d0) / (d1 - d0 || 1)) * (W - pl - pr);
  const Y = (v: number) => pt + (1 - (v - y0) / (y1 - y0)) * (H - pt - pb);
  const f = factor(m, s.units);
  const step = niceStep(((y1 - y0) * f) / 5) / f;
  const yt: number[] = [];
  for (let t = Math.ceil(y0 / step) * step; t <= y1; t += step) yt.push(t);
  const last = pts[pts.length - 1];
  const line = pts.map((p, i) => (i ? "L" : "M") + X(p.day).toFixed(1) + "," + Y(p.v).toFixed(1)).join("");
  return (
    <svg className="trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${m.name} over time`}>
      <rect x={pl} width={W - pl - pr} y={Y(Math.min(hi, y1))} height={Math.max(0, Y(Math.max(lo, y0)) - Y(Math.min(hi, y1)))} fill="var(--accent-soft)" />
      {yt.map((t) => (
        <g key={t}>
          <line x1={pl} x2={W - pr} y1={Y(t)} y2={Y(t)} stroke="var(--line)" />
          <text x={pl - 8} y={Y(t) + 4} textAnchor="end">
            {fmt(m, s.units, t)}
          </text>
        </g>
      ))}
      {red
        .filter((r) => r >= y0 && r <= y1)
        .map((r) => (
          <g key={r}>
            <line x1={pl} x2={W - pr} y1={Y(r)} y2={Y(r)} stroke="var(--danger)" strokeDasharray="5 4" />
            <text x={W - pr} y={Y(r) - 5} textAnchor="end" style={{ fill: "var(--danger)" }}>
              {fmt(m, s.units, r)}
            </text>
          </g>
        ))}
      {proj && fit && (
        <>
          <line
            x1={X(last.day)}
            y1={Y(last.v)}
            x2={X(last.day + proj.days)}
            y2={Y(proj.target)}
            stroke="var(--risk)"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
          <circle cx={X(last.day + proj.days)} cy={Y(proj.target)} r={5} fill="var(--paper)" stroke="var(--risk)" strokeWidth={2} />
          <text x={X(last.day + proj.days)} y={Y(proj.target) - 10} textAnchor="end" style={{ fill: "var(--risk)", fontWeight: 600 }}>
            {niceDate(fromDayNum(last.day + proj.days))}
          </text>
        </>
      )}
      <path d={line} fill="none" stroke="var(--ink)" strokeWidth={2} />
      {pts.map((p) => {
        const out = p.v > hi || p.v < lo;
        return (
          <g key={p.day}>
            <circle cx={X(p.day)} cy={Y(p.v)} r={5} fill={out ? "var(--risk)" : "var(--ok)"} stroke="var(--paper)" strokeWidth={2} />
            <text x={X(p.day)} y={H - 10} textAnchor="middle">
              {new Date(p.date + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
            </text>
          </g>
        );
      })}
      <text x={pl} y={pt - 2} style={{ fontWeight: 600 }}>
        {unitLabel(m, s.units)}
      </text>
      <title>{`${m.name}: typical ${fmt(m, s.units, lo)}–${fmt(m, s.units, hi)}`}</title>
    </svg>
  );
}
