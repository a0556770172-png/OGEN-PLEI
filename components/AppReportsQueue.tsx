"use client";
import { useEffect, useState } from "react";
import { Flag, Check, X, Loader2, PartyPopper } from "lucide-react";

interface ReportItem {
  id: string;
  reason: string;
  created_at: string;
  app?: { id: string; name: string } | null;
  reporter?: { username: string } | null;
}

// תור בדיקה לדיווחים ממתינים על אפליקציות - צוות פיקוח/מנהל. אישור דיווח הופך אותו לגלוי
// לכל המשתמשים בעמוד האפליקציה עצמה.
export default function AppReportsQueue() {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/app-reports");
    const json = await res.json().catch(() => ({ reports: [] }));
    setItems(json.reports ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: "approve" | "reject") {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" /> טוען דיווחים...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 p-12 text-center text-gray-500">
        <PartyPopper className="h-8 w-8 text-accent" /> אין דיווחים ממתינים כרגע.
      </div>
    );
  }

  return (
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
          <p className="text-sm text-gray-300">{item.reason}</p>
          <div className="flex gap-2">
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
          </div>
        </div>
      ))}
    </div>
  );
}
