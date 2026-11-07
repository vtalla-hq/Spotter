import { useState } from "react";
import { Dialog } from "../Dialog";
import { useStore } from "../store";

// Set VITE_FEEDBACK_URL to a Formspree/Tally endpoint to collect privately; otherwise it opens a prefilled GitHub issue.
const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_URL as string | undefined;
const KINDS: [string, string][] = [
  ["Bug", "Bug"],
  ["Missing compound or marker", "Missing compound"],
  ["Something looks wrong", "Looks wrong"],
  ["Idea", "Idea"],
];

export function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} id="fbDlg" label="Send feedback">
      <Body onClose={onClose} />
    </Dialog>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const { s, route } = useStore();
  const [kind, setKind] = useState("Idea");
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");
  const [out, setOut] = useState("");
  const send = async () => {
    const m = msg.trim();
    if (!m) return setOut("Write something first.");
    const meta = `Tab: ${route.tab} · Stack: ${s.stack.join(", ") || "none"} · ${innerWidth < 700 ? "mobile" : "desktop"}`;
    if (FEEDBACK_URL) {
      try {
        const r = await fetch(FEEDBACK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ type: kind, message: m, email, context: meta }),
        });
        if (!r.ok) throw new Error();
        setOut("Thanks, got it.");
        setMsg("");
        setTimeout(onClose, 1200);
      } catch {
        setOut("Couldn't send. Try again later.");
      }
      return;
    }
    const url =
      "https://github.com/vtalla-hq/spotter/issues/new?title=" +
      encodeURIComponent(`[${kind}] ${m.slice(0, 60)}`) +
      "&body=" +
      encodeURIComponent(m + "\n\n---\n" + meta);
    try {
      open(url, "_blank", "noopener");
    } catch {
      /* ignore */
    }
    setOut("Opened GitHub to send it.");
  };
  return (
    <>
      <h2>Send feedback</h2>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 12px" }}>
        Bug, missing compound, wrong range, idea? Don't include anything that identifies you or your lab results unless you want to.
      </p>
      <div className="fbtypes" role="radiogroup" aria-label="Feedback type">
        {KINDS.map(([v, l]) => (
          <button key={v} aria-pressed={kind === v} onClick={() => setKind(v)}>
            {l}
          </button>
        ))}
      </div>
      <textarea
        autoFocus
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="What happened, or what would make Spotter better?"
        style={{ minHeight: 120, marginTop: 10 }}
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email, if you want a reply (optional)"
        style={{ width: "100%", marginTop: 8, padding: "9px 10px", border: "1px solid var(--line)", background: "var(--bg)" }}
      />
      <div className="foot">
        <span>{out}</span>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" onClick={send}>
          Send
        </button>
      </div>
    </>
  );
}
