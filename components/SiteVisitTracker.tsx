"use client";
import { useEffect } from "react";

// רכיב שקוף לגמרי - יושב בעמוד השורש (layout) ומדווח כניסה חדשה לאתר פעם אחת בכל טעינה
// מלאה (לא בכל ניווט פנימי, כי layout לא נטען מחדש בניווט רגיל של Next.js) - כך שהמונה
// משקף בערך "כניסות לאתר" ולא "צפיות בעמוד".
export default function SiteVisitTracker() {
  useEffect(() => {
    fetch("/api/site/visit", { method: "POST" }).catch(() => {});
  }, []);
  return null;
}
