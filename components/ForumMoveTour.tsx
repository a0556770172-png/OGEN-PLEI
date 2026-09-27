"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MessagesSquare, X } from "lucide-react";

// הודעה + סיור חד-פעמי (לכל דפדפן): השרשור המרכזי במתמחים טופ ננעל, והדיון עבר לפורום שלנו.
// שלב 1: חלונית הסבר. שלב 2: המסך מוחשך והכפתור של הפורום בדף הבית (id="forum-button"
// ב-components/HomeHero.tsx) מודגש עד שלוחצים עליו. הלחיצה מובילה ל-/forum?tour=1, ושם
// components/StayUpdatedCard.tsx מסביר על מעקב והתראות במייל.
// "spotlight" נשמר כדי שמי שלחץ "הראו לי" ויצא בלי ללחוץ - יראה את ההדגשה שוב בביקור הבא.
const KEY = "ogen-forum-move-tour-v1";
const FORUM_URL = "/forum?tour=1";
// חלוניות אחרות שעלולות להופיע בדף הבית (חוקי האתר, עדכונים, פרסומת, "חדש באתר") - מחכים שייסגרו.
const OTHER_OVERLAYS = '[class*="z-[110]"],[class*="z-[120]"],[class*="z-[130]"],[class*="z-[200]"],[class*="z-[210]"]';

type Stage = "idle" | "intro" | "spotlight";

function save(value: string) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // localStorage חסום - הסיור פשוט יופיע שוב בביקור הבא
  }
}

export default function ForumMoveTour() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [nudge, setNudge] = useState(0);

  useEffect(() => {
    let saved: string | null = "done";
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      // חסום - לא מציגים (עדיף מלהציג בכל טעינה)
    }
    if (saved === "done") return;
    const target = saved === "spotlight" ? "spotlight" : "intro";

    const timer = setInterval(() => {
      if (document.querySelector(OTHER_OVERLAYS)) return;
      clearInterval(timer);
      // אם כפתור הפורום מוסתר בהגדרות האתר - מדלגים ישר להסבר עם קישור ישיר
      setStage(target === "spotlight" && !document.getElementById("forum-button") ? "intro" : target);
    }, 900);
    return () => clearInterval(timer);
  }, []);

  const measure = useCallback(() => {
    const el = document.getElementById("forum-button");
    setRect(el ? el.getBoundingClientRect() : null);
  }, []);

  useEffect(() => {
    if (stage !== "spotlight") return;
    const el = document.getElementById("forum-button");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const poll = setInterval(measure, 250); // אנימציית הכניסה של HomeHero מזיזה את הכפתור
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      clearInterval(poll);
    };
  }, [stage, measure]);

  function showMe() {
    if (!document.getElementById("forum-button")) {
      goToForum();
      return;
    }
    save("spotlight");
    setStage("spotlight");
  }

  function goToForum() {
    save("done");
    setStage("idle");
    router.push(FORUM_URL);
  }

  function skip() {
    save("done");
    setStage("idle");
  }

  const pad = 8;

  return (
    <AnimatePresence>
      {stage === "intro" && (
        <motion.div
          key="intro"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          dir="rtl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gold/40 bg-bg shadow-2xl"
          >
            <div className="h-1.5 w-full bg-gradient-to-l from-gold via-primary to-gold" />
            <button
              onClick={skip}
              aria-label="סגירה"
              className="absolute left-3 top-3 rounded-lg p-1 text-gray-500 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-primary text-[#fff] shadow-glow">
                <MessagesSquare className="h-7 w-7" />
              </div>
              <p className="text-lg font-black text-white">השרשור עבר לכאן!</p>
              <p className="text-sm leading-relaxed text-gray-300">
                בעקבות נעילת השרשור המרכזי במתמחים טופ, הדיונים והעדכונים על עוגן פליי עברו לפורום כאן באתר.
                בואו נראה איפה הוא נמצא.
              </p>
              <button onClick={showMe} className="btn-primary mt-2 w-full justify-center">
                הראו לי
              </button>
              <button onClick={skip} className="text-xs font-semibold text-gray-500 hover:text-white">
                לא עכשיו
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {stage === "spotlight" && rect && (
        <motion.div key="spotlight" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[140]" dir="rtl">
          {/* שכבה שקופה שחוסמת לחיצות מחוץ לכפתור - לחיצה בחוץ רק "מנערת" את ההסבר */}
          <div className="absolute inset-0" onClick={() => setNudge((n) => n + 1)} />

          {/* ה"חור" בהחשכה - בדיוק מעל כפתור הפורום, והוא עצמו הקישור לפורום */}
          <button
            onClick={goToForum}
            aria-label="כניסה לפורום"
            className="absolute rounded-full"
            style={{
              top: rect.top - pad,
              left: rect.left - pad,
              width: rect.width + pad * 2,
              height: rect.height + pad * 2,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)"
            }}
          >
            <span className="absolute inset-0 animate-ping rounded-full border-4 border-gold/70" />
            <span className="absolute inset-0 rounded-full border-2 border-gold shadow-[0_0_30px_rgba(234,179,8,0.6)]" />
          </button>

          <div
            className="pointer-events-none absolute left-1/2 w-[min(92vw,340px)] -translate-x-1/2"
            style={rect.top > 190 ? { top: rect.top - pad - 150 } : { top: rect.bottom + pad + 18 }}
          >
            <motion.div
              key={nudge}
              animate={nudge ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }}
              transition={{ duration: 0.45 }}
              className="pointer-events-auto rounded-2xl border border-gold/50 bg-bg p-4 text-center shadow-2xl"
            >
              <p className="text-sm font-black text-white">{rect.top > 190 ? "👇" : "👆"} זה הכפתור של הפורום</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">לחצו עליו כדי לראות את כל השרשורים שעברו לכאן</p>
              <button onClick={skip} className="mt-2 text-[11px] font-semibold text-gray-500 hover:text-white">
                דלגו
              </button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
