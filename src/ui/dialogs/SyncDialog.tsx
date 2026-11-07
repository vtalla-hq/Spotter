import { useEffect, useState } from "react";
import { WrongPassphrase } from "../../engine/vault";
import { getPass, getSession, hasRemote, sendLink, signOut, syncConfigured, syncNow, unlock } from "../../features/sync";
import { milestone } from "../../features/analytics";
import { Dialog } from "../Dialog";
import { useStore } from "../store";

type Step = "loading" | "off" | "signin" | "sent" | "create" | "unlock" | "ready";

export default function SyncDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} label="Sync across devices">
      <Body onClose={onClose} />
    </Dialog>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const { s, set } = useStore();
  const [step, setStep] = useState<Step>("loading");
  const [email, setEmail] = useState("");
  const [who, setWho] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!syncConfigured) return setStep("off");
    try {
      const sess = await getSession();
      if (!sess) return setStep("signin");
      setWho(sess.user.email ?? "");
      if (getPass()) return setStep("ready");
      setStep((await hasRemote()) ? "unlock" : "create");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't reach the sync server.");
      setStep("signin");
    }
  };
  useEffect(() => {
    refresh();
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg("");
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof WrongPassphrase ? e.message : e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };
  const doSync = () =>
    run(async () => {
      const merged = await syncNow(s);
      set(() => merged);
      milestone("synced");
      setMsg(`Synced ${merged.draws.length} draw${merged.draws.length === 1 ? "" : "s"}.`);
    });

  return (
    <>
      <h2>Sync across devices</h2>
      {step === "loading" && <p className="dsub">Checking…</p>}
      {step === "off" && (
        <p className="dsub">
          Sync isn't switched on for this copy of Spotter yet. Everything still works and saves in this browser. (Site owner: see "Sync" in the
          README.)
        </p>
      )}
      {step === "signin" && (
        <>
          <p className="dsub">
            Keep your saved draws on your phone and laptop. Your data is encrypted with a passphrase before it leaves this browser, so the server only
            stores scrambled bytes. Start with an email sign-in link.
          </p>
          <div className="iopts">
            <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" style={{ flex: 1 }} />
          </div>
        </>
      )}
      {step === "sent" && <p className="dsub">Check your email for a sign-in link. Open it on this device and you'll land back here.</p>}
      {step === "create" && (
        <>
          <p className="dsub">
            Signed in as {who}. Choose a sync passphrase. It encrypts your data on this device and <b>can't be recovered</b>: lose it and the synced
            copy is gone (what's in this browser stays). Use the same passphrase on your other devices.
          </p>
          <div className="iopts col">
            <input type="password" autoComplete="new-password" placeholder="Passphrase, 12+ characters" value={p1} onChange={(e) => setP1(e.target.value)} />
            <input type="password" autoComplete="new-password" placeholder="Type it again" value={p2} onChange={(e) => setP2(e.target.value)} />
          </div>
        </>
      )}
      {step === "unlock" && (
        <>
          <p className="dsub">Signed in as {who}. Enter your sync passphrase to unlock your synced data.</p>
          <div className="iopts">
            <input type="password" autoComplete="current-password" placeholder="Sync passphrase" value={p1} onChange={(e) => setP1(e.target.value)} style={{ flex: 1 }} />
          </div>
        </>
      )}
      {step === "ready" && (
        <p className="dsub">
          Signed in as {who}, unlocked for this session. Syncing merges draws from every device; for settings and current results, the most recent
          change wins.
        </p>
      )}
      <div className="foot">
        <span>{msg}</span>
        {(step === "ready" || step === "unlock" || step === "create") && (
          <button className="btn" disabled={busy} onClick={() => run(async () => (await signOut(), setStep("signin")))}>
            Sign out
          </button>
        )}
        <button className="btn" onClick={onClose}>
          Close
        </button>
        {step === "signin" && (
          <button
            className="btn primary"
            disabled={busy || !/^\S+@\S+\.\S+$/.test(email)}
            onClick={() => run(async () => (await sendLink(email.trim()), setStep("sent")))}
          >
            Email me a link
          </button>
        )}
        {step === "create" && (
          <button
            className="btn primary"
            disabled={busy || p1.length < 12 || p1 !== p2}
            onClick={() =>
              run(async () => {
                await unlock(p1);
                setStep("ready");
                await doSync();
              })
            }
          >
            {p1 && p1.length < 12 ? "12+ characters" : p2 && p1 !== p2 ? "Doesn't match" : "Set passphrase and sync"}
          </button>
        )}
        {step === "unlock" && (
          <button
            className="btn primary"
            disabled={busy || !p1}
            onClick={() =>
              run(async () => {
                await unlock(p1);
                setStep("ready");
                await doSync();
              })
            }
          >
            {busy ? "Unlocking…" : "Unlock and sync"}
          </button>
        )}
        {step === "ready" && (
          <button className="btn primary" disabled={busy} onClick={doSync}>
            {busy ? "Syncing…" : "Sync now"}
          </button>
        )}
      </div>
    </>
  );
}
