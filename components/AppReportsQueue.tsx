"use client";
import { useEffect, useState } from "react";
import { Flag, Check, X, Loader2, PartyPopper, Trash2, Undo2, Eye } from "lucide-react";

interface ReportItem {
  id: string;
  reason: string;
  created_at?: string;
  reviewed_at?: string;
  app?: { id: string; name: string } | null;
  reporter?: { username: string } | null;
}

// תור בדיקה לדיווחים ממתינים על אפליקציות - צוות פיקוח/מנהל. אישור דיווח הופך אותו לגלוי
// לכל המשתמשים בעמוד האפליקציה עצמה. בנוסף - רשימת דיווחים שכבר אושרו/גלויים לציבור,
// עם אפשרות למחוק אותם לגמרי או להחזיר אותם למצב פרטי (אם התברר שהאישור היה בטעות).
export default function AppReportsQueue() {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [approved, setApproved] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const [pendingRes, approvedRes] = await Promise.all([
      fetch("/api/admin/app-reports"),
      fetch("/api/admin/app-reports/approved")
    ]);
    const pendingJson = await pendingRes.json().catch(() => ({ reports: [] }));
    const approvedJson = await approvedRes.json().catch(() => ({ reports: [] }));
    if (!pendingRes.ok) setError(pendingJson?.error || "שגיאה בטעינת הדיווחים");
    setItems(pendingJson.reports ?? []);
    setApproved(approvedJson.reports ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: "approve" | "reject" | "revert") {
    setBusyId(id);
    const res = await fetch(`/api/admin/app-reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    setBusyId(null);
    if (res.ok) load();
    else alert("שגיאה בביצוע הפעולה");
  }

  async function removeReport(id: string) {
    if (!confirm("למחוק את הדיווח הזה לצמיתות?")) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/app-reports/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) load();
    else alert("שגיאה במחיקת הדיווח");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" /> טוען דיווחים...
      </div>
    );
  }

  if (error) {
    return <div className="card p-6 text-center text-sm text-red-400">{error}</div>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="mb-3 text-sm font-bold text-gray-400">דיווחים ממתינים</h3>
        {items.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 p-10 text-center text-gray-500">
            <PartyPopper className="h-8 w-8 text-accent" /> אין דיווחים ממתינים כרגע.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <div key={item.id} className="card flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Flag className="h-4 w-4 text-red-400" />
                  <a href={`/apps/${item.app?.id}`} target="_blank" className="font-bold text-white hover:underline">
                    {item.app?.name ?? "אפליקציה"}
                  </a>
                  <span className="text-xs text-gray-500">דווח ע"י {item.reporter?.username ?? "משתמש"}</span>
                </div>
                <p className="whitespace-pre-line text-sm text-gray-300">{item.reason}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => act(item.id, "approve")}
                    disabled={busyId === item.id}
                    className="inline-flex items-center gap-1 rounded-xl bg-accent/15 px-3 py-2 text-xs font-bold text-accent transition hover:bg-accent/25"
                  >
                    <Check className="h-3.5 w-3.5" /> אישור והצגה למשתמשים
                  </button>
                  <button
                    onClick={() => act(item.id, "reject")}
                    disabled={busyId === item.id}
                    className="inline-flex items-center gap-1 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/25"
                  >
                    <X className="h-3.5 w-3.5" /> דחייה
                  </button>
                  <button
                    onClick={() => removeReport(item.id)}
                    disabled={busyId === item.id}
                    className="inline-flex items-center gap-1 rounded-xl bg-surface2 px-3 py-2 text-xs font-bold text-gray-400 transition hover:bg-surface2/70 hover:text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> מחיקה
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-gray-400"><Eye className="h-3.5 w-3.5" /> דיווחים גלויים לציבור (מאושרים)</h3>
        {approved.length === 0 ? (
          <div className="card p-6 text-center text-sm text-gray-500">אין כרגע דיווחים מוצגים לציבור.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {approved.map((item) => (
              <div key={item.id} className="card flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Flag className="h-4 w-4 text-red-400" />
                  <a href={`/apps/${item.app?.id}`} target="_blank" className="font-bold text-white hover:underline">
                    {item.app?.name ?? "אפליקציה"}
                  </a>
                  <span className="text-xs text-gray-500">דווח ע"י {item.reporter?.username ?? "משתמש"}</span>
                </div>
                <p className="whitespace-pre-line text-sm text-gray-300">{item.reason}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => act(item.id, "revert")}
                    disabled={busyId === item.id}
                    className="inline-flex items-center gap-1 rounded-xl bg-gold/15 px-3 py-2 text-xs font-bold text-gold transition hover:bg-gold/25"
                  >
                    <Undo2 className="h-3.5 w-3.5" /> החזרה לפרטי (הסתרה)
                  </button>
                  <button
                    onClick={() => removeReport(item.id)}
                    disabled={busyId === item.id}
                    className="inline-flex items-center gap-1 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/25"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> מחיקה לצמיתות
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
