"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import AdImage from "./AdImage";
import type { AdAnimation } from "@/lib/adAnimation";

export interface AdInterstitialConfig {
  imageUrl: string | null;
  animation?: AdAnimation | null;
  linkUrl: string;
  skipAfterSeconds: number;
}

// פרסומת ביניים לפני הורדה בפועל: מוצגת תמיד, לא ניתנת לסגירה עד שחולף skipAfterSeconds
// (ואז מופיע כפתור דילוג). אם המשתמש עוזב את הדף לפני שהוא מדלג - ההורדה עצמה (actuallyDownload,
// שנקרא רק מתוך onDone) פשוט לא מתחילה מעולם, בלי צורך בטיפול מיוחד.
export default function AdInterstitial({ config, onDone }: { config: AdInterstitialConfig; onDone: () => void }) {
  const [canSkip, setCanSkip] = useState(config.skipAfterSeconds <= 0);

  useEffect(() => {
    if (config.skipAfterSeconds <= 0) return;
    const t = setTimeout(() => setCanSkip(true), config.skipAfterSeconds * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleImageClick() {
    fetch("/api/ads/click", { method: "POST" }).catch(() => {});
    window.open(config.linkUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-gold/40 bg-bg shadow-2xl"
      >
        <div className="h-1.5 w-full bg-gradient-to-l from-gold via-primary to-gold" />
        <div className="flex flex-col items-center gap-3 p-4">
          {config.imageUrl ? (
            <button onClick={handleImageClick} className="block w-full overflow-hidden rounded-xl">
              <AdImage src={config.imageUrl} animation={config.animation} alt="פרסומת" className="w-full object-cover" />
            </button>
          ) : (
            <p className="p-6 text-center text-sm text-gray-400">ההורדה שלך מתחילה בעוד רגע…</p>
          )}

          {canSkip ? (
            <button onClick={onDone} className="btn-primary w-full justify-center">
              המשך להורדה <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <p className="text-xs text-gray-500">אפשר יהיה לדלג בעוד רגע…</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
