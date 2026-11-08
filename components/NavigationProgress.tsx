"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// סימון "חושב" בזמן מעבר בין דפים. עמודי האתר נבנים בשרת בכל כניסה, ובעומס הלחיצה על קישור
// יכולה לקחת שניות - בלי סימון המשתמש חושב שהאתר תקוע ולוחץ שוב. בלחיצה על קישור פנימי:
//  1. מיד: פס התקדמות בראש המסך (מתקדם בהאטה עד ~90%, וגומר ברגע שהדף החדש נטען) + סמן "ממתין".
//  2. אם עברו 350ms וההמתנה נמשכת: התוכן מתעמעם קלות. מעבר מהיר (הרגיל) לא מתעמעם בכלל.
// הסיום מזוהה לפי שינוי ב-pathname/search - אין כאן מעקב אחרי הרשת ואין עיכוב לניווט עצמו.

const SLOW_AFTER_MS = 350;
const MAX_MS = 15000; // רשת ביטחון: גם אם משהו השתבש, הפס לא נשאר תקוע לנצח

function isModifiedClick(e: MouseEvent) {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(false);

  function clearTimers() {
    if (trickle.current) clearInterval(trickle.current);
    if (slowTimer.current) clearTimeout(slowTimer.current);
    if (maxTimer.current) clearTimeout(maxTimer.current);
    trickle.current = slowTimer.current = maxTimer.current = null;
  }

  function finish() {
    if (!active.current) return;
    active.current = false;
    clearTimers();
    const root = document.documentElement;
    root.classList.remove("ogen-navigating", "ogen-navigating-slow");
    setProgress(100);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);
  }

  function start() {
    if (active.current) return;
    active.current = true;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const root = document.documentElement;
    root.classList.add("ogen-navigating");
    setVisible(true);
    setProgress(12);
    // התקדמות שמאטה ככל שמתקרבת ל-90% - נראה "חי" גם כשההמתנה ארוכה, ולא מגיע ל-100% לפני הסיום האמיתי
    trickle.current = setInterval(() => {
      setProgress((p) => (p < 90 ? p + (90 - p) * 0.08 : p));
    }, 200);
    slowTimer.current = setTimeout(() => root.classList.add("ogen-navigating-slow"), SLOW_AFTER_MS);
    maxTimer.current = setTimeout(finish, MAX_MS);
  }

  // הדף החדש נטען (הכתובת השתנתה) - מסיימים
  const search = searchParams?.toString() ?? "";
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  // זיהוי לחיצה על קישור פנימי שמוביל לכתובת אחרת
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (isModifiedClick(e)) return;
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;
      if (anchor.hasAttribute("download")) return;
      const target = anchor.getAttribute("target");
      if (target && target !== "_self") return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // אותה כתובת בדיוק (או רק שינוי hash) - אין ניווט, אין מה לסמן
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ניקוי כשהרכיב יורד
  useEffect(() => {
    return () => {
      clearTimers();
      if (hideTimer.current) clearTimeout(hideTimer.current);
      document.documentElement.classList.remove("ogen-navigating", "ogen-navigating-slow");
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px]"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease-out" }}
    >
      {/* האתר ב-RTL: הפס מתחיל מהצד הימני ומתקדם שמאלה */}
      <div
        className="absolute inset-y-0 right-0"
        style={{
          width: `${progress}%`,
          background: "linear-gradient(270deg, rgb(var(--c-primary-light)), rgb(var(--c-primary)) 55%, #00d9c0)",
          boxShadow: "0 0 10px rgb(var(--c-primary) / 0.7)",
          transition: progress === 0 ? "none" : "width 200ms ease-out"
        }}
      />
    </div>
  );
}
