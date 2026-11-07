import { erList } from "../../engine/health";
import { Cite } from "../Cite";
import { useStore } from "../store";

export function ErTab() {
  const { s, ctx } = useStore();
  const L = erList(ctx);
  return (
    <section data-tab="er" className="on">
      <div className="erhero">
        <h1>Go to the ER</h1>
        <p>
          If you have any of these, call emergency services or go to the emergency room now. Don't wait for bloodwork, and tell them exactly what you
          take.
        </p>
      </div>
      <ul className="erlist">
        {L.map((e) => (
          <li key={e.t} className={e.yours || !s.stack.length ? undefined : "dim"}>
            <strong>{e.t}</strong>
            <span>
              <Cite text={e.d} />
            </span>
            {e.yours && (
              <>
                <br />
                <span className="yours">Your stack</span>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="policy">
        Signs marked "Your stack" are more likely with what you've added. Any of them is an emergency for anyone. In the US and Canada, call or text
        988 for a mental health crisis.
      </p>
    </section>
  );
}
