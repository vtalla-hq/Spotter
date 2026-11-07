import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { niceStep } from "../engine/stats";
import { fromDayNum, type Point, type Projection } from "../engine/trends";
import { factor, fmt, unitLabel } from "../engine/units";
import type { Draw, Marker, Range, Units } from "../engine/types";

/** Width of an element, kept in sync as it resizes, so charts draw at real pixel size and text never scales up. */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const PH_LABEL: Record<Draw["ph"], string> = { pre: "Baseline", on: "On cycle", off: "Off cycle" };
const short = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" });
const long = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });

/** Ticks at round numbers in display units */
function yTicks(m: Marker, u: Units, y0: number, y1: number, want = 4): number[] {
  const f = factor(m, u);
  const step = niceStep(((y1 - y0) * f) / want) / f;
  const out: number[] = [];
  for (let t = Math.ceil(y0 / step - 1e-9) * step; t <= y1 + 1e-9; t += step) out.push(+t.toPrecision(10));
  return out;
}

/** Drop labels that would sit closer than `gap` px to the one before; always keep the last. */
export function thin(xs: number[], gap: number): boolean[] {
  const keep = xs.map(() => false);
  if (!xs.length) return keep;
  keep[xs.length - 1] = true;
  let last = xs[xs.length - 1];
  for (let i = xs.length - 2; i >= 0; i--) {
    if (last - xs[i] >= gap) {
      keep[i] = true;
      last = xs[i];
    }
  }
  return keep;
}

interface ChartProps {
  m: Marker;
  u: Units;
  r: Range;
  pts: Point[];
  proj: Projection | null;
  /** extra lines to draw, e.g. the 54% hematocrit hold point */
  lines: { v: number; label: string }[];
}

/**
 * One marker over time: typical range band, cycle phases shaded behind,
 * guideline lines, your draws, and a dashed projection to the next line it
 * will cross. Hover or tap for exact values.
 */
export function TrendChart({ m, u, r, pts, proj, lines }: ChartProps) {
  const [box, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = W < 520 ? 230 : 280;
  const pl = 46,
    pr = 18,
    pt = 26,
    pb = 30;
  const [lo, hi] = r;
  const last = pts[pts.length - 1];
  const endDay = proj ? last.day + proj.days : last.day;
  const d0 = pts[0].day;
  const d1 = Math.max(endDay, d0 + 14);
  const span = d1 - d0;
  // y range covers the band, the points and the projection; guideline lines only if they're close
  const vals = [...pts.map((p) => p.v), lo, hi, ...(proj ? [proj.target] : [])];
  let y0 = Math.min(...vals);
  let y1 = Math.max(...vals);
  const shown = lines.filter((l) => l.v >= y0 - (y1 - y0) * 0.35 && l.v <= y1 + (y1 - y0) * 0.35);
  shown.forEach((l) => ((y0 = Math.min(y0, l.v)), (y1 = Math.max(y1, l.v))));
  const pad = (y1 - y0) * 0.1 || Math.abs(y1) * 0.1 || 1;
  y0 = Math.max(0, y0 - pad);
  y1 += pad;
  const iw = Math.max(1, W - pl - pr);
  const ih = H - pt - pb;
  // leave room on the right so the last point and its label aren't on the edge
  const X = (d: number) => pl + ((d - d0) / (span * 1.04 || 1)) * iw + iw * 0.02;
  const Y = (v: number) => pt + (1 - (v - y0) / (y1 - y0)) * ih;
  const ticks = yTicks(m, u, y0, y1, H < 250 ? 3 : 4);
  const out = (v: number) => v > hi || v < lo;

  // cycle phase bands: runs of draws in the same phase
  const bands: { ph: Draw["ph"]; a: number; b: number }[] = [];
  pts.forEach((p, i) => {
    if (!p.ph) return;
    const prev = bands[bands.length - 1];
    const mid = i ? (pts[i - 1].day + p.day) / 2 : p.day;
    if (prev && prev.ph === p.ph) prev.b = p.day;
    else {
      if (prev) prev.b = mid;
      bands.push({ ph: p.ph, a: i ? mid : d0, b: p.day });
    }
  });
  if (bands.length) bands[bands.length - 1].b = proj ? endDay : Math.max(bands[bands.length - 1].b, last.day);

  const xs = pts.map((p) => X(p.day));
  const showX = thin(xs, 58);
  const projX = proj ? X(endDay) : 0;
  const lineD = pts.map((p, i) => (i ? "L" : "M") + xs[i].toFixed(1) + "," + Y(p.v).toFixed(1)).join("");
  const lastY = Y(last.v);
  const lastLabelAbove = !proj || proj.target < last.v;

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left + pl;
    let best = 0;
    xs.forEach((px, i) => Math.abs(px - x) < Math.abs(xs[best] - x) && (best = i));
    setHover(best);
  };
  const h = hover != null ? pts[hover] : null;

  return (
    <div className="tchart" ref={box}>
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label={`${m.name} over time`}>
          <defs>
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="3" height="6" fill="var(--ink)" opacity=".05" />
            </pattern>
          </defs>
          {/* phases */}
          {bands.map((b, i) =>
            b.ph === "on" ? (
              <g key={i}>
                <rect x={X(b.a)} y={pt} width={Math.max(0, X(b.b) - X(b.a))} height={ih} fill="url(#hatch)" />
                {X(b.b) - X(b.a) > 64 && (
                  <text className="ph" x={X(b.a) + 6} y={pt + ih - 7}>
                    {PH_LABEL[b.ph]}
                  </text>
                )}
              </g>
            ) : null,
          )}
          {/* typical range */}
          <rect x={pl} width={iw} y={Y(Math.min(hi, y1))} height={Math.max(0, Y(Math.max(lo, y0)) - Y(Math.min(hi, y1)))} className="band" />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pl} x2={W - pr} y1={Y(t)} y2={Y(t)} className="grid" />
              <text className="ytick" x={pl - 8} y={Y(t) + 4} textAnchor="end">
                {fmt(m, u, t)}
              </text>
            </g>
          ))}
          <text className="unit" x={pl - 8} y={pt - 12} textAnchor="end">
            {unitLabel(m, u)}
          </text>
          {W >= 560 && (
            <text className="bandlbl" x={W - pr - 4} y={Y(Math.min(hi, y1)) + 13} textAnchor="end">
              typical range
            </text>
          )}
          {shown.map((l) => (
            <g key={l.v}>
              <line x1={pl} x2={W - pr} y1={Y(l.v)} y2={Y(l.v)} className="redline" />
              <text className="redlbl halo" x={pl + 6} y={Y(l.v) - 5}>
                {l.label} · {fmt(m, u, l.v)}
              </text>
            </g>
          ))}
          {/* projection */}
          {proj && (
            <g className="proj">
              <line x1={X(last.day)} y1={lastY} x2={projX} y2={Y(proj.target)} />
              <circle cx={projX} cy={Y(proj.target)} r={5} />
              <text
                className="halo"
                x={Math.min(projX, W - pr)}
                y={Y(proj.target) + (proj.target > last.v ? -11 : 20)}
                textAnchor={projX > W - pr - 60 ? "end" : "middle"}
              >
                ~{short(fromDayNum(endDay))}
              </text>
            </g>
          )}
          {/* your draws */}
          <path d={lineD} className="line" />
          {pts.map((p, i) => (
            <circle key={p.day} cx={xs[i]} cy={Y(p.v)} r={hover === i ? 6 : 4.5} className={"pt" + (out(p.v) ? " out" : "") + (p.ph === "pre" ? " base" : "")} />
          ))}
          <text className="lastv halo" x={xs[xs.length - 1]} y={lastLabelAbove ? lastY - 12 : lastY + 22} textAnchor={xs[xs.length - 1] > W - pr - 40 ? "end" : "middle"}>
            {fmt(m, u, last.v)}
          </text>
          {pts.map((p, i) =>
            showX[i] ? (
              <text key={"x" + p.day} className="xtick" x={xs[i]} y={H - 8} textAnchor={i === 0 && xs[i] < pl + 24 ? "start" : "middle"}>
                {short(p.date)}
              </text>
            ) : null,
          )}
          {h && hover != null && (
            <line x1={xs[hover]} x2={xs[hover]} y1={pt} y2={pt + ih} className="guide" />
          )}
          <rect
            x={pl}
            y={pt}
            width={iw}
            height={ih}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      {h && hover != null && (
        <div
          className="tip"
          style={{
            left: Math.min(Math.max(xs[hover], 70), W - 70),
            top: Math.max(Y(h.v) - 64, 0),
          }}
        >
          <b>
            {fmt(m, u, h.v)} {unitLabel(m, u)}
          </b>
          <span>
            {long(h.date)}
            {h.ph ? " · " + PH_LABEL[h.ph] : ""}
          </span>
        </div>
      )}
    </div>
  );
}

/** Small line for the overview grid: range band, the line, and the latest point. No text inside. */
export function Spark({ pts, r, proj }: { pts: Point[]; r: Range; proj: Projection | null }) {
  const [box, W] = useWidth<HTMLDivElement>();
  const H = 46;
  const [lo, hi] = r;
  const last = pts[pts.length - 1];
  const d0 = pts[0].day;
  const d1 = Math.max(proj ? last.day + proj.days : last.day, d0 + 7);
  const vals = [...pts.map((p) => p.v), lo, hi, ...(proj ? [proj.target] : [])];
  const y0 = Math.min(...vals);
  const y1 = Math.max(...vals);
  const pad = (y1 - y0) * 0.12 || 1;
  const X = (d: number) => 4 + ((d - d0) / (d1 - d0)) * (W - 10);
  const Y = (v: number) => 3 + (1 - (v - y0 + pad) / (y1 - y0 + 2 * pad)) * (H - 6);
  const out = last.v > hi || last.v < lo;
  return (
    <div ref={box} className="spark">
      {W > 0 && (
        <svg width={W} height={H} aria-hidden="true">
          <rect x={0} width={W} y={Y(hi)} height={Math.max(0, Y(lo) - Y(hi))} className="band" />
          {proj && <line x1={X(last.day)} y1={Y(last.v)} x2={X(last.day + proj.days)} y2={Y(proj.target)} className="sproj" />}
          <path d={pts.map((p, i) => (i ? "L" : "M") + X(p.day).toFixed(1) + "," + Y(p.v).toFixed(1)).join("")} className="line" />
          <circle cx={X(last.day)} cy={Y(last.v)} r={3.5} className={"pt" + (out ? " out" : "")} />
        </svg>
      )}
    </div>
  );
}

