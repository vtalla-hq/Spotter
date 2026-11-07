import { useState } from "react";
import { saveDraw, today } from "../../engine/state";
import { milestone } from "../../features/analytics";
import { Dialog } from "../Dialog";
import { Seg } from "../bits";
import { useStore } from "../store";

export function SaveDrawDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} label="Save this draw">
      <Body onClose={onClose} />
    </Dialog>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const { s, ctx, set, go } = useStore();
  const [date, setDate] = useState(s.drawDate || today());
  const [ph, setPh] = useState(s.cyc.ph);
  const exists = s.draws.some((d) => d.date === date);
  const n = Object.keys(s.vals).length;
  const save = () => {
    set((x) => saveDraw({ ...x, cyc: { ...x.cyc, ph } }, date));
    milestone("draw_saved", { draws: s.draws.length + (exists ? 0 : 1) });
    onClose();
    go("progress");
    scrollTo(0, 0);
  };
  return (
    <>
      <h2>Save this draw</h2>
      <p className="dsub">
        Saves your {n} result{n === 1 ? "" : "s"}, stack and cycle phase under the date the blood was taken, so you can see trends and recovery
        over time. It's kept in this browser, and in your account if you're signed in.
      </p>
      <div className="iopts">
        <label>
          Drawn on <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </label>
        {ctx.onCycleStack && <Seg label="Cycle phase" value={ph} options={[["pre", "Before starting"], ["on", "On cycle"], ["off", "Off cycle"]]} onChange={setPh} />}
      </div>
      {ctx.onCycleStack && <p className="dsub">Mark your first draw "Before starting" to measure recovery against your own baseline later.</p>}
      <div className="foot">
        <span>{exists ? "This replaces the draw already saved for that date." : ""}</span>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" disabled={!/^\d{4}-\d{2}-\d{2}$/.test(date)} onClick={save}>
          Save draw
        </button>
      </div>
    </>
  );
}
