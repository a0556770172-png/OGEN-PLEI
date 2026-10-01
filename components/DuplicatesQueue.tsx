"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Check, X, Loader2, User, ExternalLink, Download } from "lucide-react";
import AppSourceTag from "./AppSourceTag";

type MiniApp = {
  id: string;
  name: string;
  version: string;
  status: string;
  source: "developer_upload" | "public_suggestion";
  downloads_count: number;
  created_at: string;
} | null;

type DuplicateReport = {
  id: string;
  app_id: string;
  other_app_id: string | null;
  other_url: string;
  note: string | null;
  created_at: string;
  app: MiniApp;
  otherApp: MiniApp;
  reporter: { username: string } | null;
};

function AppBox({ title, app, href }: { title: string; app: MiniApp; href: string }) {
  return (
    <div className="flex-1 rounded-xl border border-border bg-surface2 p-3">
      <p className="mb-1 text-[11px] font-bold text-gray-500">{title}</p>
      {app ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={href} target="_blank" className="font-bold text-white hover:underline">{app.name}</Link>
            <AppSourceTag source={app.source} />
          </div>
          <p className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
            <span>גרסה {app.version}</span>
            <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> {app.downloads_count.toLocaleString("he-IL")}</span>
            <span>נוספה {new Date(app.created_at).toLocaleDateString("he-IL")}</span>
          </p>
        </>
      ) : (
        <a href={href} target="_blank" rel="noopener noreferrer" dir="ltr" className="inline-flex max-w-full items-center gap-1 break-all text-sm text-primary-light hover:underline">
          <ExternalLink className="h-3.5 w-3.5 shrink-0" /> {href}
        </a>
      )}
    </div>
  );
}

// לשונית "כפילויות" (צוות פיקוח ומנהל): דיווחי משתמשים על אפליקציה שמופיעה פעמיים / עושה
// את אותה פעולה. "טופל" אחרי שהצוות הסיר/איחד, "לא כפילות" אם הדיווח לא נכון.
export default function DuplicatesQueue() {
  const [reports, setReports] = useState<DuplicateReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/duplicate-reports", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setReports(json.reports ?? []);
      else setError(json.error ?? "שגיאה בטעינת הדיווחים");
    } catch {
      setError("שגיאה בטעינת הדיווחים");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: "resolve" | "reject") {
    setBusyId(id);
    const res = await fetch(`/api/admin/duplicate-reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    setBusyId(null);
    if (res.ok) setReports((prev) => prev.filter((r) => r.id !== id));
    else alert("שגיאה בעדכון הדיווח");
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-10 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (error) return <div className="card p-10 text-center text-red-400">{error}</div>;
  if (reports.length === 0) return <div className="card p-10 text-center text-gray-500">אין דיווחי כפילות ממתינים 🎉</div>;

  return (
    <div className="flex flex-col gap-3">
      {reports.map((r) => (
        <div key={r.id} className="card flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-bold text-white">
              <Copy className="h-4 w-4 text-primary-light" /> דיווח כפילות
            </h3>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <User className="h-3.5 w-3.5" /> {r.reporter?.username ?? "?"} · {new Date(r.created_at).toLocaleDateString("he-IL")}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <AppBox title="האפליקציה שדווחה" app={r.app} href={`/apps/${r.app_id}`} />
            <AppBox title="האפליקציה השנייה (קישור מהמשתמש)" app={r.otherApp} href={r.other_app_id && r.otherApp ? `/apps/${r.other_app_id}` : r.other_url} />
          </div>
          {r.note && <p className="rounded-xl bg-surface2 px-3 py-2 text-sm text-gray-300">הערת המדווח: {r.note}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => act(r.id, "resolve")}
              disabled={busyId === r.id}
              className="inline-flex items-center gap-1 rounded-xl bg-accent/15 px-3 py-2 text-xs font-bold text-accent transition hover:bg-accent/25"
            >
              <Check className="h-3.5 w-3.5" /> טופל
            </button>
            <button
              onClick={() => act(r.id, "reject")}
              disabled={busyId === r.id}
              className="inline-flex items-center gap-1 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/25"
            >
              <X className="h-3.5 w-3.5" /> לא כפילות
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
