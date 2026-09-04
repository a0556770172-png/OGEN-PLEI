"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Star, X, ArrowLeft, PartyPopper, Bot, Gift, BellRing } from "lucide-react";

// הודעה חד-פעמית על פיצ'רים חדשים. לשינוי (הודעה חדשה שתוצג שוב לכולם) - להעלות את המספר במפתח.
const KEY = "ogen-announce-features-v2";

const FEATURES = [
  {
    href: "/site-reviews",
    icon: Star,
    title: "דירוג האתר וחוות דעת",
    desc: "דרגו את עוגן פליי בכוכבים וכתבו מה אתם חושבים — זה מתפרסם לכולם.",
    tint: "from-gold to-primary"
  },
  {
    href: "/assistant",
    icon: Bot,
    title: "סוכן AI חכם",
    desc: "עוזר חכם שמכיר את כל האתר — שאלו אותו כל דבר, והוא גם ימצא לכם אפליקציות ויעזור להעלות.",
    tint: "from-primary to-primary-light"
  },
  {
    href: "/profile#referrals",
    icon: Gift,
    title: "הזמינו חברים",
    desc: "שלחו קישור אישי לחברים — כשהם נרשמים, אתם מקבלים מוניטין ומקום העלאה נוסף.",
    tint: "from-emerald-500 to-teal-400"
  },
  {
    href: "/profile#notifications",
    icon: BellRing,
    title: "הרשמה לעדכונים והתראות",
    desc: "קבלו התראה על אפליקציות חדשות, גרסאות חדשות, בקשות קהילה ועוד — ישירות באתר.",
    tint: "from-sky-500 to-indigo-400"
  }
];

export default function FeatureAnnounce() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let seen = true;
    try {
      seen = localStorage.getItem(KEY) === "1";
    } catch {
      // localStorage חסום - לא נציג (עדיף מלהציג בכל טעינה)
    }
    if (!seen) {
      const t = setTimeout(() => setShow(true), 700);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismiss}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          dir="rtl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] w-full max-w-md overflow-hidden rounded-2xl border border-gold/40 bg-bg shadow-2xl"
          >
            <div className="h-1.5 w-full bg-gradient-to-l from-gold via-primary to-gold" />
            <button
              onClick={dismiss}
              aria-label="סגירה"
              className="absolute left-3 top-3 rounded-lg p-1 text-gray-500 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col gap-4 overflow-y-auto p-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-primary text-[#fff] shadow-glow">
                  <PartyPopper className="h-7 w-7" />
                </div>
                <p className="flex items-center justify-center gap-1.5 text-lg font-black text-white">
                  <Star className="h-4 w-4 fill-gold text-gold" /> חדש בעוגן פליי
                </p>
                <p className="text-sm text-gray-300">כמה דברים חדשים שכדאי להכיר:</p>
              </div>

              <div className="flex flex-col gap-2">
                {FEATURES.map((f, i) => (
                  <motion.div
                    key={f.href}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.12 + i * 0.07 }}
                  >
                    <Link
                      href={f.href}
                      onClick={dismiss}
                      className="group flex items-start gap-3 rounded-xl border border-border bg-surface2 p-3 transition hover:border-primary/40 hover:bg-surface"
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${f.tint} text-[#fff]`}>
                        <f.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="flex items-center gap-1 text-sm font-bold text-white">
                          {f.title}
                          <ArrowLeft className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-gray-400">{f.desc}</p>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>

              <button onClick={dismiss} className="text-xs font-semibold text-gray-500 hover:text-white">
                אחר כך
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
