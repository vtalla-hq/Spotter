import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { makeCtx, type Ctx } from "../engine/ctx";
import { BYID } from "../engine/data/markers";
import { normalize } from "../engine/state";
import { triage, type Flag } from "../engine/triage";
import type { State } from "../engine/types";

const KEY = "spotter-v2";
const OLD_KEY = "spotter-v1";

function load(): State {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch {
    /* private mode or corrupt storage: start blank */
  }
  return normalize({});
}

// ---------- routing: /, /health, /bloodwork/:marker, /progress, /er, /sources
export const TABS = ["triage", "health", "bloodwork", "progress", "er", "sources"] as const;
export type Tab = (typeof TABS)[number];

interface Route {
  tab: Tab;
  sel: string;
}

function parseLocation(): Route {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts[0] === "trends") parts[0] = "progress"; // old name
  // old hash links: /#bloodwork, /#hematocrit
  const h = location.hash.slice(1);
  if (!parts.length && h) {
    if (BYID[h]) return { tab: "bloodwork", sel: h };
    if ((TABS as readonly string[]).includes(h)) return { tab: h as Tab, sel: "hematocrit" };
  }
  const tab = (TABS as readonly string[]).includes(parts[0]) ? (parts[0] as Tab) : "triage";
  const sel = tab === "bloodwork" && parts[1] && BYID[parts[1]] ? parts[1] : "hematocrit";
  return { tab, sel };
}

const pathFor = (r: Route) => (r.tab === "triage" ? "/" : r.tab === "bloodwork" ? `/bloodwork/${r.sel}` : `/${r.tab}`);

interface Store {
  s: State;
  ctx: Ctx;
  T: Flag[];
  /** apply a change; marks the state as edited for sync */
  set: (fn: (s: State) => State) => void;
  /** load a whole state without marking it as a new edit (used after syncing) */
  replace: (s: State) => void;
  route: Route;
  go: (tab: Tab, sel?: string) => void;
  /** jump to a source on the Sources tab and flash it */
  cite: (id: string) => void;
  flash: string | null;
}

const StoreCtx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(load);
  const [route, setRoute] = useState<Route>(parseLocation);
  const [flash, setFlash] = useState<string | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      // normalise old hash URLs to paths
      const p = pathFor(route);
      if (location.hash || location.pathname !== p) history.replaceState(null, "", p);
      return;
    }
  }, [route]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* storage full or blocked */
    }
  }, [s]);

  useEffect(() => {
    const on = () => setRoute(parseLocation());
    addEventListener("popstate", on);
    return () => removeEventListener("popstate", on);
  }, []);

  const set = useCallback((fn: (s: State) => State) => setS((prev) => ({ ...fn(prev), updatedAt: Date.now() })), []);

  const replace = useCallback((next: State) => setS(next), []);

  const go = useCallback((tab: Tab, sel?: string) => {
    setRoute((r) => {
      const next = { tab, sel: sel ?? r.sel };
      const p = pathFor(next);
      if (location.pathname !== p) history.pushState(null, "", p);
      return next;
    });
  }, []);

  const cite = useCallback(
    (id: string) => {
      go("sources");
      setFlash(id);
      setTimeout(() => {
        document.getElementById("src-" + id)?.scrollIntoView({ block: "center" });
      }, 30);
      setTimeout(() => setFlash(null), 1600);
    },
    [go],
  );

  const ctx = useMemo(() => makeCtx(s), [s]);
  const T = useMemo(() => triage(ctx), [ctx]);

  const value = useMemo(() => ({ s, ctx, T, set, replace, route, go, cite, flash }), [s, ctx, T, set, replace, route, go, cite, flash]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): Store {
  const v = useContext(StoreCtx);
  if (!v) throw new Error("useStore outside StoreProvider");
  return v;
}

