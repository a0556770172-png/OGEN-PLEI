-- הרשאת גודל חד-פעמית: מנהל יכול לאשר למשתמש ספציפי להעלות אפליקציה/תוכנה אחת בגודל
-- חריג (מעבר למכסה הרגילה שלו - 30MB בחשבון רגיל, 100MB ב-PRO). ההרשאה מתבטלת אוטומטית
-- ברגע שנוצלה בפועל (ראה app/api/apps/finalize/route.ts).
alter table public.profiles add column if not exists size_override_mb integer;
