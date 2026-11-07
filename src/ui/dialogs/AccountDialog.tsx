import { useState } from "react";
import { useAccount } from "../account";
import { Dialog } from "../Dialog";
import { Seg } from "../bits";
import { useStore } from "../store";

export function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} id="acctDlg" label="Your account">
      <Body onClose={onClose} />
    </Dialog>
  );
}

const MIN = 10;

function Body({ onClose }: { onClose: () => void }) {
  const A = useAccount();
  const { s, go } = useStore();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (!A.enabled)
    return (
      <>
        <h2>Accounts</h2>
        <p className="dsub">Accounts aren't switched on yet. Your progress is saved in this browser in the meantime.</p>
        <div className="foot">
          <span />
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </>
    );

  if (A.account)
    return (
      <>
        <h2>Your account</h2>
        <p className="dsub">
          Signed in as <b>{A.account.email}</b>. Your progress ({s.draws.length} saved draw{s.draws.length === 1 ? "" : "s"}) is encrypted on this
          device before it's saved, so only you can read it.
        </p>
        <div className="foot">
          <span>{A.status === "error" ? A.error : A.status === "syncing" ? "Saving…" : A.savedAt ? "All changes saved." : ""}</span>
          <button
            className="btn"
            onClick={async () => {
              await A.signOut();
              onClose();
            }}
          >
            Sign out
          </button>
          <button
            className="btn primary"
            onClick={() => {
              onClose();
              go("progress");
              scrollTo(0, 0);
            }}
          >
            See my progress
          </button>
        </div>
      </>
    );

  const valid = /^\S+@\S+\.\S+$/.test(email) && pw.length >= (mode === "up" ? MIN : 1) && (mode === "in" || pw === pw2);
  const submit = async () => {
    setBusy(true);
    setMsg("");
    try {
      if (mode === "in") {
        await A.signIn(email.trim(), pw);
        onClose();
        go("progress");
      } else {
        const r = await A.signUp(email.trim(), pw);
        if (r === "confirm-email") setMsg("Check your email to confirm your account, then sign in here.");
        else {
          onClose();
          go("progress");
        }
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2>{mode === "in" ? "Sign in" : "Create an account"}</h2>
      <p className="dsub">
        Save your draws and see your progress on any device. Everything is encrypted with your password before it leaves this browser, so not even
        Spotter can read it.
      </p>
      <Seg label="Sign in or create an account" value={mode} options={[["in", "Sign in"], ["up", "Create account"]]} onChange={(m) => (setMode(m), setMsg(""))} />
      <form
        className="iopts col"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !busy) submit();
        }}
      >
        <input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
        <input
          type="password"
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          placeholder={mode === "in" ? "Password" : `Password, ${MIN}+ characters`}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          aria-label="Password"
        />
        {mode === "up" && (
          <input type="password" autoComplete="new-password" placeholder="Password again" value={pw2} onChange={(e) => setPw2(e.target.value)} aria-label="Password again" />
        )}
        <button type="submit" hidden />
      </form>
      {mode === "up" && (
        <p className="dsub" style={{ marginTop: 10 }}>
          Your password is also the key to your data, so it can't be reset without losing what's saved in your account. What's in this browser is
          always kept.
        </p>
      )}
      <div className="foot">
        <span>{msg}</span>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" disabled={!valid || busy} onClick={submit}>
          {busy
            ? mode === "in"
              ? "Signing in…"
              : "Creating…"
            : mode === "up" && pw && pw.length < MIN
              ? `${MIN}+ characters`
              : mode === "up" && pw2 && pw !== pw2
                ? "Passwords don't match"
                : mode === "in"
                  ? "Sign in"
                  : "Create account"}
        </button>
      </div>
    </>
  );
}
