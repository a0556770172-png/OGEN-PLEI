"use client";
import { useEffect, useState } from "react";
import { Loader2, Mail, MailCheck } from "lucide-react";

// מתג "לקבל התראות גם במייל" - אותו מתג כמו בפרופיל (profiles.email_notifications_enabled,
// ראו app/api/profile/email-notifications). כשהוא דלוק, כל התראה שנכנסת לפעמון (למשל תגובה
// חדשה בשרשור שעוקבים אחריו) נשלחת גם במייל דייג'סט - ראו lib/emailNotifications.ts.
export default function EmailNotifyToggle({ size = "md" }: { size?: "sm" | "md" }) {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/profile/email-notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        setEnabled(!!j.enabled);
        setReady(true);
      })
      .catch(() => {});
  }, []);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !enabled;
    setEnabled(next); // אופטימי
    const res = await fetch("/api/profile/email-notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next })
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) setEnabled(!next); // החזרה במקרה כשל
  }

  if (!ready) return null;

  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm";

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title="קבלת ההתראות גם במייל"
      className={`inline-flex items-center gap-1.5 rounded-xl font-bold transition ${pad} ${
        enabled
          ? "border border-accent/50 bg-accent/15 text-accent"
          : "border border-border bg-surface2 text-gray-300 hover:border-accent/40 hover:text-white"
      }`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : enabled ? <MailCheck className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
      {enabled ? "מקבלים גם במייל" : "קבלו גם במייל"}
    </button>
  );
}
