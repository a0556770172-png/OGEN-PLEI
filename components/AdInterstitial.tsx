"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Megaphone, ArrowLeft } from "lucide-react";

const DURATION_MS = 9000;

// "פרסומת" קצרה של 9 שניות שרצה לפני שהורדה בפועל מתחילה - קידום עצמי של אפשרות
// הפרסום באתר (עסק שרוצה לפרסם רואה בדיוק את החשיפה שהוא יקבל). ממשיכה אוטומטית
// בתום הזמן - אין כפתור דילוג, כדי לשמור על חשיפה עקבית.
export default function AdInterstitial({ onDone }: { onDone: () => void }) {
  const [msLeft, setMsLeft] = useState(DURATION_MS);

  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => {
      const left = Math.max(0, DURATION_MS - (Date.now() - start));
      setMsLeft(left);
      if (left <= 0) clearInterval(iv);
    }, 100);
    const t = setTimeout(onDone, DURATION_MS);
    return () => {
      clearInterval(iv);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const secondsLeft = Math.max(1, Math.ceil(msLeft / 1000));
  const progress = Math.min(100, 100 - (msLeft / DURATION_MS) * 100);

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      dir="rtl"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-gold/40 bg-bg shadow-2xl"
      >
        <div className="h-1.5 w-full bg-gradient-to-l from-gold via-primary to-gold" />
        <div className="flex flex-col items-center gap-3 p-7 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-primary text-[#fff] shadow-glow">
            <Megaphone className="h-7 w-7" />
          </div>
          <div>
            <p className="text-lg font-black text-white">👀 ראיתם את זה?</p>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-300">
              בדיוק ככה גם <b className="text-gold">הלקוחות שלכם</b> יראו את העסק שלכם — מול כל מי שמוריד כאן
              אפליקציות ותוכנות, כל יום. פרסום פשוט, ממוקד, ועובד.
            </p>
          </div>

          <Link
            href="/advertise"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-1 w-full justify-center bg-gold text-[#111] hover:bg-gold/90"
          >
            לפרטים ולמחירון לחצו כאן <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="mt-1 w-full">
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface2">
              <div
                className="h-full bg-gold transition-[width] duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-gray-500">ההורדה ממשיכה אוטומטית בעוד {secondsLeft}…</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
