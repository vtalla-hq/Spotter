import { useMemo, useState } from "react";
import { shortName } from "../../engine/ctx";
import { BYC, CLS } from "../../engine/data/compounds";
import { SILHOUETTE, SPOT, SYS } from "../../engine/data/health";
import { compSys, strain } from "../../engine/health";
import { vars } from "../bits";
import { useStore } from "../store";

const W = 560;
const H = 520;

/** Organs on a body, sized and coloured by strain. Hover a compound to see what it hits. */
export function BodyMap({ onSpot }: { onSpot: (id: string) => void }) {
  const { s, ctx, T } = useStore();
  const [hi, setHi] = useState<string | null>(null);
  const L = useMemo(() => strain(ctx, T), [ctx, T]);
  const LV = Object.fromEntries(L.map((x) => [x.id, x]));
  const comps = s.stack.map((id) => BYC[id]).filter(Boolean);
  const lit = hi && BYC[hi] ? compSys(BYC[hi]) : null;

  // labels: push apart on each side so they don't overlap
  const labels = useMemo(() => {
    const lab: Record<"L" | "R", { id: string; sn: string; n: string; x: number; y: number; ly: number }[]> = { L: [], R: [] };
    SYS.forEach((sy) => {
      const [x, y, side] = SPOT[sy.id];
      lab[side].push({ id: sy.id, sn: sy.sn, n: sy.n, x, y, ly: y });
    });
    (["L", "R"] as const).forEach((k) => {
      const a = lab[k].sort((p, q) => p.y - q.y);
      for (let i = 1; i < a.length; i++) if (a[i].ly - a[i - 1].ly < 40) a[i].ly = a[i - 1].ly + 40;
      const over = a.length ? a[a.length - 1].ly - (H - 24) : 0;
      if (over > 0) a.forEach((o) => (o.ly -= over));
    });
    return [...lab.L, ...lab.R];
  }, []);

  return (
    <div className="bodycard">
      <div className="bhead">
        <span className="t">Load map · where your stack hits</span>
      </div>
      <div className="hchips" onMouseLeave={() => setHi(null)}>
        {comps.length ? (
          <>
            {comps.map((c) => (
              <button
                key={c.id}
                className={hi === c.id ? "on" : undefined}
                style={vars({ "--c": CLS[c.cls].c })}
                onMouseOver={() => setHi(c.id)}
                onFocus={() => setHi(c.id)}
                onBlur={() => setHi(null)}
                onClick={() => setHi(hi === c.id ? null : c.id)}
              >
                {shortName(c)}
              </button>
            ))}
            <span className="hint">hover to see where it hits</span>
          </>
        ) : (
          <span className="hint">Nothing loaded yet. Pick a stack below.</span>
        )}
      </div>
      <div id="map" className={lit ? "dim" : undefined}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Body map showing strain on each organ system">
          <g className="sil" dangerouslySetInnerHTML={{ __html: SILHOUETTE }} />
          {labels.map((o) => {
            const x = LV[o.id];
            const on = x.tot > 0;
            const c = x.lv.c;
            const r = 6 + Math.min(x.tot, 100) * 0.15;
            const left = SPOT[o.id][2] === "L";
            const lx = left ? 112 : 448;
            const ta = left ? "end" : "start";
            const cls = ["spot", x.tot >= 45 ? "hot" : "", lit?.has(o.id) ? "on" : ""].filter(Boolean).join(" ");
            return (
              <g
                key={o.id}
                className={cls}
                tabIndex={0}
                role="button"
                aria-label={`${o.n}, strain ${x.tot}`}
                onClick={() => onSpot(o.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSpot(o.id);
                  }
                }}
              >
                <path
                  className="lead"
                  d={`M${o.x},${o.y} L${left ? lx + 18 : lx - 18},${o.ly} L${left ? lx + 4 : lx - 4},${o.ly}`}
                  stroke={on ? c : "var(--muted)"}
                />
                <circle className="pulse" cx={o.x} cy={o.y} r={r} stroke={c} />
                <circle
                  className="core"
                  cx={o.x}
                  cy={o.y}
                  r={r}
                  fill={on ? c : "var(--paper)"}
                  fillOpacity={on ? (0.35 + x.tot / 180).toFixed(2) : 1}
                  stroke={on ? c : "var(--muted)"}
                  strokeWidth={2}
                />
                <text className="lbl" x={lx} y={o.ly - 2} textAnchor={ta}>
                  {o.sn}
                </text>
                <text className="lsub" x={lx} y={o.ly + 13} textAnchor={ta}>
                  <tspan className="sc" fill={on ? x.lv.c : "var(--muted)"}>
                    {on ? x.tot : "–"}
                  </tspan>{" "}
                  {on ? x.lv.n.toLowerCase() : "no load"}
                </text>
              </g>
            );
          })}
        </svg>
        {!comps.length && !Object.keys(s.vals).length && <p className="empty">Load a stack to light it up.</p>}
      </div>
    </div>
  );
}
