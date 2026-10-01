"use client";
import { useEffect, useRef, useState } from "react";
import { Flag, Copy, HelpCircle, ChevronDown, X } from "lucide-react";
import ReportAppButton from "./ReportAppButton";
import DuplicateReportButton from "./DuplicateReportButton";

// כפתור "דיווחים" אחד בעמוד האפליקציה: נפתח תפריט עם "דיווח על בעיה" ו"דיווח על כפילות".
// לידו סימן שאלה קטן שמסביר מה כל אחד מהם (נפתח בלחיצה).
export default function ReportsMenu({ appId }: { appId: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dialog, setDialog] = useState<"problem" | "duplicate" | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // לחיצה מחוץ לתפריט / להסבר - סוגרת אותם
  useEffect(() => {
    if (!menuOpen && !helpOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
        setHelpOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen, helpOpen]);

  function choose(kind: "problem" | "duplicate") {
    setMenuOpen(false);
    setDialog(kind);
  }

  return (
    <div ref={wrapRef} className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => {
          setMenuOpen((v) => !v);
          setHelpOpen(false);
        }}
        aria-expanded={menuOpen}
        className="btn-ghost text-sm hover:border-red-500/40 hover:text-red-400"
      >
        <Flag className="h-4 w-4" /> דיווחים
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
      </button>
      <button
        type="button"
        onClick={() => {
          setHelpOpen((v) => !v);
          setMenuOpen(false);
        }}
        aria-label="מה זה דיווחים?"
        title="מה זה דיווחים?"
        className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 transition hover:bg-surface2 hover:text-primary-light"
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          <button
            type="button"
            onClick={() => choose("problem")}
            className="flex w-full items-center gap-2 px-4 py-3 text-right text-sm text-gray-200 transition hover:bg-surface2"
          >
            <Flag className="h-4 w-4 shrink-0 text-red-400" /> דיווח על בעיה באפליקציה
          </button>
          <button
            type="button"
            onClick={() => choose("duplicate")}
            className="flex w-full items-center gap-2 border-t border-border px-4 py-3 text-right text-sm text-gray-200 transition hover:bg-surface2"
          >
            <Copy className="h-4 w-4 shrink-0 text-primary-light" /> דיווח על כפילות
          </button>
        </div>
      )}

      {helpOpen && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-border bg-surface p-4 text-right text-xs leading-relaxed text-gray-300 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-white">מה אפשר לדווח?</span>
            <button type="button" onClick={() => setHelpOpen(false)} aria-label="סגירה" className="text-gray-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-2">
            <b className="text-red-400">דיווח על בעיה</b> - כשמשהו לא תקין באפליקציה: הקובץ או הקישור לא עובד, היא קורסת, התוכן לא מתאים,
            חשד לוירוס, או שהיא לא תואמת לתיאור.
          </p>
          <p className="mb-2">
            <b className="text-primary-light">דיווח על כפילות</b> - כשראיתם עוד אפליקציה זהה, או אפליקציה שעושה בדיוק את אותה פעולה.
            צריך להדביק קישור לאפליקציה השנייה.
          </p>
          <p className="text-gray-500">כל דיווח נשלח לצוות הפיקוח ונבדק ידנית.</p>
        </div>
      )}

      <ReportAppButton appId={appId} open={dialog === "problem"} onClose={() => setDialog(null)} />
      <DuplicateReportButton appId={appId} open={dialog === "duplicate"} onClose={() => setDialog(null)} />
    </div>
  );
}
