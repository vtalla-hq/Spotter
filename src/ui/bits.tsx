import type { CSSProperties, ReactNode } from "react";
import { useStore, type Tab } from "./store";

/** Segmented control */
export function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <span className="seg" aria-label={label} role="group">
      {options.map(([v, l]) => (
        <button key={v} aria-pressed={v === value} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </span>
  );
}

/** CSS custom property helper: style={vars({ "--c": "red" })} */
export const vars = (v: Record<string, string | number>) => v as CSSProperties;

export function Tag({ c, children }: { c: string; children: ReactNode }) {
  return (
    <span className="tag" style={vars({ "--c": c })}>
      {children}
    </span>
  );
}

/** In-app link to a tab or a marker */
export function Go({ tab, sel, className, style, children }: { tab: Tab; sel?: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  const { go } = useStore();
  const href = tab === "triage" ? "/" : tab === "bloodwork" && sel ? `/bloodwork/${sel}` : "/" + tab;
  return (
    <a
      href={href}
      className={className}
      style={style}
      onClick={(e) => {
        e.preventDefault();
        go(tab, sel);
        scrollTo(0, 0);
      }}
    >
      {children}
    </a>
  );
}

export const uniq = <T,>(a: T[]) => [...new Set(a)];
