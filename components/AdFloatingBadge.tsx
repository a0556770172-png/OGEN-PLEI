"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Tag } from "lucide-react";

// באדג' צף קבוע (פינה ימנית-תחתונה, מול העוזר/הודעות שיושבים משמאל) שמפרסם את הפרסומת
// החיצונית לכולם, כל הזמן, בלי שום הגבלה - להבדיל מפרסומת הביניים בהורדה (ראו DownloadButton).
export default function AdFloatingBadge() {
  const [cfg, setCfg] = useState<{ enabled: boolean; imageUrl: string | null; linkUrl: string } | null>(null);

  useEffect(() => {
    fetch("/api/ads/config")
      .then((r) => r.json())
      .then((json) => setCfg({ enabled: !!json.floatingEnabled, imageUrl: json.imageUrl ?? null, linkUrl: json.linkUrl }))
      .catch(() => {});
  }, []);

  if (!cfg || !cfg.enabled) return null;

  function handleClick() {
    fetch("/api/ads/click", { method: "POST" }).catch(() => {});
  }

  return (
    <motion.a
      href={cfg.linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-gold/40 bg-bg/95 py-2 pl-4 pr-2 shadow-glow backdrop-blur-xl"
      dir="rtl"
    >
      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-gold/25" style={{ animationDuration: "3s" }} />
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-gold to-primary text-[#111]">
        {cfg.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cfg.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Tag className="h-4 w-4" />
        )}
      </span>
      <span className="text-xs font-bold text-white">5% הנחה - לחצו כאן</span>
    </motion.a>
  );
}
