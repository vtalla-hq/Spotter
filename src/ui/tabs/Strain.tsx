import { useMemo } from "react";
import { shortName } from "../../engine/ctx";
import { BYID } from "../../engine/data/markers";
import { flagColor, flagStatus, strain } from "../../engine/health";
import { fmt, unitLabel } from "../../engine/units";
import { Cite } from "../Cite";
import { Go, Tag, uniq, vars } from "../bits";
import { useStore } from "../store";

export function StrainPanel({ open, setOpen }: { open: Set<string>; setOpen: (fn: (o: Set<string>) => Set<string>) => void }) {
  const { s, ctx, T } = useStore();
  const L = useMemo(() => strain(ctx, T), [ctx, T]);
  const on = L.filter((x) => x.touched);
  const off = L.filter((x) => !x.touched);
  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  return (
    <div className="panel strain">
      <div className="shead">
        <div>
          <p className="eyebrow">Organ strain</p>
          <h2>Where your stack is hitting you</h2>
        </div>
        <span className="leg2">
          <i className="c" />
          confirmed by your bloodwork <i className="p" />
          expected from your stack
        </span>
      </div>
      <div className="srows">
        {on.map((x) => {
          const sub = [
            x.C.length ? `${x.C.length} flagged result${x.C.length > 1 ? "s" : ""}` : x.labs ? "results in range" : "no results entered",
            x.P.length ? `${x.P.length} stack effect${x.P.length > 1 ? "s" : ""}` : "no stack effects",
          ].join(" · ");
          const isOpen = open.has(x.id);
          return (
            <div key={x.id} className={"srow" + (isOpen ? " open" : "")} id={"sys-" + x.id} style={vars({ "--c": x.lv.c, "--sc": x.lv.c })}>
              <button aria-expanded={isOpen} onClick={() => toggle(x.id)}>
                <span className="nm">
                  <i />
                  {x.n}
                </span>
                <span className="lv">{x.lv.n}</span>
                <span className="sc">{x.tot}</span>
                <span className="chev">⌄</span>
                <span className="trk">
                  <i className="c" style={{ width: x.conf + "%" }} />
                  <i className="p" style={{ width: x.tot - x.conf + "%" }} />
                </span>
                <span className="sub2">{sub}</span>
              </button>
              <div className="det">
                <ul>
                  {x.C.map((c, i) =>
                    c.t ? (
                      <li key={"c" + i}>
                        <Tag c={flagColor(c.t)}>{flagStatus(c.t)}</Tag>
                        <span>
                          <Go tab="bloodwork" sel={c.t.m.id} className="mk">
                            {c.t.m.name}
                          </Go>{" "}
                          <span className="num">
                            {fmt(c.t.m, s.units, c.t.x)} {unitLabel(c.t.m, s.units)}
                          </span>
                          {c.t.cs.length ? " · from " + uniq(c.t.cs.map((z) => shortName(z.c))).join(", ") : ""}
                        </span>
                      </li>
                    ) : (
                      <li key={"c" + i}>
                        <Tag c={c.c!}>{c.s}</Tag>
                        <span>{c.v}</span>
                      </li>
                    ),
                  )}
                  {x.P.map((p, i) => (
                    <li key={"p" + i}>
                      <Tag c={p.f.k === "risk" ? "var(--risk)" : "var(--calm)"}>{p.f.k === "risk" ? "Harm" : "Expected"}</Tag>
                      <span>
                        <strong>{shortName(p.c)}</strong>
                        {p.f.m ? ` ${p.f.d === "up" ? "raises" : "lowers"} ${BYID[p.f.m].name}. ` : ": "}
                        <Cite text={p.f.why} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
      {off.length > 0 && <p className="untouched">Not touched by your stack or results: {off.map((x) => x.n).join(", ")}.</p>}
      <p className="snote">
        0–100. Flagged results count most; what your stack is known to do counts less once you have results for that system. A low score means
        nothing is flagged, not that it's safe.
      </p>
    </div>
  );
}
