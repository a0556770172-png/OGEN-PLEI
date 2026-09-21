"use client";
import { useEffect, useState } from "react";
import { Mail, Loader2, Send, Clock, Gauge } from "lucide-react";

type Stats = {
  email_notifications_enabled: boolean;
  email_notifications_daily_cap: number;
  email_notifications_window_start: number;
  email_notifications_window_end: number;
  sentToday: number;
  remainingToday: number;
  pendingNotifications: number;
  pendingUsers: number;
};

export default function EmailNotificationsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/email-notifications")
      .then((r) => r.json())
      .then((j) => setStats(j))
      .catch(() => {});
  }
  useEffect(load, []);

  async function patch(body: Record<string, any>, field: string) {
    setSavingField(field);
    const res = await fetch("/api/admin/email-notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const j = await res.json().catch(() => ({}));
    setSavingField(null);
    if (res.ok) setStats(j);
    else alert(j.error || "שגיאה בעדכון ההגדרות");
  }

  async function runNow() {
    setBusy(true);
    setResultMsg(null);
    const res = await fetch("/api/admin/email-notifications/run", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !j.ok) {
      setResultMsg(j.error || "שגיאה בהרצה");
      return;
    }
    setResultMsg(
      j.skippedReason ? `לא נשלח: ${j.skippedReason}` : `נשלחו ${j.sentEmails} מיילים (דייג'סט לכל משתמש).`
    );
    load();
  }

  if (!stats) {
    return (
      <div className="card flex items-center justify-center p-6">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-4 p-6">
      <div className="flex items-center gap-2 text-lg font-bold text-white">
        <Mail className="h-5 w-5 text-primary-light" /> התראות במייל
      </div>
      <p className="text-sm text-gray-400">
        משתמשים שהדליקו "התראות במייל" בפרופיל שלהם מקבלים דייג'סט מייל אחד עם כל ההתראות הממתינות שלהם (מעקב
        אחרי מפתח/קטגוריה, אפליקציה חדשה, תגובות, פורום וכו'). כל מייל נחשב כיחידה אחת מהמכסה היומית - כך שגם
        למשתמש עם כמה התראות ממתינות נשלח מייל אחד בלבד. מי שלא הגיע אליו תור היום (המכסה נגמרה) יישאר בתור
        ויקבל אוטומטית מחר, ברגע שהמכסה מתאפסת.
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={() => patch({ enabled: !stats.email_notifications_enabled }, "enabled")}
          disabled={savingField === "enabled"}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${stats.email_notifications_enabled ? "bg-primary" : "bg-surface2"}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${stats.email_notifications_enabled ? "right-1" : "right-6"}`} />
        </button>
        <span className={`text-sm font-bold ${stats.email_notifications_enabled ? "text-primary-light" : "text-gray-400"}`}>
          {stats.email_notifications_enabled ? "המערכת פעילה" : "המערכת כבויה - לא נשלחים מיילי התראה"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 rounded-xl border border-border bg-surface2 p-3">
          <span className="inline-flex items-center gap-1 text-xs text-gray-500"><Gauge className="h-3.5 w-3.5" /> מכסה יומית (מיילים)</span>
          <input
            type="number"
            min={0}
            defaultValue={stats.email_notifications_daily_cap}
            onBlur={(e) => {
              const v = parseInt(e.target.value, 10);
              if (Number.isInteger(v) && v >= 0 && v !== stats.email_notifications_daily_cap) patch({ dailyCap: v }, "cap");
            }}
            className="input-field text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 rounded-xl border border-border bg-surface2 p-3">
          <span className="inline-flex items-center gap-1 text-xs text-gray-500"><Clock className="h-3.5 w-3.5" /> שעת התחלה (0-23)</span>
          <input
            type="number"
            min={0}
            max={23}
            defaultValue={stats.email_notifications_window_start}
            onBlur={(e) => {
              const v = parseInt(e.target.value, 10);
              if (Number.isInteger(v) && v >= 0 && v <= 23 && v !== stats.email_notifications_window_start) patch({ windowStart: v }, "start");
            }}
            className="input-field text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 rounded-xl border border-border bg-surface2 p-3">
          <span className="inline-flex items-center gap-1 text-xs text-gray-500"><Clock className="h-3.5 w-3.5" /> שעת סיום (1-24)</span>
          <input
            type="number"
            min={1}
            max={24}
            defaultValue={stats.email_notifications_window_end}
            onBlur={(e) => {
              const v = parseInt(e.target.value, 10);
              if (Number.isInteger(v) && v >= 1 && v <= 24 && v !== stats.email_notifications_window_end) patch({ windowEnd: v }, "end");
            }}
            className="input-field text-sm"
          />
        </label>
        <div className="flex flex-col justify-center gap-1 rounded-xl border border-border bg-surface2 p-3 text-xs text-gray-400">
          {savingField && <span className="inline-flex items-center gap-1 text-primary-light"><Loader2 className="h-3 w-3 animate-spin" /> שומר...</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-gray-300">נשלחו היום: <b className="text-white">{stats.sentToday}</b> / {stats.email_notifications_daily_cap}</span>
        <span className="text-emerald-400">נותר היום: <b>{stats.remainingToday}</b></span>
        <span className="text-amber-400">ממתינים בתור: <b>{stats.pendingUsers}</b> משתמשים ({stats.pendingNotifications} התראות)</span>
      </div>

      <button
        onClick={runNow}
        disabled={busy}
        className="flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} שלח עכשיו (ידני)
      </button>

      {resultMsg && <p className="text-sm text-gray-300">{resultMsg}</p>}
    </div>
  );
}
