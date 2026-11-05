-- ============================================================
-- עוגן פליי — קישורים קריאים לאפליקציות + צילומי מסך
-- slug = הכתובת בעמוד האפליקציה: /apps/com.myapp (שם חבילה, אם ידוע וייחודי)
--        או /apps/UserName/myapp (שם המעלה + שם האפליקציה).
-- package_name = שם החבילה של APK (נשלף מהקובץ בעת ההעלאה).
-- screenshot_keys = מפתחות צילומי המסך בדלי ה-assets.
-- אפליקציות קיימות מקבלות slug אוטומטית בביקור הראשון בעמוד שלהן (ובמפת האתר);
-- הקישורים הישנים עם ה-id ממשיכים לעבוד ומופנים לכתובת החדשה.
-- הקובץ idempotent - אפשר להריץ שוב בבטחה.
-- ============================================================

alter table public.apps add column if not exists package_name text;
alter table public.apps add column if not exists slug text;
alter table public.apps add column if not exists screenshot_keys text[] not null default '{}';

create unique index if not exists apps_slug_key on public.apps (slug) where slug is not null;
