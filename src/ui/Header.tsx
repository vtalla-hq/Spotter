import { useStore, type Tab } from "./store";
import { Seg } from "./bits";

const NAV: [Tab, string][] = [
  ["triage", "Triage"],
  ["health", "Health check"],
  ["bloodwork", "Bloodwork"],
  ["trends", "Trends"],
  ["er", "ER signs"],
  ["sources", "Sources"],
];

export function Header() {
  const { s, set, route, go } = useStore();
  const toggleTheme = () => {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", cur);
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
          <button className="themebtn" aria-label="Switch light or dark" title="Light / dark" onClick={toggleTheme}>
            ☾
          </button>
        </div>
      </div>
    </header>
  );
}
