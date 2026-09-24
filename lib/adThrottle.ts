"use client";

// מגביל את הצגת פרסומת ההורדה לחברי צוות/מנהל בלבד - עד limit פעמים ביום לכל דפדפן
// (localStorage), כדי לא להטריד מי שמוריד הרבה לצורך בדיקה/פיקוח. למשתמש רגיל אין הגבלה
// בכלל (ראו components/DownloadButton.tsx) - זו בדיוק ההפרדה שהתבקשה.
const KEY = "ogen-ad-staff-count";

// קוראים והולכים - מחזיר true אם מותר להציג הפעם, ומיד סופר אותה (side effect מכוון).
export function shouldShowStaffAd(limit: number): boolean {
  if (limit <= 0) return false;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const count = parsed && parsed.date === today ? Number(parsed.count) || 0 : 0;
    if (count >= limit) return false;
    localStorage.setItem(KEY, JSON.stringify({ date: today, count: count + 1 }));
    return true;
  } catch {
    // localStorage חסום - אין דרך לספור, אז מציגים (עדיף מהיתקעות)
    return true;
  }
}
