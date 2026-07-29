-- ============================================================
-- עוגן פליי — האתר מיועד גם לתוכנות מחשב, לא רק אפליקציות מובייל
-- מוסיף קטגוריית "תוכנות" (אם עוד לא קיימת) - אותו מסלול בדיוק כמו אפליקציות
-- הריצו את כל הקובץ הזה ב-Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

insert into public.categories (value, label, sort_order)
select 'software', 'תוכנות', coalesce((select max(sort_order) + 1 from public.categories), 0)
where not exists (select 1 from public.categories where value = 'software');
