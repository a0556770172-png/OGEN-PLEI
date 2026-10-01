"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Globe, Lock, Loader2 } from "lucide-react";
import AppSourceTag from "./AppSourceTag";

type Source = "developer_upload" | "public_suggestion";

// לצוות פיקוח ומנהל בלבד: האות פ/צ בכרטיס במסך הבית היא כפתור - לחיצה פותחת אישור קצר
// ומעבירה את האפליקציה בין פרטית לציבורית (אותו בעלים, בלי העברת מוניטין) - דרך אותו API
// של לשונית "ציבורי ופרטי" (app/api/staff/app-ownership).
export default function StaffSourceToggle({ appId, appName, source }: { appId: string; appName: string; source: Source }) {
  const router = useRouter();
  const [current, setCurrent] = useState<Source>(source);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const target: Source = current === "public_suggestion" ? "developer_upload" : "public_suggestion";
  const targetLabel = target === "public_suggestion" ? "ציבורית" : "פרטית";

  function stop(e: React.SyntheticEvent) {
    e.stopPropagation();
  }

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/staff/app-ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, toSource: target, confirm: true })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "שגיאה בהעברה");
      } else {
        setCurrent(target);
        setOpen(false);
        router.refresh();
      }
    } catch {
      setError("שגיאה בהעברה");
    }
    setBusy(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          setError("");
          setOpen(true);
        }}
        onKeyDown={stop}
        title={`${current === "public_suggestion" ? "ציבורית" : "פרטית"} - לחצו כדי להעביר ל${targetLabel} (צוות)`}
        className="rounded-full transition hover:scale-125 hover:ring-2 hover:ring-gold/60"
      >
        <AppSourceTag source={current} size="letter" />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
            dir="rtl"
            onKeyDown={stop}
            onClick={(e) => {
              stop(e);
              if (e.target === e.currentTarget && !busy) setOpen(false);
            }}
          >
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface p-5" onClick={stop}>
              <h2 className="mb-2 flex items-center gap-2 font-bold text-white">
                <ArrowLeftRight className="h-4 w-4 text-gold" /> העברה ל{targetLabel}
              </h2>
              <p className="mb-3 text-sm text-gray-300">
                להעביר את <b className="text-white">{appName}</b> מ{current === "public_suggestion" ? "ציבורית" : "פרטית"} ל{targetLabel}?
              </p>
              <div className="mb-4 flex items-start gap-2 rounded-xl bg-surface2 p-3 text-xs text-gray-400">
                {target === "public_suggestion" ? <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /> : <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                <span>
                  {target === "public_suggestion"
                    ? "ציבורית: כל משתמש יוכל לעדכן אותה (ולקבל את הבעלות באישור הצוות), והבעלים לא יוכל לערוך אותה בעצמו."
                    : "פרטית: הבעלים יוכל לערוך אותה ולהעלות גרסאות מהדשבורד שלו. הבעלים חייב להיות מפתח."}{" "}
                  הבעלים והמוניטין לא משתנים.
                </span>
              </div>
              {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={confirm} disabled={busy} className="btn-primary flex-1 text-sm">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />} העברה ל{targetLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="flex-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
