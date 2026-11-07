import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { accountsEnabled, current, signIn, signOut, signUp, sync, type Account } from "../features/account";
import { milestone } from "../features/analytics";
import { useStore } from "./store";

type Status = "idle" | "syncing" | "saved" | "error";

interface AccountCtx {
  enabled: boolean;
  account: Account | null;
  status: Status;
  error: string;
  savedAt: number | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<"signed-in" | "confirm-email">;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const Ctx = createContext<AccountCtx | null>(null);

const same = (a: object, b: object) =>
  JSON.stringify({ ...a, updatedAt: 0 }) === JSON.stringify({ ...b, updatedAt: 0 });

/** Keeps a signed-in user's progress saved to their account: pulls on sign-in, pushes a few seconds after each change. */
export function AccountProvider({ children }: { children: ReactNode }) {
  const { s, replace } = useStore();
  const [account, setAccount] = useState<Account | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const latest = useRef(s);
  latest.current = s;

  const syncNow = useCallback(async () => {
    setStatus("syncing");
    try {
      const local = latest.current;
      const merged = await sync(local);
      if (!same(merged, latest.current)) replace(merged);
      setStatus("saved");
      setSavedAt(Date.now());
      setError("");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Couldn't save to your account.");
    }
  }, [replace]);

  // restore the session on load
  useEffect(() => {
    if (!accountsEnabled) return;
    current()
      .then((a) => {
        setAccount(a);
        if (a) syncNow();
      })
      .catch(() => {});
  }, [syncNow]);

  // push changes once they settle
  useEffect(() => {
    if (!account || s.example || !s.updatedAt) return;
    const t = setTimeout(syncNow, 2500);
    return () => clearTimeout(t);
  }, [account, s.updatedAt, s.example, syncNow]);

  const value = useMemo<AccountCtx>(
    () => ({
      enabled: accountsEnabled,
      account,
      status,
      error,
      savedAt,
      syncNow,
      signIn: async (email, password) => {
        await signIn(email, password);
        setAccount(await current());
        milestone("signed_in");
        await syncNow();
      },
      signUp: async (email, password) => {
        const r = await signUp(email, password);
        if (r === "signed-in") {
          setAccount(await current());
          milestone("account_created");
          await syncNow();
        }
        return r;
      },
      signOut: async () => {
        await signOut();
        setAccount(null);
        setStatus("idle");
        setSavedAt(null);
      },
    }),
    [account, status, error, savedAt, syncNow],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccount(): AccountCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAccount outside AccountProvider");
  return v;
}
