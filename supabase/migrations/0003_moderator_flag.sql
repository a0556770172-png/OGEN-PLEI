-- ============================================================
-- עוגן פליי — תיקון: פיקוח כתפקיד נוסף (דגל) ולא כתחליף לתפקיד הבסיסי
-- באג שתוקן: מינוי מפתח לצוות פיקוח היה דורס את role ל-'moderator' וכך "מוחק" את
-- מעמד המפתח שלו (איבוד גישה לאזור המפתח ולאפליקציות שהעלה). מעכשיו פיקוח הוא
-- דגל בוליאני נפרד (is_moderator) שמתווסף על גבי התפקיד הבסיסי (user/developer/admin),
-- ולא מחליף אותו.
-- הריצו את כל הקובץ הזה ב-Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

alter table public.profiles add column if not exists is_moderator boolean not null default false;

-- תיקון נתונים קיימים: מי שהיה role='moderator' מקבל את הדגל, והתפקיד הבסיסי שלו
-- משוחזר בהתאם לכך שיש לו אפליקציות (היה כנראה מפתח) או לא (משתמש רגיל).
update public.profiles
set is_moderator = true,
    role = case
      when exists (select 1 from public.apps a where a.developer_id = profiles.id) then 'developer'
      else 'user'
    end
where role = 'moderator';
