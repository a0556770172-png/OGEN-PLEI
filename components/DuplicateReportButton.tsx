"use client";
import { useState } from "react";
import { Copy, Loader2, CheckCircle2, X, Link2 } from "lucide-react";

// "דווח על כפילות" - משתמש שראה עוד אפליקציה זהה / שעושה את אותה פעולה מדווח עליה, עם קישור
// חובה לאפליקציה השנייה. הדיווח נשלח ללשונית "כפילויות" של צוות הפיקוח והמנהל.
// כשמגיעים open/onClose מבחוץ (components/ReportsMenu.tsx) - אין כפתור משלו, רק החלונית.
export default function DuplicateReportButton({ appId, open: openProp, onClose }: { appId: string; open?: boolean; onClose?: () => void }) {
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = (v: boolean) => (controlled ? !v && onClose?.() : setOpenState(v));
  const [otherUrl, setOtherUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setOpen(false);
    if (done) {
      setDone(false);
      setOtherUrl("");
      setNote("");
    }
  }

  async function submit() {
    if (!otherUrl.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/apps/${appId}/duplicate-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUrl: otherUrl.trim(), note: note.trim() })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "שליחת הדיווח נכשלה");
      } else {
        setDone(true);
      }
    } catch {
      setError("שליחת הדיווח נכשלה");
    }
    setBusy(false);
  }

  return (
    <>
      {!controlled && (
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost text-sm">
          <Copy className="h-4 w-4" /> דווח על כפילות
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4" dir="rtl">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Copy className="h-4 w-4 text-primary-light" /> דיווח על כפילות
              </h2>
              <button onClick={close} aria-label="סגירה" className="text-gray-500 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            {done ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-accent">
                <CheckCircle2 className="h-8 w-8" />
                <p className="font-bold">הדיווח נשלח בהצלחה!</p>
                <p className="text-sm text-gray-400">תודה! צוות הפיקוח יבדוק את שתי האפליקציות בקרוב.</p>
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm text-gray-400">
                  ראיתם עוד אפליקציה זהה, או אפליקציה שעושה בדיוק את אותה פעולה? הדביקו כאן קישור אליה והצוות יבדוק.
                </p>
                {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-gray-400">
                      <Link2 className="h-3.5 w-3.5" /> קישור לאפליקציה השנייה <span className="text-gold">(חובה)</span>
                    </label>
                    <input
                      dir="ltr"
                      type="url"
                      value={otherUrl}
                      onChange={(e) => setOtherUrl(e.target.value)}
                      maxLength={500}
                      className="input-field text-left"
                      placeholder="https://ogenplay.com/apps/..."
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-gray-400">הערה (אופציונלי)</label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      maxLength={500}
                      className="input-field"
                      placeholder="למשל: זו אותה אפליקציה בדיוק בשם אחר"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button onClick={submit} disabled={!otherUrl.trim() || busy} className="btn-primary flex-1">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} שליחת דיווח
                  </button>
                  <button onClick={close} className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-gray-400 hover:text-white">
                    ביטול
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
