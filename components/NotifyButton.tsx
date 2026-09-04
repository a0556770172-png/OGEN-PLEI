"use client";
import { useEffect, useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";

// כפתור הרשמה/ביטול למנוי התראות.
// אם subscribed לא סופק - הכפתור בודק את המצב בעצמו (fetch על טעינה).
export default function NotifyButton({
  type,
  targetId,
  label,
  subscribed: initial,
  size = "md"
}: {
  type: "developer" | "category" | "new_public" | "all_new" | "app" | "community";
  targetId?: string;
  label: string;
  subscribed?: boolean;
  size?: "sm" | "md";
}) {
  const [subscribed, setSubscribed] = useState(!!initial);
  const [ready, setReady] = useState(initial !== undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initial !== undefined) return;
    fetch("/api/notifications/subscriptions")
      .then((r) => r.json())
      .then((j) => {
        const on = (j.subscriptions ?? []).some(
          (s: any) => s.type === type && (targetId ? s.targetId === targetId : true)
        );
        setSubscribed(on);
      })
      .catch(() => {})
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !subscribed;
    setSubscribed(next); // אופטימי
    const res = await fetch("/api/notifications/subscribe", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, targetId })
    });
    setBusy(false);
    if (!res.ok) setSubscribed(!next); // החזרה במקרה כשל
  }

  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm";

  if (!ready) return null;

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={label}
      className={`inline-flex items-center gap-1.5 rounded-xl font-bold transition ${pad} ${
        subscribed
          ? "border border-primary/50 bg-primary/15 text-primary-light"
          : "border border-border bg-surface2 text-gray-300 hover:border-primary/40 hover:text-white"
      }`}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : subscribed ? (
        <BellRing className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {subscribed ? "מנוי פעיל" : label}
    </button>
  );
}
