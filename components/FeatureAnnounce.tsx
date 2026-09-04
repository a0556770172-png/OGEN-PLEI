"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Star, X, ArrowLeft, PartyPopper } from "lucide-react";

// הודעה חד-פעמית על פיצ'ר חדש. לשינוי גרסה (הודעה חדשה) - להעלות את המספר במפתח.
const KEY = "ogen-announce-ratings-v1";

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
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-gold/40 bg-bg shadow-2xl"
          >
            <div className="h-1.5 w-full bg-gradient-to-l from-gold via-primary to-gold" />
            <button
              onClick={dismiss}
              aria-label="סגירה"
              className="absolute left-3 top-3 rounded-lg p-1 text-gray-500 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-primary text-[#fff] shadow-glow">
                <PartyPopper className="h-7 w-7" />
              </div>
              <div>
                <p className="flex items-center justify-center gap-1.5 text-lg font-black text-white">
                  <Star className="h-4 w-4 fill-gold text-gold" /> חדש בעוגן פליי
                </p>
                <p className="mt-1.5 text-sm text-gray-300">
                  עכשיו אפשר <b className="text-gold">לדרג את האתר ולכתוב חוות דעת</b> — ולהשפיע על מה שיהיה כאן. ספרו לכולם מה אתם חושבים!
                </p>
              </div>
              <div className="mt-1 flex w-full flex-col gap-2">
                <Link
                  href="/site-reviews"
                  onClick={dismiss}
                  className="btn-primary w-full justify-center bg-gold text-[#111] hover:bg-gold/90"
                >
                  <Star className="h-4 w-4" /> לדירוגים ולחוות הדעת <ArrowLeft className="h-4 w-4" />
                </Link>
                <button onClick={dismiss} className="text-xs font-semibold text-gray-500 hover:text-white">
                  אחר כך
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
