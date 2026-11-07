import { Fragment, type ReactNode } from "react";
import { SRC, srcNum } from "../engine/data/sources";
import { useStore } from "./store";

/**
 * Renders rule text with its [P12] citations turned into numbered links to the
 * Sources tab. Adjacent citations get a comma between them.
 */
export function Cite({ text }: { text: string }) {
  const { cite } = useStore();
  const out: ReactNode[] = [];
  const re = /\s*\[(P\d+)\]/g;
  let last = 0;
  let prevCite = false;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    const before = text.slice(last, m.index);
    if (before) {
      out.push(<Fragment key={k++}>{before}</Fragment>);
      prevCite = false;
    }
    const id = m[1];
    if (prevCite) out.push(<span key={k++} className="csep">,</span>);
    out.push(
      <a
        key={k++}
        className="cite"
        href="/sources"
        title={SRC[id]?.t}
        onClick={(e) => {
          e.preventDefault();
          cite(id);
        }}
      >
        {srcNum(id)}
      </a>,
    );
    prevCite = true;
    last = m.index + m[0].length;
  }
  const rest = text.slice(last);
  if (rest) out.push(<Fragment key={k++}>{rest}</Fragment>);
  return <>{out}</>;
}
