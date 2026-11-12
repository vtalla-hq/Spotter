import { useState } from "react";
import { useStore, type Tab } from "./store";
import { Seg } from "./bits";
import { useAccount } from "./account";
import { useOpenDialog } from "../App";

const NAV: [Tab, string][] = [
  ["triage", "Triage"],
  ["health", "Health"],
  ["bloodwork", "Bloodwork"],
  ["progress", "Progress"],
  ["ask", "Ask"],
  ["er", "ER signs"],
  ["sources", "Sources"],
];

export function Header() {
  const { s, set, route, go } = useStore();
  const A = useAccount();
  const open = useOpenDialog();
  const [dark, setDark] = useState(() => document.documentElement.getAttribute("data-theme") === "dark");
  const toggleTheme = () => {
    const cur = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", cur);
    setDark(!dark);
    try {
      localStorage.setItem("spotter-theme", cur);
    } catch {
      /* ignore */
    }
  };
  return (
    <header>
      <div className="bar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go("triage");
            scrollTo(0, 0);
          }}
        >
          <i aria-hidden="true" />
          <b>Spotter</b>
          <span>bloodwork for lifters</span>
        </a>
        <nav aria-label="Sections">
          {NAV.map(([t, l]) => (
            <a
              key={t}
              href={t === "triage" ? "/" : "/" + t}
              className={t === "er" ? "er" : undefined}
              aria-current={route.tab === t ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                go(t);
                scrollTo(0, 0);
              }}
            >
              {l}
            </a>
          ))}
        </nav>
        <div className="toggles">
          <Seg
            label="Sex"
            value={s.sex}
            options={[["m", "Male"], ["f", "Female"]]}
            onChange={(sex) => set((x) => ({ ...x, sex }))}
          />
          <Seg
            label="Units"
            value={s.units}
            options={[["si", "SI"], ["us", "US"]]}
            onChange={(units) => set((x) => ({ ...x, units }))}
          />
          <button className="themebtn" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"} onClick={toggleTheme}>
            {dark ? "☀" : "☾"}
          </button>
          <button className={"acct" + (A.account ? " in" : "")} onClick={() => open("account")} title={A.account?.email}>
            {A.account ? (
              <>
                <i aria-hidden="true">{A.account.email.slice(0, 1).toUpperCase()}</i>
                <span>{A.status === "syncing" ? "Saving…" : A.status === "error" ? "Not saved" : "Account"}</span>
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
