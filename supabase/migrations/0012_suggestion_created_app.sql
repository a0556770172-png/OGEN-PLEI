-- מקשר בין הצעת אפליקציה לבין האפליקציה שנוצרה ממנה בפועל בעת האישור (אם נוצרה).
-- זה גם מונע יצירה כפולה של אפליקציה אם מישהו ילחץ "אישור" פעמיים בטעות.
alter table public.app_suggestions add column if not exists created_app_id uuid references public.apps(id) on delete set null;
