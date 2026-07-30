"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

// שולט במעבר בין מצב כהה (ברירת המחדל) למצב בהיר, ע"י הוספה/הסרה של class בשם "light"
// על ה-html, ושמירת הבחירה ב-localStorage כדי שתישמר גם בין ביקורים. תיקון מקדים (בלי הבהוב)
// מתבצע ע"י סקריפט חוסם קטן שרץ ב-app/layout.tsx לפני הרינדור הראשון.
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setIsLight(document.documentElement.classList.contains("light"));
  }, []);

  function toggle() {
    const next = !isLight;
    setIsLight(next);
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("ogen-theme", next ? "light" : "dark");
    } catch {
      // אם localStorage חסום (מצב פרטי וכו') - לא קריטי, המצב פשוט לא יישמר בין ביקורים
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={isLight ? "מעבר למצב כהה" : "מעבר למצב בהיר"}
      title={isLight ? "מעבר למצב כהה" : "מעבר למצב בהיר"}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-gray-300 transition hover:border-primary/50 hover:text-white ${className}`}
    >
      {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
