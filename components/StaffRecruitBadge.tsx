"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cachedJson } from "@/lib/clientSession";

const DISMISS_KEY = "ogen-recruit-dismissed";
const DISMISS_DAYS = 7;

// באנר קטן וצף (פינה ימנית-תחתונה, מול העוזר שמשמאל) שמזמין להצטרף לצוות הפיקוח ומוביל לשאלון (/join-team).
// לא מוצג: כשהגיוס סגור, לצוות עצמו, למי שכבר הגיש מועמדות פעילה, ובעמוד השאלון. אפשר לסגור ל-7 ימים.
export default function StaffRecruitBadge() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let active = true;
    // תצוגה מקדימה: ?recruit=1 מציג את הבאנר גם לצוות/למי שסגר אותו (כדי שהמנהל יוכל לראות איך זה נראה)
    if (new URLSearchParams(window.location.search).get("recruit") === "1") {
      setShow(true);
      return;
    }
    try {
      const t = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      if (t && Date.now() - t < DISMISS_DAYS * 86_400_000) return;
    } catch {
      // אין localStorage - מציגים
    }
    const timer = setTimeout(() => {
      cachedJson<{ open: boolean; isStaff: boolean; application: { status: string } | null }>("/api/team/status", 60_000).then((s) => {
        if (!active || !s) return;
        const activeApplication = !!s.application && s.application.status !== "rejected";
        setShow(!!s.open && !s.isStaff && !activeApplication);
      });
    }, 2500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  if (!show || pathname.startsWith("/join-team") || pathname.startsWith("/dashboard") || pathname.startsWith("/login") || pathname.startsWith("/banned")) return null;

  function dismiss(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="fixed bottom-6 right-6 z-40"
      dir="rtl"
    >
      <Link
        href="/join-team"
        className="relative flex items-center gap-2 rounded-full border border-gold/40 bg-bg/95 py-2 pl-9 pr-2 shadow-glow backdrop-blur-xl transition hover:scale-[1.04]"
      >
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-gold/20" style={{ animationDuration: "3s" }} />
        <span className="flex h-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold to-primary px-3 text-xs font-extrabold text-[#111]">
          פיקוח
        </span>
        <span className="text-xs font-bold text-white">רוצה להצטרף לצוות הפיקוח שלנו?</span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="סגירה"
          className="absolute left-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-3 w-3" />
        </button>
      </Link>
    </motion.div>
  );
}
