"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Play, X } from "lucide-react";

// הודעון קטן וחד-פעמי על הסרטון החדש בפורום. לשינוי (סרטון חדש שיוצג שוב לכולם) - להעלות את המספר במפתח.
const KEY = "ogen-announce-video-v1";
const POST_ID = "388e7dd3-9d8e-4e7f-93f0-08284ffafd8f";
const HREF = `/forum/${POST_ID}`;
const POSTER = "/api/cdn/forum/ogen-play-update-poster.png";

export default function VideoAnnounce() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // לא מציגים בעמוד הסרטון עצמו, ולא בדפי ניהול
    if (!pathname || pathname.startsWith(`/forum/${POST_ID}`) || pathname.startsWith("/dashboard")) return;
    let seen = true;
    try {
      seen = localStorage.getItem(KEY) === "1";
    } catch {
      // localStorage חסום - לא נציג (עדיף מלהציג בכל טעינה)
    }
    if (seen) return;
    const t = setTimeout(() => {
      setShow(true);
      // נספר כ"נראה" כבר בהצגה, כדי שיופיע פעם אחת בלבד גם אם התעלמו ממנו
      try {
        localStorage.setItem(KEY, "1");
      } catch {
        // ignore
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), 14000);
    return () => clearTimeout(t);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          dir="rtl"
          className="fixed inset-x-3 bottom-4 z-[110] mx-auto w-auto max-w-sm"
        >
          <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-bg shadow-2xl">
            <div className="h-1 w-full bg-gradient-to-l from-gold via-primary to-gold" />
            <button
              onClick={() => setShow(false)}
              aria-label="סגירה"
              className="absolute left-2 top-3 rounded-lg p-1 text-gray-500 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <Link href={HREF} onClick={() => setShow(false)} className="flex items-center gap-3 p-3 pe-4">
              <span className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={POSTER} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/90 text-white">
                    <Play className="h-4 w-4" fill="currentColor" />
                  </span>
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-white">יש סרטון חדש בפורום!</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-gray-400">
                  כל השיפורים החדשים באתר, בהקלטה אמיתית. לחצו לצפייה.
                </span>
              </span>
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
