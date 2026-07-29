-- ============================================================
-- עוגן פליי — קובץ APK בהצעת אפליקציה (במקום קישור), ותמונת פרופיל למשתמשים
-- הריצו את כל הקובץ הזה ב-Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

-- הצעת אפליקציה: במקום/בנוסף לקישור, המציע מעלה בעצמו את קובץ ה-APK
alter table public.app_suggestions add column if not exists file_key text;
alter table public.app_suggestions add column if not exists file_name text;
alter table public.app_suggestions add column if not exists file_size_bytes bigint;

-- תמונת פרופיל - לכל משתמש (רגיל/מפתח/מנהל)
alter table public.profiles add column if not exists avatar_key text;
