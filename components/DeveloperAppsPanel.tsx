"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Star, LayoutGrid, Crown, Pencil, PauseCircle, PlayCircle, Loader2, User } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import ProRequestButton from "@/components/ProRequestButton";
import DeleteAppButton from "@/components/DeleteAppButton";
import type { AppRow, ProStatus } from "@/types/database";

const MAX_FREE_PAUSE_DAYS = 3;

function isAppPaused(app: AppRow) {
  return app.download_paused || (app.download_paused_until ? new Date(app.download_paused_until).getTime() > Date.now() : false);
}

function PauseControls({ app, isPro }: { app: AppRow; isPro: boolean }) {
  const router = useRouter();
  const [days, setDays] = useState(isPro ? "" : "1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const paused = isAppPaused(app);

  async function callPause(body: any) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/apps/${app.id}/pause-download`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "שגיאה בביצוע הפעולה");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "שגיאה כללית");
    } finally {
      setBusy(false);
    }
  }

  if (paused) {
    const untilLabel = app.download_paused
      ? "ללא הגבלת זמן"
      : app.download_paused_until
      ? `עד ${new Date(app.download_paused_until).toLocaleDateString("he-IL")}`
      : "";
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="rounded-full bg-gold/15 px-2.5 py-1 text-xs font-bold text-gold">הורדה מושהית ({untilLabel})</span>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          onClick={() => callPause({ action: "unpause" })}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-accent hover:bg-accent/10"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />} ביטול השהיה
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={1}
          max={isPro ? undefined : MAX_FREE_PAUSE_DAYS}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="ימים"
          className="input-field w-16 px-2 py-1 text-center text-xs"
        />
        <button
          onClick={() => callPause({ action: "pause", days: days ? Number(days) : null })}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg bg-gold/15 px-2 py-1 text-xs font-bold text-gold hover:bg-gold/25"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PauseCircle className="h-3.5 w-3.5" />} השהיית הורדה
        </button>
      </div>
      {isPro ? (
        <button onClick={() => callPause({ action: "pause", days: null })} disabled={busy} className="text-xs text-gray-500 hover:text-white hover:underline">
          או השהיה ללא הגבלת זמן
        </button>
      ) : (
        <p className="text-xs text-gray-500">עד {MAX_FREE_PAUSE_DAYS} ימים בחשבון רגיל · PRO מסיר את ההגבלה</p>
      )}
    </div>
  );
}

export default function DeveloperAppsPanel({
  apps,
  points,
  isPro,
  proStatus,
  proAdminMessage,
  maxApps,
  developerUsername
}: {
  apps: AppRow[];
  points: number;
  isPro: boolean;
  proStatus: ProStatus;
  proAdminMessage?: string | null;
  maxApps: number;
  developerUsername?: string | null;
}) {
  const router = useRouter();

  async function dismissAdminNote(appId: string) {
    const res = await fetch(`/api/apps/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminNote: null })
    });
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h2 className="text-xl font-bold">אזור מפתח</h2>
        <Link href="/dashboard/developer/upload" className="btn-primary">
          <Plus className="h-4 w-4" /> העלאת אפליקציה/תוכנה חדשה
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary-light"><LayoutGrid className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-gray-500">אפליקציות/תוכנות</p>
            <p className="text-xl font-black">{apps.length} / {maxApps}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold"><Star className="h-5 w-5" /></div>
          <div>
            <p className="text-xs text-gray-500">מוניטין</p>
            <p className="text-xl font-black">{points.toLocaleString("he-IL")}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent"><Crown className="h-5 w-5" /></div>
          <div className="flex-1">
            <p className="text-xs text-gray-500">מסלול</p>
            <p className="mb-1 text-xl font-black">{isPro ? "PRO" : "רגיל"}</p>
            <ProRequestButton proStatus={proStatus} adminMessage={proAdminMessage} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-bold">האפליקציות והתוכנות שלי</h3>
        {apps.length === 0 ? (
          <div className="card p-10 text-center text-gray-500">עדיין לא העלית אפליקציות או תוכנות. לחץ על "העלאת אפליקציה/תוכנה חדשה" כדי להתחיל.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {apps.map((app) => (
              <div key={app.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Link href={`/apps/${app.id}`} className="font-bold text-white hover:underline">{app.name}</Link>
                    <StatusBadge status={app.status} />
                    {app.source === "public_suggestion" ? (
                      <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-bold text-gray-400" title="נוצרה מהצעה ציבורית שאושרה - לא ניתנת לעריכה">
                        מהצעה ציבורית
                      </span>
                    ) : (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary-light" title="הועלתה ישירות על ידך - ניתנת לעריכה ולהעלאת גרסאות חדשות">
                        העלאה פרטית
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-gray-500">{app.short_description}</p>
                  {app.status === "rejected" && app.review_note && (
                    <p className="mt-1 text-xs text-red-400">סיבת דחייה: {app.review_note}</p>
                  )}
                  {app.admin_note && (
                    <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-2.5 py-1.5 text-xs text-gold">
                      <span className="flex-1">הודעה מהצוות: {app.admin_note}</span>
                      <button onClick={() => dismissAdminNote(app.id)} className="shrink-0 font-bold underline hover:text-white">
                        טופל, הסתר
                      </button>
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                    <span>{app.downloads_count.toLocaleString("he-IL")} הורדות</span>
                    {developerUsername && (
                      <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> {developerUsername}</span>
                    )}
                    {app.source === "public_suggestion" ? (
                      <span className="text-xs text-gray-600" title="אפליקציה שפורסמה מהצעה ציבורית אינה ניתנת לעריכה">
                        פורסמה מהצעה ציבורית - לא ניתנת לעריכה
                      </span>
                    ) : (
                      <Link href={`/dashboard/developer/apps/${app.id}/edit`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-primary-light transition hover:bg-primary/10">
                        <Pencil className="h-3.5 w-3.5" /> עריכה / גרסה חדשה
                      </Link>
                    )}
                    {app.status !== "approved" && <DeleteAppButton appId={app.id} />}
                  </div>
                </div>
                <PauseControls app={app} isPro={isPro} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
