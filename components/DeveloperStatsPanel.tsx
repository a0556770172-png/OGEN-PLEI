"use client";
import { useEffect, useState } from "react";
import { BarChart3, ChevronDown, ChevronUp, Loader2, Download, Users, TrendingUp, Heart, MessageSquare, Package } from "lucide-react";
import { screenshotUrl } from "@/lib/appPath";

interface StatsResponse {
  app: { id: string; name: string; version: string; downloadsCount: number; createdAt: string; publishedAt: string | null; lastUpdatedAt: string | null };
  stats: {
    versions: { version: string; downloads: number; users: number; first_at: string; last_at: string }[];
    daily: { day: string; downloads: number }[];
    totals: { events: number; users: number; last7: number; last30: number };
  };
  likes: number;
  reviews: number;
  releases: { version: string; at: string | null }[];
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" });
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Download; label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-surface2 p-3">
      <div className="flex items-center gap-1.5 text-xs text-gray-400"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 text-2xl font-black text-white">{value}</div>
      {hint && <div className="text-[11px] text-gray-500">{hint}</div>}
    </div>
  );
}

function AppStats({ appId }: { appId: string }) {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/developer/app-stats?appId=${appId}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || "שגיאה בטעינת הנתונים");
        if (!cancelled) setData(j);
      })
      .catch((e) => { if (!cancelled) setError(e.message || "שגיאה בטעינת הנתונים"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [appId]);

  if (loading) return <div className="flex items-center gap-2 p-4 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> טוען נתונים...</div>;
  if (error) return <div className="p-4 text-sm text-red-400">{error}</div>;
  if (!data) return null;

  const { app, stats, likes, reviews, releases } = data;
  const trackedTotal = stats.totals.events;
  // הורדות שנספרו במונה של האפליקציה אבל אין להן רישום מפורט (לפני תחילת מעקב הגרסאות, או הורדה של המפתח עצמו)
  const untracked = Math.max(0, app.downloadsCount - trackedTotal);
  const versionsMax = Math.max(1, ...stats.versions.map((v) => v.downloads), untracked);
  const releaseAt = new Map(releases.map((r) => [r.version, r.at]));
  const currentRow = stats.versions.find((v) => v.version === app.version);

  // 30 ימים אחרונים, כולל ימים בלי הורדות
  const byDay = new Map(stats.daily.map((d) => [d.day, d.downloads]));
  const days: { key: string; n: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
    days.push({ key, n: byDay.get(key) ?? 0 });
  }
  const dayMax = Math.max(1, ...days.map((d) => d.n));

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Download} label="סה״כ הורדות" value={app.downloadsCount} hint="לפי מונה האפליקציה" />
        <Stat icon={Users} label="משתמשים ייחודיים" value={stats.totals.users} />
        <Stat icon={TrendingUp} label="7 ימים אחרונים" value={stats.totals.last7} hint={`30 ימים: ${stats.totals.last30}`} />
        <Stat icon={Package} label={`גרסה נוכחית ${app.version}`} value={currentRow?.downloads ?? 0} hint="הורדות של הגרסה הזו" />
        <Stat icon={Heart} label="לייקים" value={likes} />
        <Stat icon={MessageSquare} label="ביקורות" value={reviews} />
      </div>

      <div>
        <h4 className="mb-2 text-sm font-bold text-white">הורדות לפי גרסה</h4>
        {stats.versions.length === 0 && untracked === 0 ? (
          <p className="text-sm text-gray-500">עדיין אין הורדות מפורטות.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {stats.versions.map((v) => {
              const label = v.version || "לא ידועה";
              const isCurrent = v.version === app.version;
              return (
                <div key={label} className="rounded-xl border border-white/10 bg-surface2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-bold text-white">
                      גרסה {label} {isCurrent && <span className="ms-1 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary-light">נוכחית</span>}
                    </span>
                    <span className="text-white">{v.downloads} הורדות · {v.users} משתמשים</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/30">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(v.downloads / versionsMax) * 100}%` }} />
                  </div>
                  <div className="mt-1.5 text-[11px] text-gray-500">
                    {releaseAt.get(v.version) ? `אושרה ${fmtDate(releaseAt.get(v.version))} · ` : ""}
                    הורדה ראשונה {fmtDate(v.first_at)} · אחרונה {fmtDate(v.last_at)}
                  </div>
                </div>
              );
            })}
            {untracked > 0 && (
              <div className="rounded-xl border border-dashed border-white/10 p-3 text-sm text-gray-400">
                <div className="flex items-center justify-between">
                  <span>הורדות ללא פירוט גרסה</span>
                  <span className="text-white">{untracked}</span>
                </div>
                <p className="mt-1 text-[11px] text-gray-500">הורדות מלפני שהאתר התחיל לתעד גרסאות, והורדה אחת של המפתח עצמו.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-sm font-bold text-white">הורדות ב-30 הימים האחרונים</h4>
        <div className="flex h-24 items-end gap-[3px]" dir="ltr">
          {days.map((d) => (
            <div key={d.key} className="flex-1 rounded-t bg-primary/70" style={{ height: `${Math.max(d.n ? 6 : 2, (d.n / dayMax) * 100)}%`, opacity: d.n ? 1 : 0.25 }} title={`${d.key}: ${d.n}`} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-gray-500" dir="ltr">
          <span>{days[0].key.slice(5)}</span>
          <span>{days[days.length - 1].key.slice(5)}</span>
        </div>
      </div>

      {releases.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-bold text-white">היסטוריית עדכונים שאושרו</h4>
          <ul className="flex flex-col gap-1 text-sm text-gray-400">
            {[...releases].reverse().map((r, i) => (
              <li key={`${r.version}-${i}`}>גרסה <b className="text-white">{r.version}</b> · {fmtDate(r.at)}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-gray-500">ההורדות שלך (בדיקות) לא נספרות בפירוט. נתוני גרסה נשמרים מהרגע שהאתר התחיל לתעד אותם.</p>
    </div>
  );
}

export default function DeveloperStatsPanel({
  apps
}: {
  apps: { id: string; name: string; version: string; downloads_count: number; status: string; icon_key: string | null }[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (apps.length === 0) {
    return <div className="card p-6 text-center text-sm text-gray-500">כשתעלו אפליקציה יופיעו כאן נתוני ההורדות שלה.</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {apps.map((a) => {
        const open = openId === a.id;
        return (
          <div key={a.id} className="card overflow-hidden">
            <button type="button" onClick={() => setOpenId(open ? null : a.id)} className="flex w-full items-center gap-3 p-4 text-right">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface2 ring-1 ring-border">
                {a.icon_key ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={screenshotUrl(a.icon_key)} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <Package className="h-5 w-5 text-gray-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-white">{a.name}</p>
                <p className="text-xs text-gray-500">גרסה {a.version} · {a.downloads_count} הורדות</p>
              </div>
              <span className="hidden items-center gap-1 text-xs text-primary-light sm:inline-flex"><BarChart3 className="h-3.5 w-3.5" /> פירוט</span>
              {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </button>
            {open && (
              <div className="border-t border-border">
                <AppStats appId={a.id} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
