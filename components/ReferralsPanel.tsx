"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Users, Sparkles, ShieldAlert, Clock, PartyPopper, Undo2, Check } from "lucide-react";
import type { ReferralEvent, ReferralStatus } from "@/types/database";

const STATUS_META: Record<ReferralStatus, { label: string; className: string; icon: typeof PartyPopper }> = {
  rewarded: { label: "תוגמל", className: "bg-accent/15 text-accent", icon: PartyPopper },
  capped: { label: "מעבר לתקרה היומית", className: "bg-gold/15 text-gold", icon: Clock },
  blocked_ip: { label: "נחסם - אותה רשת", className: "bg-red-500/15 text-red-400", icon: ShieldAlert },
  revoked: { label: "בוטל ידנית", className: "bg-gray-500/15 text-gray-400", icon: Undo2 }
};

export default function ReferralsPanel({ events }: { events: ReferralEvent[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.referrer?.username?.toLowerCase().includes(q) ||
        e.referrer?.email?.toLowerCase().includes(q) ||
        e.referred?.username?.toLowerCase().includes(q) ||
        e.referred?.email?.toLowerCase().includes(q) ||
        (e.signup_ip ?? "").includes(q)
    );
  }, [events, query]);

  const stats = useMemo(() => {
    const rewarded = events.filter((e) => e.status === "rewarded");
    return {
      total: events.length,
      rewarded: rewarded.length,
      points: rewarded.reduce((s, e) => s + (e.referrer_points_awarded || 0), 0),
      blocked: events.filter((e) => e.status === "capped" || e.status === "blocked_ip").length
    };
  }, [events]);

  async function act(id: string, action: "release" | "revoke") {
    if (action === "revoke" && !window.confirm("לבטל את התגמול של ההפניה הזו? המוניטין והקרדיט יוחזרו.")) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/referrals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    setBusyId(null);
    if (res.ok) router.refresh();
    else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "שגיאה בביצוע הפעולה");
    }
  }

  const tiles = [
    { icon: Users, label: "סה\"כ הפניות", value: stats.total, tone: "text-primary-light" },
    { icon: PartyPopper, label: "תוגמלו", value: stats.rewarded, tone: "text-accent" },
    { icon: Sparkles, label: "מוניטין שחולקו", value: stats.points, tone: "text-gold" },
    { icon: ShieldAlert, label: "נחסמו / מעבר לתקרה", value: stats.blocked, tone: "text-red-400" }
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4">
        <p className="text-sm text-gray-400">
          כל משתמש משתף קישור <span className="font-mono text-gray-300" dir="ltr">/?ref=&lt;שם המשתמש&gt;</span>. חבר חדש שנרשם
          דרכו ומאמת מייל מזכה את המפנה ב-25 מוניטין + קרדיט העלאה של 150MB, ואת המצטרף ב-10 מוניטין. הפניה שנחסמה
          (אותה רשת של המפנה, או מעבר ל-5 ליום) נרשמת כאן ואפשר לשחרר אותה ידנית אם היא לגיטימית.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="card flex flex-col items-center gap-1 p-3 text-center">
            <t.icon className={`h-4 w-4 ${t.tone}`} />
            <span className="text-xl font-black text-white">{t.value}</span>
            <span className="text-[11px] leading-tight text-gray-500">{t.label}</span>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי שם משתמש, מייל או IP..."
          className="input-field w-full pe-10"
        />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-right text-xs text-gray-500">
              <th className="px-4 py-3">מפנה</th>
              <th className="px-4 py-3">מצטרף</th>
              <th className="px-4 py-3">סטטוס</th>
              <th className="px-4 py-3">מוניטין</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">תאריך</th>
              <th className="px-4 py-3">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => {
              const meta = STATUS_META[e.status];
              return (
                <tr key={e.id} className="border-b border-border/50 last:border-0 hover:bg-surface2/50">
                  <td className="px-4 py-3">
                    <div className="font-bold text-white">{e.referrer?.username ?? "—"}</div>
                    <div className="text-xs text-gray-500">{e.referrer?.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-300">{e.referred?.username ?? "—"}</div>
                    <div className="text-xs text-gray-500">{e.referred?.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>
                      <meta.icon className="h-3 w-3" /> {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    מפנה: {e.referrer_points_awarded} · מצטרף: {e.joiner_points_awarded}
                    {e.size_credit_awarded && <span className="block text-gold">+ קרדיט 150MB</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500" dir="ltr">{e.signup_ip ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(e.created_at).toLocaleString("he-IL")}</td>
                  <td className="px-4 py-3">
                    {busyId === e.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    ) : (e.status === "capped" || e.status === "blocked_ip") ? (
                      <button onClick={() => act(e.id, "release")} className="btn-ghost text-xs">
                        <Check className="h-3.5 w-3.5 text-accent" /> שחרר ותגמל
                      </button>
                    ) : e.status === "rewarded" ? (
                      <button onClick={() => act(e.id, "revoke")} className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-500/10">
                        <Undo2 className="ms-0 me-1 inline h-3.5 w-3.5" /> בטל תגמול
                      </button>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">אין הפניות עדיין</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
