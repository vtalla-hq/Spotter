// Core types for the Spotter rules engine. Everything in src/engine is pure:
// no DOM, no React, no storage. The UI passes state in and renders what comes back.

export type Sex = "m" | "f";
export type Units = "si" | "us";
export type Dir = "up" | "down";
/** risk = real harm, expected = intended or predictable, artifact = lab effect with no harm */
export type Kind = "risk" | "expected" | "artifact";
export type Range = [number, number];
export type Phase = "pre" | "on" | "off";

export interface Source {
  t: string;
  u: string;
  id: string;
}

/** Guideline targets: o = optimal, l = limit. null = no bound on that side. */
export interface Opt {
  o: [number | null, number | null];
  l: [number | null, number | null];
}

export interface Marker {
  id: string;
  name: string;
  abbr: string;
  panel: number;
  /** SI unit, the unit every value is stored in */
  unit: string;
  /** [US unit label, factor]: US value = SI value × factor */
  us: [string, number];
  /** decimal places [SI, US] */
  dp: [number, number];
  dist: "norm" | "log";
  /** typical adult range, read as 2.5th–97.5th percentile */
  ri: Range | { m: Range; f: Range };
  opt?: Opt | { m: Opt; f: Opt };
  al: string[];
  what: string;
}

export interface Effect {
  m: string;
  d: Dir;
  k: Kind;
  why: string;
}

export type ClassId =
  | "supp"
  | "trt"
  | "inj"
  | "oral"
  | "sarm"
  | "gh"
  | "glp"
  | "pep"
  | "thy"
  | "anc"
  | "burn"
  | "rx";

export interface Compound {
  id: string;
  cls: ClassId;
  name: string;
  aka?: string;
  note?: string;
  fx: Effect[];
  heart?: { w: number; why: string };
}

export interface RedFlag {
  m: string;
  /** x is the SI value, r is the marker's typical range for the current sex */
  test: (x: number, r: Range) => boolean;
  txt: string;
}

export type MeKey = "age" | "sys" | "dia" | "hr";

/** One saved blood draw. Values are SI. */
export interface Draw {
  id: string;
  /** ISO date, YYYY-MM-DD */
  date: string;
  vals: Record<string, number>;
  stack: string[];
  train: boolean;
  ph: Phase;
  wk: string;
}

export interface State {
  sex: Sex;
  units: Units;
  stack: string[];
  train: boolean;
  hab: Record<string, boolean>;
  /** the results currently being triaged, in SI */
  vals: Record<string, number>;
  cyc: { ph: Phase; wk: string };
  me: Partial<Record<MeKey, string>>;
  example: boolean;
  /** saved draws, oldest first */
  draws: Draw[];
  /** date of the current results, if known (YYYY-MM-DD) */
  drawDate: string;
  /** ms timestamp of the last local change, used to merge synced copies */
  updatedAt: number;
}

export const EMPTY_STATE: State = {
  sex: "m",
  units: "si",
  stack: [],
  train: false,
  hab: {},
  vals: {},
  cyc: { ph: "on", wk: "" },
  me: {},
  example: false,
  draws: [],
  drawDate: "",
  updatedAt: 0,
};
