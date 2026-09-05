-- חסימת כתיבה בפורום (צוות מנהל/פיקוח) + חסימת בוט אוטומטית בזיהוי ניסיון מניפולציה.
alter table public.profiles add column if not exists forum_banned boolean not null default false;
alter table public.profiles add column if not exists forum_ban_reason text;
-- כשהבוט מזהה ניסיון להוליך אותו לשיחה לא לגיטימית - המשתמש נחסם מהבוט לשעה.
alter table public.profiles add column if not exists bot_blocked_until timestamptz;
