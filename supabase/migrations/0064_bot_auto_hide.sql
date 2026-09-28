-- ============================================================
-- עוגן פליי — הסתרה אוטומטית של הבוט כשכל המפתחות/המודלים לא עובדים
-- אחרי 2 כישלונות ברצף (כל המפתחות נכשלו) הבוט מוסתר לכולם כאילו אינו קיים, והשרת בודק
-- ברקע כל כמה דקות אם מפתח/מודל חזר לעבוד - ואם כן, מחזיר אותו אוטומטית (ראו lib/botHealth.ts).
-- הקובץ idempotent - אפשר להריץ שוב בבטחה.
-- ============================================================

alter table public.bot_config add column if not exists auto_hidden boolean not null default false;
alter table public.bot_config add column if not exists auto_hidden_at timestamptz;
alter table public.bot_config add column if not exists fail_streak integer not null default 0;
alter table public.bot_config add column if not exists health_checked_at timestamptz;
