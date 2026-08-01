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

// כפתור קטן שמאפשר להפעיל/לכבות התראות דפדפן אמיתיות (Web Push) - מוצג רק לצוות הפיקוח/מנהל
// (הם מי שבאמת צריכים לדעת גם כשהם לא נמצאים באתר). לוחצים פעם אחת, מאשרים הרשאה בדפדפן, וזהו.
export default function PushNotificationsSetup() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

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
        if (permission !== "granted") { setBusy(false); return; }
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) { setBusy(false); return; }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON())
        });
        setSubscribed(true);
      }
    } catch {
      // אם ההרשמה נכשלת מסיבה כלשהי (הרשאה נדחתה, דפדפן לא תומך וכו') - פשוט לא מפעילים,
      // בלי לשבור את שאר האתר
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
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
  );
}
