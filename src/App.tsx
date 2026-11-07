import { createContext, lazy, Suspense, useContext, useEffect, useState } from "react";
import { Header } from "./ui/Header";
import { useStore } from "./ui/store";
import { TriageTab } from "./ui/tabs/Triage";
import { HealthTab } from "./ui/tabs/Health";
import { BloodworkTab } from "./ui/tabs/Bloodwork";
import { TrendsTab } from "./ui/tabs/Trends";
import { ErTab } from "./ui/tabs/Er";
import { SourcesTab } from "./ui/tabs/Sources";
import { DoctorDialog } from "./ui/dialogs/DoctorDialog";
import { FeedbackDialog } from "./ui/dialogs/FeedbackDialog";
import { ImportDialog } from "./ui/dialogs/ImportDialog";
import { SaveDrawDialog } from "./ui/dialogs/SaveDrawDialog";
import { milestone, trackPage } from "./features/analytics";
import { getPass, syncConfigured, syncNow } from "./features/sync";

// Share and sync pull in canvas and Supabase code most visitors never need
const ShareDialog = lazy(() => import("./ui/dialogs/ShareDialog"));
const SyncDialog = lazy(() => import("./ui/dialogs/SyncDialog"));

export type DialogName = "import" | "doc" | "share" | "feedback" | "sync" | "save";
const DialogCtx = createContext<(d: DialogName) => void>(() => {});
export const useOpenDialog = () => useContext(DialogCtx);

export default function App() {
  const { route, s, T, ctx } = useStore();
  const [dlg, setDlg] = useState<DialogName | null>(null);
  const close = () => setDlg(null);

  useEffect(() => {
    trackPage(route.tab === "triage" ? "/" : "/" + route.tab);
  }, [route.tab]);

  // the metrics that matter: people who got a triage, and people who came back with a second draw
  const nVals = Object.keys(s.vals).length;
  useEffect(() => {
    if (nVals >= 3 && !s.example) milestone("results_analyzed", { markers: nVals, flags: T.length, stack: ctx.s.stack.length });
  }, [nVals, s.example, T.length, ctx.s.stack.length]);
  const realDraws = s.draws.filter((d) => !d.id.startsWith("sample-")).length;
  useEffect(() => {
    if (realDraws >= 2) milestone("returned_with_second_draw", { draws: realDraws });
  }, [realDraws]);

  // back from the sign-in email: reopen sync so it can finish
  useEffect(() => {
    if (new URLSearchParams(location.search).has("sync") && syncConfigured) setDlg("sync");
  }, []);

  // once unlocked this session, push changes a few seconds after they settle
  useEffect(() => {
    if (!syncConfigured || !getPass() || s.example || !s.updatedAt) return;
    const t = setTimeout(() => syncNow(s).catch(() => {}), 4000);
    return () => clearTimeout(t);
  }, [s]);


  return (
    <DialogCtx.Provider value={setDlg}>
      <Header />
      <main>
        {route.tab === "triage" && <TriageTab />}
        {route.tab === "health" && <HealthTab />}
        {route.tab === "bloodwork" && <BloodworkTab />}
        {route.tab === "trends" && <TrendsTab />}
        {route.tab === "er" && <ErTab />}
        {route.tab === "sources" && <SourcesTab />}
      </main>
      <footer>
        <p>
          Spotter is an educational tool, not medical advice, and it is not a guide to using any drug. Many listed compounds are unapproved,
          illegal to sell for human use, or veterinary products with little human data. If you have chest pain, yellow eyes or skin, dark urine
          with muscle pain, or sudden swelling or shortness of breath, get urgent care.
        </p>
      </footer>
      <button className="fbtn" aria-haspopup="dialog" onClick={() => setDlg("feedback")}>
        Feedback
      </button>
      <ImportDialog open={dlg === "import"} onClose={close} />
      <DoctorDialog open={dlg === "doc"} onClose={close} />
      <FeedbackDialog open={dlg === "feedback"} onClose={close} />
      <SaveDrawDialog open={dlg === "save"} onClose={close} />
      <Suspense fallback={null}>
        {dlg === "share" && <ShareDialog open onClose={close} />}
        {dlg === "sync" && <SyncDialog open onClose={close} />}
      </Suspense>
    </DialogCtx.Provider>
  );
}
