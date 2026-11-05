"use client";
import { useEffect, useRef } from "react";

// כמו setInterval, אבל רץ רק כשהלשונית מוצגת: לשונית ברקע לא מבקשת כלום מהשרת, וברגע שחוזרים
// אליה מתבצעת קריאה מיידית אחת והפולינג ממשיך. חוסך את רוב הבקשות החוזרות של משתמשים שמשאירים
// לשוניות פתוחות.
export function useVisibleInterval(fn: () => void, ms: number, enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    let t: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!t) t = setInterval(() => ref.current(), ms);
    };
    const stop = () => {
      if (t) {
        clearInterval(t);
        t = null;
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        ref.current();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ms, enabled]);
}
