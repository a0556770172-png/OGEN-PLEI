-- ============================================================
-- עוגן פליי — השהיית הורדה זמנית לאפליקציה ע"י המפתח עצמו
-- חשבון רגיל: עד 3 ימים. חשבון PRO: גם ללא הגבלת זמן (download_paused = true, בלי תאריך סיום).
-- הריצו את כל הקובץ הזה ב-Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

alter table public.apps add column if not exists download_paused boolean not null default false;
alter table public.apps add column if not exists download_paused_until timestamptz;
