"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpCircle, X } from "lucide-react";
import type { AppUpdateInfo } from "@/lib/updates";

// פיצ'ר 5: חלונית שקופצת בכניסה לאתר ומיידעת את המשתמש על עדכוני גרסה לאפליקציות שהוא
// כבר הוריד. מוצגת פעם אחת לכל "סשן" גלישה (sessionStorage) כדי לא להטריד בכל ניווט.
export default function UpdatesPopup({ updates }: { updates: AppUpdateInfo[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!updates.length) return;
    try {
      // מפתח ייחודי לפי רשימת האפליקציות המעודכנות - אם עלה עדכון חדש נוסף, החלונית תופיע שוב.
      const key = "ogen-updates-seen:" + updates.map((u) => `${u.appId}@${u.currentVersion}`).sort().join(",");
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // אם sessionStorage חסום - פשוט נציג את החלונית (לא קריטי)
    }
    setOpen(true);
  }, [updates]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          dir="rtl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="card relative w-full max-w-md p-6"
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="סגירה"
              className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface text-gray-400 transition hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <ArrowUpCircle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">עדכונים זמינים</h2>
                <p className="text-xs text-gray-500">{updates.length} מהאפליקציות שהורדת קיבלו גרסה חדשה</p>
              </div>
            </div>

            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
              {updates.map((u) => (
                <Link
                  key={u.appId}
                  href={`/apps/${u.appId}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface2/60 px-4 py-3 transition hover:border-accent/40"
                >
                  <span className="min-w-0 flex-1 truncate font-bold text-white">{u.name}</span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {u.downloadedVersion} <span className="text-gray-600">→</span> <span className="text-accent">{u.currentVersion}</span>
                  </span>
                </Link>
              ))}
            </div>

            <button onClick={() => setOpen(false)} className="btn-ghost mt-4 w-full text-sm">
              הבנתי, תודה
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
