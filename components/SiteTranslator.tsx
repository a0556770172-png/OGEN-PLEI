"use client";
import { useEffect } from "react";

// מפעיל את התרגום לאנגלית כשהמשתמש בחר בו (ראו LanguageToggle). המילון נטען בטעינה דינמית
// רק במצב אנגלית, כך שגולשים בעברית לא מורידים אותו בכלל.
export default function SiteTranslator() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.lang !== "en") return;

    let stop: (() => void) | undefined;
    let cancelled = false;
    Promise.all([import("@/lib/i18n/translator"), import("@/lib/i18n/en.json")])
      .then(([mod, dict]) => {
        if (cancelled) return;
        stop = mod.startDomTranslation((dict as any).default ?? dict);
      })
      .catch(() => {})
      .finally(() => root.classList.remove("i18n-pending"));

    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return null;
}
