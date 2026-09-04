"use client";
import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// כפתור קטן שמאפשר להפעיל/לכבות התראות דפדפן אמיתיות (Web Push) - מוצג לכל משתמש מחובר,
// כדי שגם מנויי התראות (מפתח פרסם, קטגוריה חדשה וכו') יגיעו כשלא נמצאים באתר. לוחצים פעם
// אחת, מאשרים הרשאה בדפדפן, וזהו.
export default function PushNotificationsSetup({ variant = "icon" }: { variant?: "icon" | "full" }) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setSupported(true);
    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    }).catch(() => {});
  }, []);

  async function toggle() {
    if (!supported || busy) return;
    setBusy(true);
    setError("");
    try {
      const reg = await navigator.serviceWorker.ready;
      if (subscribed) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint })
          });
          await sub.unsubscribe();
        }
        setSubscribed(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission === "denied") {
          setError("ההרשאה נחסמה בדפדפן - יש לאשר התראות באתר דרך הגדרות הדפדפן (ליד שורת הכתובת).");
          setBusy(false);
          return;
        }
        if (permission !== "granted") { setBusy(false); return; }
        // תוקן: קודם זה נכשל בשקט לגמרי בלי שום הודעה אם המפתח לא הוגדר בסביבת Vercel -
        // עכשיו יש הודעה מפורשת כדי שאפשר לאבחן שזו בדיוק הבעיה.
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          setError("התראות דפדפן לא מוגדרות באתר (חסר NEXT_PUBLIC_VAPID_PUBLIC_KEY במשתני הסביבה ב-Vercel).");
          setBusy(false);
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON())
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setError(json?.error || "שמירת ההרשמה להתראות נכשלה בשרת.");
          await sub.unsubscribe().catch(() => {});
          setBusy(false);
          return;
        }
        setSubscribed(true);
      }
    } catch (err: any) {
      setError(err?.message || "הפעלת ההתראות נכשלה. ודאו שהאתר נגיש דרך HTTPS.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    if (variant === "full") {
      return (
        <p className="rounded-xl border border-border bg-surface2/50 px-3 py-2 text-xs text-gray-500">
          הדפדפן הזה לא תומך בהתראות דפדפן (Web Push). ההתראות עדיין יופיעו בפעמון באתר.
        </p>
      );
    }
    return null;
  }

  if (variant === "full") {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          onClick={toggle}
          disabled={busy}
          className={`flex w-fit items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-bold transition ${
            subscribed
              ? "border-accent/50 bg-accent/10 text-accent"
              : "border-border bg-surface2 text-gray-300 hover:border-primary/50 hover:text-white"
          }`}
        >
          {subscribed ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          {subscribed ? "התראות דפדפן מופעלות (לחצו לכיבוי)" : "הפעלת התראות דפדפן (גם כשלא באתר)"}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="relative flex items-center">
      <button
        onClick={toggle}
        disabled={busy}
        title={subscribed ? "כיבוי התראות דפדפן" : "הפעלת התראות דפדפן (גם כשלא נמצאים באתר)"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${
          subscribed ? "border-accent/50 bg-accent/10 text-accent" : "border-border bg-surface text-gray-300 hover:border-primary/50 hover:text-white"
        }`}
      >
        {subscribed ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      </button>
      {error && (
        <div className="absolute top-11 z-50 w-64 rounded-xl border border-red-500/30 bg-surface p-3 text-xs text-red-400 shadow-card">
          {error}
        </div>
      )}
    </div>
  );
}
