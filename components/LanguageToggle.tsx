"use client";
import { useEffect, useState } from "react";
import { Languages } from "lucide-react";

// כפתור קטן להחלפת שפת האתר בין עברית לאנגלית. הבחירה נשמרת ב-localStorage (בשביל הסקריפט
// החוסם ב-app/layout.tsx שקובע כיוון LTR לפני הרינדור) וגם בעוגייה (בשביל השרת - למשל הבוט
// עונה באנגלית). אחרי ההחלפה הדף נטען מחדש, והתרגום עצמו מתבצע ע"י SiteTranslator.
export default function LanguageToggle({ className = "" }: { className?: string }) {
  const [isEnglish, setIsEnglish] = useState(false);

  useEffect(() => {
    setIsEnglish(document.documentElement.lang === "en");
  }, []);

  function toggle() {
    const next = isEnglish ? "he" : "en";
    try {
      localStorage.setItem("ogen-lang", next);
    } catch {
      // localStorage חסום - העוגייה עדיין תשמור את הבחירה לביקור הזה
    }
    document.cookie = `ogen-lang=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }

  return (
    <button
      onClick={toggle}
      data-no-translate
      aria-label={isEnglish ? "עברית" : "English"}
      title={isEnglish ? "עברית" : "English"}
      className={`flex h-9 shrink-0 items-center justify-center gap-1 rounded-xl border border-border bg-surface px-2 text-xs font-bold text-gray-300 transition hover:border-primary/50 hover:text-white ${className}`}
    >
      <Languages className="h-4 w-4" />
      {isEnglish ? "עב" : "EN"}
    </button>
  );
}
