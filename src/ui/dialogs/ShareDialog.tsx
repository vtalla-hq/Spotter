import { useEffect, useRef, useState } from "react";
import { shortName } from "../../engine/ctx";
import { BYC } from "../../engine/data/compounds";
import { bpCat, gapList } from "../../engine/health";
import { buckets } from "../../engine/triage";
import { Dialog } from "../Dialog";
import { useStore } from "../store";

const W = 1200;
const H = 630;
const col = { bg: "#101318", ink: "#f2f4f6", mut: "#97a3ae", line: "#26303a", danger: "#f26b6b", risk: "#f28b54", calm: "#8fb0cc", ok: "#5cc489", acc: "#7aa2ff" };
const DISPLAY = "'Archivo', 'Arial Narrow', sans-serif";
const SANS = "Archivo, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

function siteHost() {
  return /^https?:/.test(location.protocol) && location.host && !/claude|localhost|usercontent|127\.0\.0\.1/.test(location.host)
    ? location.host
    : "spotterlabs.vercel.app";
}

/** Shareable result card: triage counts only, never values. Stack only if ticked. */
export default function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { s, ctx, T } = useStore();
  const cv = useRef<HTMLCanvasElement>(null);
  const [inc, setInc] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        await document.fonts.ready;
      } catch {
        /* ignore */
      }
      if (!live || !cv.current) return;
      const x = cv.current.getContext("2d")!;
      const B = buckets(ctx, T);
      const C = { act: B.act.length, fix: B.fix.length, exp: B.exp.length, ok: B.fine, n: B.n };
      const G = gapList(ctx);
      x.fillStyle = col.bg;
      x.fillRect(0, 0, W, H);
      x.fillStyle = col.acc;
      x.fillRect(0, 0, W, 8);
      x.fillStyle = col.ink;
      x.font = `800 54px ${DISPLAY}`;
      x.fillText("SPOTTER", 64, 100);
      const bw = x.measureText("SPOTTER").width;
      x.fillStyle = col.mut;
      x.font = `500 26px ${SANS}`;
      x.fillText("bloodwork for lifters · my triage", 64 + bw + 20, 98);
      x.fillStyle = col.ink;
      let hs = 64;
      do {
        x.font = `800 ${hs}px ${DISPLAY}`;
        hs -= 2;
      } while (x.measureText("I'VE GOT SOMETHING TO ACT ON.").width > W - 128 && hs > 30);
      const head = C.act ? "I've got something to act on." : C.fix ? "A few things to fix." : C.n ? "My bloodwork checks out." : "Checking my bloodwork.";
      x.fillText(head.toUpperCase(), 64, 196);
      const cells: [number, string, string][] = [
        [C.act, "act now", col.danger],
        [C.fix, "fix or ask", col.risk],
        [C.exp, "expected", col.calm],
        [C.ok, "in range", col.ok],
      ];
      const cw = (W - 128 - 3 * 24) / 4;
      cells.forEach(([v, l, c], i) => {
        const cx = 64 + i * (cw + 24);
        const cy = 240;
        x.fillStyle = "#151a20";
        x.beginPath();
        if (x.roundRect) x.roundRect(cx, cy, cw, 170, 14);
        else x.rect(cx, cy, cw, 170);
        x.fill();
        x.fillStyle = c;
        x.fillRect(cx, cy, cw, 6);
        x.font = `600 84px ${MONO}`;
        x.fillText(String(v), cx + 24, cy + 112);
        x.fillStyle = col.mut;
        x.font = `600 26px ${SANS}`;
        x.fillText(l, cx + 24, cy + 150);
      });
      x.font = `500 26px ${SANS}`;
      x.fillStyle = col.ink;
      let y = 468;
      const parts: string[] = [];
      if (G.length) parts.push(`Monitoring ${G.filter((g) => g.done).length}/${G.length} covered`);
      const sy = ctx.me("sys");
      const di = ctx.me("dia");
      if (sy && di && !bpCat(sy, di).bad) parts.push("BP " + bpCat(sy, di).n.toLowerCase());
      parts.push(C.n + " markers checked");
      x.fillText(parts.join("  ·  "), 64, y);
      if (inc && s.stack.length) {
        y += 44;
        x.fillStyle = col.mut;
        const full = "Stack: " + s.stack.map((id) => shortName(BYC[id])).join(", ");
        let t = full;
        while (x.measureText(t).width > W - 128 && t.length > 10) t = t.slice(0, -2);
        if (t.length < full.length) t = t.slice(0, -1) + "…";
        x.fillText(t, 64, y);
      }
      x.fillStyle = col.line;
      x.fillRect(64, H - 78, W - 128, 1);
      x.fillStyle = col.mut;
      x.font = `500 24px ${SANS}`;
      x.fillText("Is it your stack, or is it a problem? Check yours at", 64, H - 36);
      x.fillStyle = col.acc;
      x.font = `600 24px ${MONO}`;
      x.fillText(siteHost(), W - 64 - x.measureText(siteHost()).width, H - 36);
    })();
    return () => {
      live = false;
    };
  }, [ctx, T, s.stack, inc]);

  const blob = () =>
    new Promise<Blob | null>((r) => {
      try {
        cv.current!.toBlob((b) => r(b), "image/png");
      } catch {
        r(null);
      }
    });
  const download = async () => {
    const b = await blob();
    if (!b) return setMsg("Couldn't make the image here.");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = "spotter-result.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const share = async () => {
    const b = await blob();
    try {
      const file = b && new File([b], "spotter-result.png", { type: "image/png" });
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Spotter result", text: "Check your bloodwork at https://" + siteHost() });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: "Spotter", text: "Check your bloodwork at https://" + siteHost() });
        return;
      }
      setMsg("Sharing isn't supported here. Use Download.");
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError")) setMsg("Sharing didn't work here. Use Download.");
    }
  };
  return (
    <Dialog open={open} onClose={onClose} id="shareDlg" label="Share your result">
      <h2>Share your result</h2>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 10px" }}>
        Shows your triage counts, not your numbers. Your stack is only included if you tick the box.
      </p>
      <canvas ref={cv} width={W} height={H} />
      <div className="foot">
        <label className="switch" style={{ marginRight: "auto", fontSize: 14 }}>
          <input type="checkbox" checked={inc} onChange={(e) => setInc(e.target.checked)} /> Include my stack
        </label>
        <span>{msg}</span>
        <button className="btn" onClick={onClose}>
          Close
        </button>
        <button className="btn" onClick={download}>
          Download
        </button>
        <button className="btn primary" onClick={share}>
          Share
        </button>
      </div>
    </Dialog>
  );
}
