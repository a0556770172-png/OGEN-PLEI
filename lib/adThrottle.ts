"use client";

// מגביל את הצגת "הפרסומת" (AdInterstitial) לפני הורדה - עד MAX_PER_DAY פעמים ביום
// לכל דפדפן (localStorage), כדי לא להטריד יותר מדי משתמשים שמורידים הרבה.
const KEY = "ogen-ad-count";
const MAX_PER_DAY = 3;

// קוראים והולכים - מחזיר true אם מותר להציג הפעם, ומיד סופר אותה (side effect מכוון:
// כל בדיקה = ניסיון הצגה בפועל, אין קריאה "בחינם").
export function shouldShowAd(): boolean {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const count = parsed && parsed.date === today ? Number(parsed.count) || 0 : 0;
    if (count >= MAX_PER_DAY) return false;
    localStorage.setItem(KEY, JSON.stringify({ date: today, count: count + 1 }));
    return true;
  } catch {
    // localStorage חסום - אין דרך לספור, אז מציגים (עדיף מהיתקעות)
    return true;
  }
}
