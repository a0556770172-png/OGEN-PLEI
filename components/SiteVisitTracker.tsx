"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// רכיב שקוף לגמרי - יושב בעמוד השורש (layout) ומדווח צפייה בעמוד בכל ניווט, כולל ניווטים
// פנימיים בצד הלקוח (usePathname כתלות ב-useEffect, לא [] ריק) - כדי שהמונה ישקף בפועל
// "צפיות בעמוד" ולא רק "כניסות/סשנים" (שיטה קודמת שספרה רק טעינת layout מלאה, וכך פספסה
// את רוב התנועה האמיתית באתר - משתמש שגולש בין כמה עמודים בסשן אחד כמעט לא נספר).
export default function SiteVisitTracker() {
  const pathname = usePathname();
  useEffect(() => {
    fetch("/api/site/visit", { method: "POST" }).catch(() => {});
  }, [pathname]);
  return null;
}
