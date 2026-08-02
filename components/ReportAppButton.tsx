"use client";
import { useState } from "react";
import { Flag, Loader2, CheckCircle2, X } from "lucide-react";

const ANDROID_VERSIONS = [
  "לא רלוונטי (תוכנה למחשב)",
  "אנדרואיד 15",
  "אנדרואיד 14",
  "אנדרואיד 13",
  "אנדרואיד 12",
  "אנדרואיד 11",
  "אנדרואיד 10",
  "אנדרואיד 9 ומטה",
  "לא ידוע"
];

const ISSUE_TYPES = [
  "הקישור/הקובץ לא עובד",
  "האפליקציה קורסת / לא נפתחת",
  "תוכן לא מתאים / לא צנוע",
  "חשד לוירוס או תוכנה זדונית",
  "האפליקציה לא תואמת לתיאור",
  "אחר"
];

// כפתור "דיווח על אפליקציה" - כל משתמש מחובר יכול לדווח (למשל קישור שבור, תוכן לא תקין
// וכו'). הדיווח נשלח לתור בדיקה של צוות הפיקוח/מנהל, ומוצג לכל המשתמשים בעמוד האפליקציה
// רק אחרי שהם מאשרים אותו. הטופס מובנה קצת יותר (סוג בעיה + גרסת אנדרואיד + תיאור חופשי)
// כדי שלצוות הפיקוח יהיה יותר קל להבין ולשחזר את הבעיה - הכל מתחבר למחרוזת "reason" אחת
// שנשלחת לשרת, בלי צורך בשינוי סכימה במסד הנתונים.
export default function ReportAppButton({ appId }: { appId: string }) {
  const [open, setOpen] = useState(false);
  const [issueType, setIssueType] = useState(ISSUE_TYPES[0]);
  const [androidVersion, setAndroidVersion] = useState(ANDROID_VERSIONS[0]);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!description.trim()) return;
    setBusy(true);
    setError("");
    const reason = `סוג הבעיה: ${issueType}\nגרסת אנדרואיד: ${androidVersion}\nתיאור: ${description.trim()}`;
    try {
      const res = await fetch(`/api/apps/${appId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.slice(0, 500) })
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
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost text-sm hover:border-red-500/40 hover:text-red-400"
      >
        <Flag className="h-4 w-4" /> דיווח
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

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-gray-400">סוג הבעיה</label>
                    <select value={issueType} onChange={(e) => setIssueType(e.target.value)} className="input-field">
                      {ISSUE_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-gray-400">גרסת אנדרואיד (אם רלוונטי)</label>
                    <select value={androidVersion} onChange={(e) => setAndroidVersion(e.target.value)} className="input-field">
                      {ANDROID_VERSIONS.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-gray-400">תיאור מפורט</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      maxLength={350}
                      className="input-field"
                      placeholder="פרטו בדיוק מה קרה - למשל: מתי מתרחשת הקריסה, מה הופיע במסך וכו'"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button onClick={submit} disabled={!description.trim() || busy} className="btn-primary flex-1">
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
