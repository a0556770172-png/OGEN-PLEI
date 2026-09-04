"use client";
import { useEffect, useState } from "react";
import { Bell, Loader2, X, Package, Tag } from "lucide-react";
import PushNotificationsSetup from "./PushNotificationsSetup";

interface Sub {
  type: "developer" | "category" | "new_public" | "all_new";
  targetId: string;
  label: string;
}

export default function NotificationsManager() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  function load() {
    fetch("/api/notifications/subscriptions")
      .then((r) => r.json())
      .then((j) => setSubs(j.subscriptions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const has = (type: string) => subs.some((s) => s.type === type);

  async function toggleGlobal(type: "all_new" | "new_public" | "community") {
    const on = !has(type);
    setBusy(type);
    await fetch("/api/notifications/subscribe", {
      method: on ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type })
    }).catch(() => {});
    setBusy("");
    load();
  }

  async function remove(s: Sub) {
    setBusy(s.type + s.targetId);
    await fetch("/api/notifications/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: s.type, targetId: s.targetId })
    }).catch(() => {});
    setBusy("");
    load();
  }

  const devSubs = subs.filter((s) => s.type === "developer");
  const catSubs = subs.filter((s) => s.type === "category");

  return (
    <div className="card mx-auto flex w-full max-w-xl flex-col gap-4 p-6">
      <div className="flex items-center gap-2 text-lg font-bold text-white">
        <Bell className="h-5 w-5 text-primary-light" /> ההתראות שלי
      </div>
      <p className="-mt-2 text-xs text-gray-500">
        ההתראות מופיעות תמיד בפעמון למעלה. כדי לקבל אותן גם כהתראת דפדפן (גם כשלא נמצאים באתר) — הפעילו כאן:
      </p>
      <PushNotificationsSetup variant="full" />

      {loading ? (
        <div className="flex justify-center p-4">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {(["all_new", "new_public", "community"] as const).map((type) => {
            const on = has(type);
            const title =
              type === "all_new"
                ? "כל אפליקציה חדשה באתר"
                : type === "new_public"
                ? "כל אפליקציה ציבורית חדשה"
                : "בקשות קהילה חדשות";
            return (
              <div key={type} className="flex items-center gap-3">
                <button
                  onClick={() => toggleGlobal(type)}
                  disabled={busy === type}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-primary" : "bg-surface2"}`}
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${on ? "right-1" : "right-6"}`} />
                </button>
                <span className={`text-sm ${on ? "text-primary-light" : "text-gray-400"}`}>{title}</span>
              </div>
            );
          })}

          {(devSubs.length > 0 || catSubs.length > 0) && (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              {devSubs.map((s) => (
                <div key={s.targetId} className="flex items-center justify-between gap-2 rounded-lg bg-surface2/50 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 text-gray-300"><Package className="h-3.5 w-3.5 text-primary-light" /> מפתח: {s.label}</span>
                  <button onClick={() => remove(s)} disabled={busy === s.type + s.targetId} className="text-gray-500 hover:text-red-400">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {catSubs.map((s) => (
                <div key={s.targetId} className="flex items-center justify-between gap-2 rounded-lg bg-surface2/50 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 text-gray-300"><Tag className="h-3.5 w-3.5 text-primary-light" /> קטגוריה: {s.label}</span>
                  <button onClick={() => remove(s)} disabled={busy === s.type + s.targetId} className="text-gray-500 hover:text-red-400">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {subs.length === 0 && (
            <p className="text-xs text-gray-500">
              עדיין לא נרשמת להתראות. אפשר להירשם למפתח מסוים מהפרופיל הציבורי שלו, או לקטגוריה מהחנות.
            </p>
          )}
        </>
      )}
    </div>
  );
}
