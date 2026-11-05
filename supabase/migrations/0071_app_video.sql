-- ============================================================
-- עוגן פליי — סרטון הסבר לאפליקציה
-- apps.video_key: סרטון הסבר (בדלי ה-assets) שמתנגן אוטומטית ב"איך זה נראה?".
-- app_suggestions.video_key: סרטון שהמציע צירף להצעה ציבורית (עובר לאפליקציה באישור).
-- הקובץ idempotent - אפשר להריץ שוב בבטחה.
-- ============================================================

alter table public.apps add column if not exists video_key text;
alter table public.app_suggestions add column if not exists video_key text;
