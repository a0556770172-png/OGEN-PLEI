"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// רכיב שקוף ב-layout: משתמש מחובר שנחסם בזמן שהוא באתר מועבר מיד לעמוד /banned (סיבה, משך,
// ערעור) - בלי לחכות שילחץ על משהו או ירענן. בודק כל 20 שניות כשהלשונית פתוחה ומוצגת, וגם
// מיד כשחוזרים ללשונית. אורח (לא מחובר) - בודק פעם אחת ומפסיק.
const CHECK_EVERY_MS = 20_000;
const ALLOWED_PREFIXES = ["/banned", "/login", "/signup", "/auth"];

export default function BanWatcher() {
  const pathname = usePathname();

  useEffect(() => {
    if (ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return;

    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function check() {
      if (stopped || document.visibilityState !== "visible") return;
      try {
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

    function stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    }

    check();
    timer = setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", check);
    return stop;
  }, [pathname]);

  return null;
}
