import { useEffect, useState } from "react";
import { useOpenDialog } from "../../App";
import { shortName } from "../../engine/ctx";
import { ACT } from "../../engine/data/actions";
import { BYID, M, PANELS } from "../../engine/data/markers";
import { density, fitParams, niceStep, ordinal, percentile } from "../../engine/stats";
import { KTAG, offDir, redFlags, rowStatus } from "../../engine/triage";
import { factor, fmt, fmtInput, toSI, unitLabel } from "../../engine/units";
import type { Marker } from "../../engine/types";
import { Cite } from "../Cite";
import { Tag } from "../bits";
import { useStore } from "../store";

export function BloodworkTab() {
  const { s, route } = useStore();
  const open = useOpenDialog();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const groups = PANELS.map((p, i) => ({
    p,
    list: M.filter((m) => m.panel === i && (!query || (m.name + " " + m.abbr + " " + m.al.join(" ")).toLowerCase().includes(query))),
  })).filter((g) => g.list.length);
  const m = BYID[route.sel] || M[0];
  return (
    <section data-tab="bloodwork" className="on">
      <div className="split">
        <div className="panel list">
          <div className="listhead">
            <input className="search" type="search" placeholder="Search markers" aria-label="Search markers" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn" onClick={() => open("import")}>
              Upload or paste report
            </button>
            {Object.keys(s.vals).length > 0 && (
              <button className="btn" onClick={() => open("save")}>
                Save this draw
              </button>
            )}
          </div>
          <div>
            {groups.length ? (
              groups.map((g) => (
                <div key={g.p}>
                  <div className="ph">{g.p}</div>
                  {g.list.map((x) => (
                    <Row key={x.id + s.units} m={x} />
                  ))}
                </div>
              ))
            ) : (
              <p className="empty" style={{ padding: 16 }}>
                No markers match.
              </p>
            )}
          </div>
        </div>
        <aside className="panel sheet" aria-live="polite">
          <Sheet m={m} />
        </aside>
      </div>
    </section>
  );
}

function Row({ m }: { m: Marker }) {
  const { s, ctx, set, route, go } = useStore();
  const x = s.vals[m.id];
  const [draft, setDraft] = useState(fmtInput(m, s.units, x));
  useEffect(() => setDraft(fmtInput(m, s.units, x)), [x, m, s.units]);
  const fxd = ctx.active.filter((c) => c.fx.some((z) => z.m === m.id));
  const st = rowStatus(ctx, m);
  const select = () => {
    if (route.sel !== m.id) history.replaceState(null, "", "/bloodwork/" + m.id);
    go("bloodwork", m.id);
  };
  const commit = () => {
    const raw = draft.replace(/,/g, "").trim();
    if (raw === "") {
      if (x != null)
        set((s) => {
          const vals = { ...s.vals };
          delete vals[m.id];
          return { ...s, vals, example: false };
        });
      return;
    }
    const v = parseFloat(raw);
    if (!Number.isFinite(v) || v < 0) {
      setDraft(fmtInput(m, s.units, x));
      return;
    }
    const si = toSI(m, s.units, v);
    if (si !== x) set((s) => ({ ...s, vals: { ...s.vals, [m.id]: si }, example: false }));
  };
  return (
    <div
      className={"row" + (route.sel === m.id ? " sel" : "")}
      role="button"
      tabIndex={0}
      aria-label={m.name}
      onClick={select}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          select();
        }
      }}
    >
      <div className="nm">
        <strong>{m.name}</strong>
        <small>{unitLabel(m, s.units)}</small>
        {fxd.length > 0 && <small className="fxd"> · affected by {fxd.map(shortName).join(", ")}</small>}
      </div>
      <input
        inputMode="decimal"
        aria-label={`Your ${m.name} in ${unitLabel(m, s.units)}`}
        placeholder="add"
        value={draft}
        onFocus={select}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      {st ? <Tag c={st.c}>{st.label}</Tag> : <Tag c="var(--muted)">–</Tag>}
    </div>
  );
}

function Sheet({ m }: { m: Marker }) {
  const { s, ctx } = useStore();
  const x = s.vals[m.id];
  const [lo, hi] = ctx.ri(m);
  const d = offDir(ctx, m, x);
  const fx = ctx.active.flatMap((c) => c.fx.filter((z) => z.m === m.id).map((z) => ({ c, z })));
  const acts = d ? (ACT[m.id]?.[d] ?? []) : [];
  const red = x != null ? redFlags(ctx, m, x) : [];
  return (
    <>
      <p className="eyebrow">{PANELS[m.panel]}</p>
      <h2>{m.name}</h2>
      <div className="abbr">{m.abbr}</div>
      {x != null ? (
        <div className="big">
          <span className="v">{fmt(m, s.units, x)}</span>
          <span className="u">{unitLabel(m, s.units)}</span>
          <span className="p">{ordinal(percentile(m, [lo, hi], x))} percentile</span>
        </div>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "12px 0 0" }}>Enter a value to see where you land.</p>
      )}
      {red.map((r, i) => (
        <p key={i} className="flagline" style={{ color: "var(--danger)" }}>
          <Cite text={r.txt} />
        </p>
      ))}
      <Curve m={m} x={x} />
      <dl className="facts">
        <dt>Typical range</dt>
        <dd className="num">
          {fmt(m, s.units, lo)}–{fmt(m, s.units, hi)} {unitLabel(m, s.units)}
        </dd>
      </dl>
      <h3>What it is</h3>
      <p>{m.what}</p>
      <h3>Your stack and this marker</h3>
      {fx.length ? (
        <ul>
          {fx.map(({ c, z }, i) => (
            <li key={i}>
              <strong>{c.name}</strong> {z.d === "up" ? "raises" : "lowers"} it <Tag c={KTAG[z.k][1]}>{KTAG[z.k][0]}</Tag>
              <br />
              <Cite text={z.why} />
            </li>
          ))}
        </ul>
      ) : (
        <p>Nothing in your stack is known to move this marker.</p>
      )}
      {acts.length > 0 && (
        <>
          <h3>What to do</h3>
          <ul>
            {acts.map((a, i) => (
              <li key={i}>
                <Cite text={a} />
              </li>
            ))}
          </ul>
        </>
      )}
      <p style={{ fontSize: 12, color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 16 }}>
        Percentile estimated by fitting a {m.dist === "log" ? "log-normal" : "normal"} curve to the typical range (2.5th–97.5th). It ignores age.
      </p>
    </>
  );
}

/** Distribution curve with the typical range shaded and your value marked */
export function Curve({ m, x }: { m: Marker; x: number | undefined }) {
  const { s, ctx } = useStore();
  const W = 520,
    H = 170,
    pl = 8,
    pr = 8,
    pt = 10,
    pb = 40;
  const r = ctx.ri(m);
  const [lo, hi] = r;
  const p = fitParams(m, r);
  let a: number, b: number;
  if (m.dist === "log") {
    a = Math.exp(p.mu - 3.2 * p.sd);
    b = Math.exp(p.mu + 3.2 * p.sd);
  } else {
    a = p.mu - 3.8 * p.sd;
    b = p.mu + 3.8 * p.sd;
  }
  if (x != null) {
    const sp = b - a;
    a = Math.min(a, x - sp * 0.04);
    b = Math.max(b, x + sp * 0.06);
  }
  a = Math.max(0, a);
  const N = 220;
  const ys: [number, number][] = [];
  let ym = 0;
  for (let i = 0; i <= N; i++) {
    const v = a + ((b - a) * i) / N;
    const y = density(m, r, v);
    ys.push([v, y]);
    if (y > ym) ym = y;
  }
  const X = (v: number) => pl + ((v - a) / (b - a)) * (W - pl - pr);
  const Y = (v: number) => pt + (1 - v / ym) * (H - pt - pb);
  const line = ys.map(([v, y], i) => (i ? "L" : "M") + X(v).toFixed(1) + "," + Y(y).toFixed(1)).join("");
  const rp = ys.filter(([v]) => v >= lo && v <= hi);
  const area = rp.length
    ? "M" + X(rp[0][0]).toFixed(1) + "," + Y(0) + rp.map(([v, y]) => "L" + X(v).toFixed(1) + "," + Y(y).toFixed(1)).join("") + "L" + X(rp[rp.length - 1][0]).toFixed(1) + "," + Y(0) + "Z"
    : "";
  const by = Y(0) + 18;
  const f = factor(m, s.units);
  const st = niceStep(((b - a) * f) / 5) / f;
  const ticks: number[] = [];
  for (let t = Math.ceil(a / st) * st; t <= b; t += st) if (![lo, hi].some((k) => Math.abs(X(k) - X(t)) < 34)) ticks.push(t);
  const d = x != null ? offDir(ctx, m, x) : null;
  const c = d ? "var(--risk)" : "var(--ok)";
  return (
    <svg className="curve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={"Typical distribution of " + m.name}>
      <path d={area} fill="var(--accent-soft)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} />
      <line x1={pl} x2={W - pr} y1={Y(0)} y2={Y(0)} stroke="var(--line)" />
      {ticks.map((t) => (
        <text key={t} x={X(t).toFixed(1)} y={by} textAnchor="middle">
          {fmt(m, s.units, t)}
        </text>
      ))}
      {[lo, hi].map((t) => (
        <g key={t}>
          <line x1={X(t)} x2={X(t)} y1={pt} y2={Y(0)} stroke="var(--accent)" strokeDasharray="3 3" opacity={0.55} />
          <text x={X(t).toFixed(1)} y={by} textAnchor="middle" style={{ fill: "var(--accent)", fontWeight: 600 }}>
            {fmt(m, s.units, t)}
          </text>
        </g>
      ))}
      {x != null && (
        <g>
          <line x1={X(x)} x2={X(x)} y1={pt} y2={Y(0)} stroke={c} strokeWidth={2.5} />
          <circle cx={X(x)} cy={Y(density(m, r, x))} r={5} fill={c} stroke="var(--paper)" strokeWidth={2} />
          <text x={X(x)} y={by + 16} textAnchor={X(x) > W * 0.8 ? "end" : X(x) < W * 0.2 ? "start" : "middle"} style={{ fill: c, fontWeight: 600 }}>
            You: {fmt(m, s.units, x)}
          </text>
        </g>
      )}
    </svg>
  );
}
