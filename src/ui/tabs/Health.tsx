import { GRADE, HAB, TL } from "../../engine/data/health";
import { BYID } from "../../engine/data/markers";
import {
  comboList,
  egfr,
  gapList,
  gearSignals,
  gearVerdict,
  gStage,
  heartSummary,
  heartTiles,
  kidneyNote,
  showGear,
  supportList,
  timelineIndex,
} from "../../engine/health";
import type { MeKey } from "../../engine/types";
import { Cite } from "../Cite";
import { vars } from "../bits";
import { useStore } from "../store";

export function HealthTab() {
  const { s, ctx, T, set } = useStore();
  const setMe = (k: MeKey, v: string) => set((x) => ({ ...x, me: { ...x.me, [k]: v.replace(/[^\d.]/g, "").slice(0, 5) }, example: false }));
  const G = gapList(ctx).sort((a, b) => Number(a.done) - Number(b.done));
  const C = comboList(ctx);
  const done = G.filter((g) => g.done).length;
  const tiles = heartTiles(ctx);
  const hs = heartSummary(tiles);
  const E = egfr(ctx);
  const andro = ctx.cls("inj") || ctx.cls("oral");
  return (
    <section data-tab="health" className="on">
      <div className="hhero">
        <h1>Stay healthy on your stack</h1>
        <p>What you're missing, what clashes, and what's actually worth adding.</p>
      </div>

      {ctx.onCycleStack && (
        <div className="panel">
          <p className="eyebrow">Cycle timeline: what to test, and when</p>
          <div className="tl">
            {TL.map((st, k) => {
              const i = timelineIndex(ctx);
              return (
                <div key={k} className={"st" + (k < i ? " past" : k === i ? " now" : "")}>
                  <h4>{st.n}</h4>
                  <span className="when">{st.w}</span>
                  <ul>
                    {st.t.map((x, j) => (
                      <li key={j}>
                        <Cite text={x} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showGear(ctx) && <Gear />}

      <div className="panel">
        <p className="eyebrow">Your numbers</p>
        <div className="mine">
          <label>
            Age
            <input inputMode="numeric" placeholder="years" value={s.me.age ?? ""} onChange={(e) => setMe("age", e.target.value)} />
          </label>
          <label>
            Blood pressure
            <span className="bpin">
              <input inputMode="numeric" placeholder="120" aria-label="Systolic" value={s.me.sys ?? ""} onChange={(e) => setMe("sys", e.target.value)} /> /{" "}
              <input inputMode="numeric" placeholder="80" aria-label="Diastolic" value={s.me.dia ?? ""} onChange={(e) => setMe("dia", e.target.value)} />
            </span>
          </label>
          <label>
            Resting heart rate
            <input inputMode="numeric" placeholder="bpm" value={s.me.hr ?? ""} onChange={(e) => setMe("hr", e.target.value)} />
          </label>
        </div>
      </div>

      <div className="two">
        <div className="panel">
          <p className="eyebrow">Heart strain</p>
          <div className="hsum" style={vars({ "--c": hs.c })}>
            <b>{hs.n}</b>
            <span>{hs.d}</span>
          </div>
          <div className="tiles">
            {tiles.map((t) => (
              <div key={t.l} className="tile" style={vars({ "--c": t.c })}>
                <small>{t.l}</small>
                <b>{t.v}</b>
                <span>{t.s}</span>
                <p>
                  <Cite text={t.p} />
                </p>
              </div>
            ))}
          </div>
          {andro && (
            <p className="gnote">
              <Cite text="In a Danish cohort of 1,189 steroid users, the death rate over 11 years was 2.8 times that of non-users. [P67]" />
            </p>
          )}
        </div>
        <div className="panel">
          <p className="eyebrow">Kidney score (eGFR)</p>
          {!E ? (
            <p className="empty">
              {ctx.me("age") ? "Enter creatinine on the Bloodwork tab." : "Enter your age above, and creatinine on the Bloodwork tab."} Add cystatin C
              for a number muscle and creatine can't skew.
            </p>
          ) : (
            <Kidney E={E} />
          )}
        </div>
      </div>

      <div className="panel">
        <p className="eyebrow">Your habits</p>
        <div className="chips2">
          {HAB.map((h) => (
            <button
              key={h.id}
              className="cchip"
              aria-pressed={!!s.hab[h.id]}
              onClick={() => set((x) => ({ ...x, hab: { ...x.hab, [h.id]: !x.hab[h.id] } }))}
            >
              {h.l}
            </button>
          ))}
        </div>
      </div>

      <div className="two">
        <div className="panel">
          <p className="eyebrow">Stack gap check</p>
          {!s.stack.length ? (
            <p className="empty">Add your stack on the Triage tab to see what you should be checking.</p>
          ) : !G.length ? (
            <p className="empty">Nothing extra to monitor for this stack beyond routine bloodwork.</p>
          ) : (
            <>
              <div className="gapscore">
                <b>
                  {done}/{G.length}
                </b>
                <span>covered</span>
              </div>
              <div className="gapbar">
                <i style={{ width: (done / G.length) * 100 + "%" }} />
              </div>
              <ul className="gaps">
                {G.map((g) => (
                  <li key={g.t} className={g.done ? "ok" : "miss"}>
                    <span className="ic">{g.done ? "✓" : "!"}</span>
                    <span>
                      <strong>{g.t}</strong>
                      <small>
                        <Cite text={g.why} />
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="panel">
          <p className="eyebrow">Combo warnings</p>
          <ul className="combos">
            {!s.stack.length ? (
              <li className="empty" style={{ background: "none", border: 0, padding: 0 }}>
                Add your stack to check for risky combos.
              </li>
            ) : C.length ? (
              C.map((c) => (
                <li key={c.t} style={vars({ "--c": c.c })}>
                  <strong>{c.t}</strong>
                  <span>
                    <Cite text={c.d} />
                  </span>
                </li>
              ))
            ) : (
              <li style={vars({ "--c": "var(--ok)" })}>
                <strong>No risky combos found</strong>
                <span>Nothing in your stack doubles up on the same harm.</span>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="panel">
        <p className="eyebrow">Worth adding? Rated by evidence</p>
        <div className="support">
          {supportList(ctx, T).map(({ g, items }) => (
            <div className="scol" key={g}>
              <h3 style={vars({ "--c": GRADE[g].c })}>
                <i />
                {GRADE[g].n}
              </h3>
              {items.map((x) => (
                <div className="sitem" key={x.n}>
                  <strong>{x.n}</strong>
                  <span>
                    <Cite text={x.d} />
                  </span>
                  {x.rel.length > 0 && g !== "avoid" && (
                    <>
                      <br />
                      <span className="rel">Targets your {x.rel.map((m) => BYID[m].name).join(", ")}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="policy">Spotter rates habits and supplements, not drugs. It won't suggest compounds, doses or ancillaries to add to a cycle.</p>
    </section>
  );
}

function Gear() {
  const { ctx } = useStore();
  const G = gearSignals(ctx) ?? [];
  const v = gearVerdict(G);
  return (
    <div className="panel">
      <p className="eyebrow">Is your gear real?</p>
      <div className="gear">
        <div className="gverdict" style={vars({ "--c": v.c })}>
          <b>{v.t}</b>
          <span>{v.s}</span>
        </div>
        <ul className="gsig">
          {G.length ? (
            G.map((g) => (
              <li key={g.t} style={vars({ "--c": g.ok ? "var(--ok)" : "var(--risk)" })}>
                <span className="ic">{g.ok ? "✓" : "!"}</span>
                <span>
                  <strong>{g.t}</strong>
                  <br />
                  <span style={{ color: "var(--muted)" }}>
                    <Cite text={g.d} />
                  </span>
                </span>
              </li>
            ))
          ) : (
            <li style={vars({ "--c": "var(--muted)" })}>
              <span className="ic">?</span>
              <span>No LH or testosterone result yet.</span>
            </li>
          )}
        </ul>
      </div>
      <p className="gnote">
        <Cite text="Across 19 studies, 36% of black-market steroids were counterfeit and another 37% were under- or over-dosed. [P32]" /> Bloodwork
        shows whether you're getting androgen exposure, not what's in the vial. If it looks fake, don't raise the dose to make up for it: the next
        batch could be overdosed or a different drug entirely.
      </p>
    </div>
  );
}

function Kidney({ E }: { E: { ecr: number; ecc: number | null } }) {
  const { ctx } = useStore();
  const best = E.ecc ?? E.ecr;
  const st = gStage(best);
  const tile = (l: string, v: number, sub: string) => {
    const g = gStage(v);
    return (
      <div className="tile" style={vars({ "--c": g.c })}>
        <small>{l}</small>
        <b>{Math.round(v)}</b>
        <span>
          {g.g} · {g.n}
        </span>
        <p>{sub}</p>
      </div>
    );
  };
  return (
    <>
      <div className="hsum" style={vars({ "--c": st.c })}>
        <b>{Math.round(best)}</b>
        <span>
          mL/min/1.73 m² · {st.g}, {st.n.toLowerCase()}
        </span>
      </div>
      <div className="tiles">
        {tile("Creatinine only", E.ecr, "Skewed by muscle and creatine.")}
        {E.ecc != null ? (
          tile("Creatinine + cystatin C", E.ecc, "The more accurate estimate.")
        ) : (
          <div className="tile" style={vars({ "--c": "var(--muted)" })}>
            <small>Creatinine + cystatin C</small>
            <b>–</b>
            <span>Needs cystatin C</span>
            <p>Ask for it with your next draw.</p>
          </div>
        )}
      </div>
      <p className="gnote">
        <Cite text={kidneyNote(ctx, E)} />
        {best < 60 ? " Under 60 needs a doctor, with a repeat test to confirm." : ""}
      </p>
    </>
  );
}
