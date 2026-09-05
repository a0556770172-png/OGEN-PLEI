"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, X, ArrowLeft } from "lucide-react";

const SESSION_KEY = "ogen-notif-peek-shown";

type FeedItem = { id: string; title: string; created_at: string };

// "חמוד קטן" שמופיע בכניסה לאתר אם יש התראות שלא נראו - עוקב אחרי מפתח/אפליקציה/
// פוסט/דיון וכו'. פעם אחת לכל session, ונעלם לבד אחרי כמה שניות.
export default function NewNotificationsPeek() {
  const pathname = usePathname();
  const [data, setData] = useState<{ count: number; latest: string | null } | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (pathname.startsWith("/notifications")) return;
    let shown = true;
    try {
      shown = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      // אין sessionStorage - עדיף לא להציג בכל ניווט
    }
    if (shown) return;

    let active = true;
    const t = setTimeout(() => {
      fetch("/api/notifications/feed")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!active || !j || (j.unread ?? 0) < 1) return;
          const items: FeedItem[] = j.items ?? [];
          setData({ count: j.unread, latest: items[0]?.title ?? null });
          setShow(true);
          try {
            sessionStorage.setItem(SESSION_KEY, "1");
          } catch {
            // ignore
          }
        })
        .catch(() => {});
    }, 1800);

    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [pathname]);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), 9000);
    return () => clearTimeout(t);
  }, [show]);

  return (
    <AnimatePresence>
      {show && data && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
          className="fixed bottom-6 right-4 z-[115] w-[calc(100vw-2rem)] max-w-[300px] overflow-hidden rounded-2xl border border-primary/40 bg-bg/95 shadow-2xl backdrop-blur-xl sm:right-6"
          dir="rtl"
        >
          <div className="h-1 w-full bg-gradient-to-l from-primary via-accent to-primary" />
          <div className="flex items-start gap-3 p-3.5">
            <motion.div
              animate={{ rotate: [0, -14, 12, -8, 0] }}
              transition={{ duration: 0.9, delay: 0.3 }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-[#fff]"
            >
              <Bell className="h-4 w-4" />
            </motion.div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-white">
                יש לך {data.count.toLocaleString("he-IL")} {data.count === 1 ? "עדכון חדש" : "עדכונים חדשים"} 🔔
              </p>
              {data.latest && <p className="mt-0.5 truncate text-xs text-gray-400">{data.latest}</p>}
              <Link
                href="/notifications"
                onClick={() => setShow(false)}
                className="mt-2 inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-[#fff] transition hover:bg-primary-light"
              >
                צפייה בכל ההתראות <ArrowLeft className="h-3.5 w-3.5" />
              </Link>
            </div>
            <button
              onClick={() => setShow(false)}
              aria-label="סגירה"
              className="shrink-0 rounded-lg p-1 text-gray-500 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
