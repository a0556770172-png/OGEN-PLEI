"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

// באדג' צף קבוע (פינה ימנית-תחתונה, מול העוזר/הודעות שיושבים משמאל) שמפרסם את הפרסומת
// החיצונית לכולם, כל הזמן, בלי שום הגבלה - להבדיל מפרסומת הביניים בהורדה (ראו DownloadButton).
// בלי תמונה: בעיגול הקטן של הבאדג' כל תמונה נחתכת (object-cover) ולא ניתנת לזיהוי,
// אז במקום זה מוצג כאן טקסט קבוע "חדר בריחה".
export default function AdFloatingBadge() {
  const [cfg, setCfg] = useState<{ enabled: boolean; linkUrl: string } | null>(null);

  useEffect(() => {
    fetch("/api/ads/config")
      .then((r) => r.json())
      .then((json) => setCfg({ enabled: !!json.floatingEnabled, linkUrl: json.linkUrl }))
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
      <span className="flex h-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold to-primary px-3 text-xs font-extrabold text-[#111]">
        חדר בריחה
      </span>
      <span className="text-xs font-bold text-white">5% הנחה - לחצו כאן</span>
    </motion.a>
  );
}
