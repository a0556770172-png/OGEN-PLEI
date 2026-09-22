"use client";
import { useEffect, useState } from "react";
import { Loader2, Eye, Users, LayoutGrid, Download, TrendingUp, Trophy } from "lucide-react";

type DailyPoint = { date: string; visits: number; downloads: number; newUsers: number };
type Stats = {
  totals: { visits: number; users: number; apps: number; downloads: number };
  daily: DailyPoint[];
  topApps: { id: string; name: string; downloads_count: number }[];
};

function formatDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// גרף עמודות פשוט מבוסס CSS בלבד (בלי ספריית גרפים חיצונית) - שתי סדרות (כניסות/הורדות)
// זו לצד זו, לכל יום בטווח, כדי לראות מגמה ולא רק מספר מצטבר.
function MiniBarChart({ daily, metric, color }: { daily: DailyPoint[]; metric: keyof DailyPoint; color: string }) {
  const max = Math.max(1, ...daily.map((d) => Number(d[metric])));
  return (
    <div className="flex h-32 items-end gap-[3px] overflow-x-auto">
      {daily.map((d) => {
        const value = Number(d[metric]);
        const heightPct = Math.max((value / max) * 100, value > 0 ? 4 : 0);
        return (
          <div key={d.date} className="group relative flex min-w-[8px] flex-1 flex-col items-center justify-end">
            <div
              style={{ height: `${heightPct}%`, background: color }}
              className="w-full min-w-[6px] rounded-t transition-all"
            />
            <div className="pointer-events-none absolute bottom-full mb-1 hidden whitespace-nowrap rounded-md bg-black/90 px-2 py-1 text-[10px] text-white group-hover:block">
              {formatDate(d.date)}: {value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function StatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setStats(j);
      })
      .catch(() => setError("שגיאה בטעינת הסטטיסטיקה"));
  }, []);

  if (error) return <div className="card p-6 text-center text-red-400">{error}</div>;
  if (!stats) {
    return (
      <div className="card flex items-center justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  const period30Visits = stats.daily.reduce((s, d) => s + d.visits, 0);
  const period30Downloads = stats.daily.reduce((s, d) => s + d.downloads, 0);
  const period30NewUsers = stats.daily.reduce((s, d) => s + d.newUsers, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card flex flex-col gap-1.5 p-4">
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500"><Eye className="h-3.5 w-3.5" /> סה&quot;כ כניסות</span>
          <span className="text-2xl font-black text-white">{stats.totals.visits.toLocaleString("he-IL")}</span>
        </div>
        <div className="card flex flex-col gap-1.5 p-4">
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500"><Users className="h-3.5 w-3.5" /> סה&quot;כ משתמשים</span>
          <span className="text-2xl font-black text-white">{stats.totals.users.toLocaleString("he-IL")}</span>
        </div>
        <div className="card flex flex-col gap-1.5 p-4">
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500"><LayoutGrid className="h-3.5 w-3.5" /> אפליקציות מאושרות</span>
          <span className="text-2xl font-black text-white">{stats.totals.apps.toLocaleString("he-IL")}</span>
        </div>
        <div className="card flex flex-col gap-1.5 p-4">
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500"><Download className="h-3.5 w-3.5" /> סה&quot;כ הורדות</span>
          <span className="text-2xl font-black text-white">{stats.totals.downloads.toLocaleString("he-IL")}</span>
        </div>
      </div>

      <div className="card flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2 text-lg font-bold text-white">
          <TrendingUp className="h-5 w-5 text-primary-light" /> מגמה - 30 הימים האחרונים
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500">כניסות לאתר ({period30Visits.toLocaleString("he-IL")} בתקופה)</p>
          <MiniBarChart daily={stats.daily} metric="visits" color="rgb(var(--c-primary))" />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500">הורדות ({period30Downloads.toLocaleString("he-IL")} בתקופה)</p>
          <MiniBarChart daily={stats.daily} metric="downloads" color="#00d9c0" />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500">משתמשים חדשים ({period30NewUsers.toLocaleString("he-IL")} בתקופה)</p>
          <MiniBarChart daily={stats.daily} metric="newUsers" color="#f2b84b" />
        </div>
      </div>

      <div className="card flex flex-col gap-3 p-6">
        <div className="flex items-center gap-2 text-lg font-bold text-white">
          <Trophy className="h-5 w-5 text-gold" /> האפליקציות המבוקשות ביותר (הכל-זמנים)
        </div>
        <div className="flex flex-col gap-1.5">
          {stats.topApps.map((app, i) => (
            <div key={app.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface2/50 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 text-gray-200">
                <span className="w-5 shrink-0 text-center text-xs font-bold text-gray-500">{i + 1}</span>
                {app.name}
              </span>
              <span className="shrink-0 font-bold text-primary-light">{app.downloads_count.toLocaleString("he-IL")} הורדות</span>
            </div>
          ))}
          {stats.topApps.length === 0 && <p className="text-xs text-gray-500">אין עדיין נתוני הורדות.</p>}
        </div>
      </div>
    </div>
  );
}
