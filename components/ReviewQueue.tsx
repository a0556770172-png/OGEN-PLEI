"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Check, X, Archive, Trash2, Loader2, User, HardDrive, ShieldQuestion, CheckCircle2, XCircle } from "lucide-react";
import type { AppRow } from "@/types/database";
import StatusBadge from "./StatusBadge";
import { formatFileSize } from "@/lib/format";

type VerifyResult = { status: string; visibleToPublic: boolean; updatedAt: string | null } | { error: string };

export default function ReviewQueue({
  apps,
  canDelete,
  emptyMessage
}: {
  apps: AppRow[];
  canDelete: boolean;
  emptyMessage?: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyResults, setVerifyResults] = useState<Record<string, VerifyResult>>({});

  async function verify(appId: string) {
    setVerifyingId(appId);
    setVerifyResults((prev) => {
      const next = { ...prev };
      delete next[appId];
      return next;
    });
    try {
      const res = await fetch(`/api/admin/apps/${appId}/verify`, { cache: "no-store" });
      const json = await res.json();
      setVerifyResults((prev) => ({ ...prev, [appId]: res.ok ? json : { error: json.error || "שגיאה בבדיקה" } }));
    } catch {
      setVerifyResults((prev) => ({ ...prev, [appId]: { error: "שגיאה בבדיקה" } }));
    }
    setVerifyingId(null);
  }

  async function act(appId: string, action: string) {
    let note: string | null = null;
    if (action === "reject") {
      note = window.prompt("סיבת הדחייה (יוצג למפתח):") || "";
      if (note === null) return;
    }
    setBusyId(appId);
    const res = await fetch(`/api/admin/review/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note })
    });
    setBusyId(null);
    if (res.ok) router.refresh();
    else alert("שגיאה בביצוע הפעולה");
  }

  async function download(appId: string) {
    setBusyId(appId);
    const res = await fetch(`/api/download/${appId}`, { method: "POST" });
    const json = await res.json();
    setBusyId(null);
    if (res.ok) window.open(json.url, "_blank");
    else alert(json.error || "שגיאה בהורדה");
  }

  async function remove(appId: string) {
    if (!confirm("למחוק את האפליקציה לצמיתות מהשרת?")) return;
    setBusyId(appId);
    const res = await fetch(`/api/apps/${appId}`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) router.refresh();
    else alert("שגיאה במחיקה");
  }

  if (apps.length === 0) {
    return <div className="card p-10 text-center text-gray-500">{emptyMessage ?? "אין אפליקציות הממתינות לבדיקה כרגע 🎉"}</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {apps.map((app) => (
        <div key={app.id} className="card flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <h3 className="font-bold text-white">{app.name}</h3>
                <StatusBadge status={app.status} />
              </div>
              <p className="text-sm text-gray-400">{app.short_description}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> {app.developer?.username}</span>
                <span className="inline-flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" /> {formatFileSize(app.file_size_bytes)}</span>
                <span>גרסה {app.version}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => download(app.id)} disabled={busyId === app.id} className="btn-ghost text-xs">
                {busyId === app.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} הורדה לבדיקה
              </button>
              <button onClick={() => verify(app.id)} disabled={verifyingId === app.id} className="btn-ghost text-xs">
                {verifyingId === app.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldQuestion className="h-3.5 w-3.5" />} בדיקת פרסום בוודאות
              </button>
              {app.status !== "approved" && (
                <button onClick={() => act(app.id, "approve")} disabled={busyId === app.id} className="inline-flex items-center gap-1 rounded-xl bg-accent/15 px-3 py-2 text-xs font-bold text-accent transition hover:bg-accent/25">
                  <Check className="h-3.5 w-3.5" /> אישור פרסום
                </button>
              )}
              {app.status !== "rejected" && (
                <button onClick={() => act(app.id, "reject")} disabled={busyId === app.id} className="inline-flex items-center gap-1 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/25">
                  <X className="h-3.5 w-3.5" /> דחייה
                </button>
              )}
              {app.status !== "archived" && (
                <button onClick={() => act(app.id, "archive")} disabled={busyId === app.id} className="inline-flex items-center gap-1 rounded-xl bg-gray-500/15 px-3 py-2 text-xs font-bold text-gray-400 transition hover:bg-gray-500/25">
                  <Archive className="h-3.5 w-3.5" /> העברה לבנתיים
                </button>
              )}
              {canDelete && (
                <button onClick={() => remove(app.id)} disabled={busyId === app.id} className="rounded-xl p-2 text-red-400 transition hover:bg-red-500/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {verifyResults[app.id] && (
            "error" in verifyResults[app.id] ? (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                <XCircle className="h-4 w-4 shrink-0" /> {(verifyResults[app.id] as { error: string }).error}
              </div>
            ) : (verifyResults[app.id] as { status: string; visibleToPublic: boolean; updatedAt: string | null }).visibleToPublic ? (
              <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-accent">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                כן, בוודאות - האפליקציה מוצגת כרגע בחנות לכל מבקר (נבדק ישירות מול מסד הנתונים, בלי שום cache).
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                <XCircle className="h-4 w-4 shrink-0" />
                לא, האפליקציה לא מוצגת בחנות כרגע (סטטוס במסד הנתונים: {(verifyResults[app.id] as { status: string }).status}
                {(verifyResults[app.id] as { status: string }).status !== "approved" ? " - יש לאשר אותה כדי שתתפרסם" : ""}).
              </div>
            )
          )}
        </div>
      ))}
    </div>
  );
}
