"use client";
import { useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";

// כפתור הרשמה/ביטול למנוי התראות. subscribed מגיע מהשרת (הדף שמכיל את הכפתור).
export default function NotifyButton({
  type,
  targetId,
  label,
  subscribed: initial,
  size = "md"
}: {
  type: "developer" | "category" | "new_public" | "all_new";
  targetId?: string;
  label: string;
  subscribed: boolean;
  size?: "sm" | "md";
}) {
  const [subscribed, setSubscribed] = useState(initial);
  const [busy, setBusy] = useState(false);

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
