"use client";
import { useState } from "react";
import { Flag, Loader2, CheckCircle2, X } from "lucide-react";

// כפתור "דיווח על אפליקציה" - כל משתמש מחובר יכול לדווח (למשל קישור שבור, תוכן לא תקין
// וכו'). הדיווח נשלח לתור בדיקה של צוות הפיקוח/מנהל, ומוצג לכל המשתמשים בעמוד האפליקציה
// רק אחרי שהם מאשרים אותו.
export default function ReportAppButton({ appId }: { appId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!reason.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/apps/${appId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "שליחת הדיווח נכשלה");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("שליחת הדיווח נכשלה");
    }
    setBusy(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold text-gray-400 transition hover:border-red-500/40 hover:text-red-400"
      >
        <Flag className="h-3.5 w-3.5" /> דיווח על האפליקציה
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Flag className="h-4 w-4 text-red-400" /> דיווח על האפליקציה
              </h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            {done ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-accent">
                <CheckCircle2 className="h-8 w-8" />
                <p className="font-bold">הדיווח נשלח בהצלחה!</p>
                <p className="text-sm text-gray-400">צוות הפיקוח יבדוק אותו בקרוב.</p>
              </div>
            ) : (
              <>
                {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  maxLength={500}
                  className="input-field"
                  placeholder="מה הבעיה באפליקציה? (למשל: הקישור לא עובד, תוכן לא מתאים וכו')"
                />
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button onClick={submit} disabled={!reason.trim() || busy} className="btn-primary flex-1">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />} שליחת דיווח
                  </button>
                  <button onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-gray-400 hover:text-white">
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
