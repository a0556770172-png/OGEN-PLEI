"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getMe } from "@/lib/clientSession";

// רכיב שקוף ב-layout: משתמש מחובר שנחסם בזמן שהוא באתר מועבר מיד לעמוד /banned (סיבה, משך,
// ערעור) - בלי לחכות שילחץ על משהו או ירענן. בודק כל 20 שניות כשהלשונית פתוחה ומוצגת, וגם
// מיד כשחוזרים ללשונית. אורח (לא מחובר) - בודק פעם אחת ומפסיק.
const CHECK_EVERY_MS = 60_000;
const ALLOWED_PREFIXES = ["/banned", "/login", "/signup", "/auth"];

export default function BanWatcher() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  // רץ פעם אחת (לא בכל ניווט): בדיקה בטעינה, ואז כל דקה כשהלשונית מוצגת, וגם בחזרה ללשונית.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let lastCheck = 0;

    async function check(force = false) {
      const p = pathRef.current;
      if (ALLOWED_PREFIXES.some((a) => p === a || p.startsWith(a + "/"))) return;
      if (stopped || document.visibilityState !== "visible") return;
      if (!force && Date.now() - lastCheck < 15_000) return;
      lastCheck = Date.now();
      try {
        // אורח (לא מחובר) - אין מה לבדוק, לא שולחים בקשה
        const { user } = await getMe();
        if (!user) {
          stop();
          return;
        }
        const res = await fetch("/api/profile/ban-status", { cache: "no-store" });
        const json = await res.json();
        if (json.guest) {
          stop();
          return;
        }
        // טעינה מלאה (ולא ניווט פנימי) - כדי שה-middleware ינתב בוודאות ל-/banned
        if (json.banned) window.location.href = "/banned";
      } catch {
        // תקלת רשת זמנית - ננסה שוב בבדיקה הבאה
      }
    }

    function onVisible() {
      check();
    }

    function stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    }

    check(true);
    timer = setInterval(() => check(true), CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    return stop;
  }, []);

  return null;
}
