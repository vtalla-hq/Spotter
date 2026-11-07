import { useRef, useState } from "react";
import { BYID } from "../../engine/data/markers";
import { parseReport, type ParsedValue } from "../../engine/parse";
import { saveDraw, today } from "../../engine/state";
import { fmt, fmtInput, toSI, unitLabel } from "../../engine/units";
import { extractText } from "../../features/ocr";
import { milestone } from "../../features/analytics";
import { Dialog } from "../Dialog";
import { Tag } from "../bits";
import { useStore } from "../store";

interface Row extends ParsedValue {
  on: boolean;
  /** value as typed in the review table, in display units */
  edit: string;
}

const BY_LABEL: Record<ParsedValue["by"], [string, string]> = {
  label: ["unit from report", "var(--ok)"],
  same: ["", "var(--ok)"],
  selected: ["", "var(--ok)"],
  plausible: ["unit guessed", "var(--warn)"],
};

export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} id="importDlg" label="Import a lab report">
      <ImportBody onClose={onClose} />
    </Dialog>
  );
}

function ImportBody({ onClose }: { onClose: () => void }) {
  const { s, set, go } = useStore();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<{ msg: string; pct?: number } | null>(null);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [date, setDate] = useState("");
  const [via, setVia] = useState<string>("");
  const [replace, setReplace] = useState(Object.keys(s.vals).length > 0);
  const [keep, setKeep] = useState(true);
  const [drag, setDrag] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const read = (t: string) => {
    const r = parseReport(t, { units: s.units, sex: s.sex });
    if (!r.values.length) {
      setErr("No markers recognized. Check the text below: each result should be on a line with its test name, like 'ALT 78'.");
      setRows(null);
      return;
    }
    setErr("");
    setDate(r.date ?? "");
    setRows(r.values.map((v) => ({ ...v, on: true, edit: fmtInput(BYID[v.id], s.units, v.si) })));
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setErr("");
    setRows(null);
    setBusy({ msg: "Starting…" });
    try {
      const r = await extractText(f, (msg, pct) => setBusy({ msg, pct }));
      setText(r.text);
      setVia(r.method === "ocr" ? "Read with OCR. Check each value against your report." : "Read from the PDF's text.");
      milestone(r.method === "ocr" ? "report_ocr" : "report_pdf");
      read(r.text);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setBusy(null);
    }
  };

  const apply = () => {
    if (!rows) return;
    const picked: Record<string, number> = {};
    for (const r of rows) {
      if (!r.on) continue;
      const v = parseFloat(r.edit);
      if (Number.isFinite(v) && v >= 0) picked[r.id] = toSI(BYID[r.id], s.units, v);
    }
    if (!Object.keys(picked).length) return;
    set((x) => {
      let n = { ...x, vals: replace ? picked : { ...x.vals, ...picked }, example: false, drawDate: date || "" };
      if (x.example) n = { ...n, stack: [], train: false, me: {}, draws: [] };
      if (keep && date) n = saveDraw(n, date);
      return n;
    });
    milestone("report_imported", { markers: Object.keys(picked).length });
    onClose();
    go("triage");
    scrollTo(0, 0);
  };

  const nOn = rows?.filter((r) => r.on).length ?? 0;
  return (
    <>
      <h2>Add a lab report</h2>
      {!rows && (
        <>
          <p className="dsub">Upload a PDF or a photo of your results, or paste the text from your portal. It's read on your device and never uploaded.</p>
          <div
            className={"drop" + (drag ? " over" : "")}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              onFile(e.dataTransfer.files[0]);
            }}
          >
            {busy ? (
              <div className="busy" role="status">
                <span>{busy.msg}</span>
                {busy.pct != null && (
                  <span className="pbar">
                    <i style={{ width: busy.pct + "%" }} />
                  </span>
                )}
              </div>
            ) : (
              <>
                <b>Drop a PDF or photo here</b>
                <span>LifeLabs, Dynacare, hospital portals, or a clear phone photo</span>
                <button className="btn primary" onClick={() => file.current?.click()}>
                  Choose file
                </button>
              </>
            )}
            <input ref={file} type="file" accept="application/pdf,image/*" hidden onChange={(e) => onFile(e.target.files?.[0] ?? undefined)} />
          </div>
          <p className="or">or paste the text</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Hematocrit 0.53 L/L\nALT 78 U/L\nHDL Cholesterol 0.62 mmol/L\nCK 1450 U/L"}
          />
          <div className="foot">
            <span>{err || `Numbers without a unit are read as ${s.units === "si" ? "SI" : "US"}, unless that would be implausible.`}</span>
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={!text.trim() || !!busy} onClick={() => read(text)}>
              Read values
            </button>
          </div>
        </>
      )}

      {rows && (
        <>
          <p className="dsub">
            Found {rows.length} result{rows.length === 1 ? "" : "s"}. {via} Untick anything that's wrong, or fix the number.
          </p>
          <div className="review">
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Marker</th>
                  <th>Value ({s.units === "si" ? "SI" : "US"})</th>
                  <th>From the report</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const m = BYID[r.id];
                  const [lbl, c] = r.check ? ["check this", "var(--danger)"] : BY_LABEL[r.by];
                  const upd = (p: Partial<Row>) => setRows((rs) => rs!.map((x, j) => (j === i ? { ...x, ...p } : x)));
                  return (
                    <tr key={r.id} className={r.on ? undefined : "off"}>
                      <td>
                        <input type="checkbox" checked={r.on} aria-label={"Use " + m.name} onChange={(e) => upd({ on: e.target.checked })} />
                      </td>
                      <td>
                        <strong>{m.name}</strong>
                      </td>
                      <td>
                        <input className="rin" inputMode="decimal" value={r.edit} aria-label={m.name + " value"} onChange={(e) => upd({ edit: e.target.value })} />{" "}
                        <span className="u">{unitLabel(m, s.units)}</span>
                      </td>
                      <td>
                        <span className="src" title={r.line}>
                          {r.raw} {r.unit !== s.units && r.by !== "same" ? `${unitLabel(m, r.unit)} → ${fmt(m, s.units, r.si)}` : ""}
                        </span>{" "}
                        {lbl && <Tag c={c}>{lbl}</Tag>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="iopts">
            <label>
              Drawn on <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="switch">
              <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Save to my history
              {!date && keep ? " (add the date)" : ""}
            </label>
            {Object.keys(s.vals).length > 0 && !s.example && (
              <label className="switch">
                <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Replace my current results
              </label>
            )}
          </div>
          <div className="foot">
            <span>{err}</span>
            <button className="btn" onClick={() => setRows(null)}>
              Back
            </button>
            <button className="btn primary" disabled={!nOn} onClick={apply}>
              Use {nOn} result{nOn === 1 ? "" : "s"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
