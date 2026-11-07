import { useRef, useState } from "react";
import { doctorSheet } from "../../engine/doctor";
import { Dialog } from "../Dialog";
import { useStore } from "../store";

export function DoctorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} id="docDlg" label="Doctor sheet">
      <Body onClose={onClose} />
    </Dialog>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const { ctx, T } = useStore();
  const D = doctorSheet(ctx, T);
  const ref = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ref.current?.innerText ?? "");
      setMsg("Copied.");
    } catch {
      setMsg("Couldn't copy here. Select the text instead.");
    }
  };
  return (
    <>
      <h2>Doctor sheet</h2>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 6px" }}>
        A one-page summary to print or show at your appointment. It lists what you take, not how much.
      </p>
      <div className="doc" ref={ref}>
        <p className="meta">
          Prepared {new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })} with Spotter · {D.sex}
          {D.age ? ", age " + D.age : ""}
        </p>
        <h3>What I take</h3>
        {D.stack.length ? (
          <ul>
            {D.stack.map((c) => (
              <li key={c.name}>
                {c.name} <span className="meta">({c.cls})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="meta">Nothing listed.</p>
        )}
        {D.phase && (
          <p>
            <strong>Blood drawn:</strong> {D.phase}
          </p>
        )}
        {D.trained && (
          <p>
            <strong>Trained hard in the 7 days before the draw</strong> (raises CK, AST and ALT).
          </p>
        )}
        <h3>Vitals</h3>
        <p>
          Blood pressure: {D.bp} · Resting heart rate: {D.hr}
          {D.egfr ? " · eGFR: " + D.egfr : ""}
        </p>
        <h3>Flagged results</h3>
        {D.rows.length ? (
          <table>
            <thead>
              <tr>
                <th>Marker</th>
                <th>Result</th>
                <th>Typical</th>
                <th>Status</th>
                <th>Possibly from</th>
              </tr>
            </thead>
            <tbody>
              {D.rows.map((r) => (
                <tr key={r.name}>
                  <td>
                    <strong>{r.name}</strong>
                  </td>
                  <td className="num">{r.result}</td>
                  <td className="num">{r.typical}</td>
                  <td>{r.status}</td>
                  <td>{r.from}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="meta">Nothing flagged.</p>
        )}
        {D.tests.length > 0 && (
          <>
            <h3>Tests I'd like to add</h3>
            <ul>
              {D.tests.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </>
        )}
        {D.questions.length > 0 && (
          <>
            <h3>My questions</h3>
            <ul>
              {D.questions.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </>
        )}
        <p className="meta" style={{ marginTop: 18 }}>
          Status comes from Spotter, an educational tool that compares results to typical adult ranges and known effects of the listed compounds. It
          is not a diagnosis.
        </p>
      </div>
      <div className="foot">
        <span>{msg}</span>
        <button className="btn" onClick={copy}>
          Copy text
        </button>
        <button className="btn" onClick={onClose}>
          Close
        </button>
        <button
          className="btn primary"
          onClick={() => {
            try {
              print();
            } catch {
              /* ignore */
            }
          }}
        >
          Print
        </button>
      </div>
    </>
  );
}
