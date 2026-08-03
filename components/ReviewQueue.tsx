"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Check, X, Archive, Trash2, Loader2, User, HardDrive, ShieldQuestion, CheckCircle2, XCircle, ImageOff, MessageSquarePlus, FolderInput, Search } from "lucide-react";
import type { AppRow, Category } from "@/types/database";
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((json) => setCategories(json.categories ?? [])).catch(() => {});
  }, []);

  async function changeCategory(appId: string, category: string) {
    setBusyId(appId);
    const res = await fetch(`/api/apps/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category })
    });
    setBusyId(null);
    if (res.ok) router.refresh();
    else alert("שגיאה בשינוי הקטגוריה");
  }

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

  async function sendNote(appId: string) {
    const note = window.prompt("הודעה למפתח (למשל: \"נא להוסיף אייקון לאפליקציה\"):");
    if (!note || !note.trim()) return;
    setBusyId(appId);
    const res = await fetch(`/api/apps/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminNote: note.trim() })
    });
    setBusyId(null);
    if (res.ok) router.refresh();
    else alert("שגיאה בשליחת ההודעה");
  }

  const trimmedQuery = query.trim().toLowerCase();
  const filteredApps = trimmedQuery
    ? apps.filter(
        (app) =>
          app.name.toLowerCase().includes(trimmedQuery) ||
          (app.developer?.username ?? "").toLowerCase().includes(trimmedQuery)
      )
    : apps;

  if (apps.length === 0) {
    return <div className="card p-10 text-center text-gray-500">{emptyMessage ?? "אין אפליקציות הממתינות לבדיקה כרגע 🎉"}</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
        <input
          dir="rtl"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי שם אפליקציה/תוכנה או מפתח..."
          className="input-field pl-10"
        />
      </div>

      {filteredApps.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">לא נמצאו תוצאות התואמות לחיפוש.</div>
      ) : (
      filteredApps.map((app) => (
        <div key={app.id} className="card flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-white">{app.name}</h3>
                <StatusBadge status={app.status} />
                {!app.icon_key && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold">
                    <ImageOff className="h-3 w-3" /> אין אייקון
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400">{app.short_description}</p>
              {app.admin_note && (
                <p className="mt-1.5 text-xs text-gold">הערת צוות למפתח: {app.admin_note}</p>
              )}
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
              <button onClick={() => sendNote(app.id)} disabled={busyId === app.id} className="btn-ghost text-xs">
                <MessageSquarePlus className="h-3.5 w-3.5" /> הודעה למפתח
              </button>
              {categories.length > 0 && (
                <label className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface2 px-2.5 py-2 text-xs text-gray-300">
                  <FolderInput className="h-3.5 w-3.5 text-gray-500" />
                  <select
                    value={app.category}
                    disabled={busyId === app.id}
                    onChange={(e) => changeCategory(app.id, e.target.value)}
                    className="bg-transparent text-xs text-gray-200 outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.value} className="bg-surface2 text-gray-200">{c.label}</option>
                    ))}
                  </select>
                </label>
              )}
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
      ))
      )}
    </div>
  );
}
