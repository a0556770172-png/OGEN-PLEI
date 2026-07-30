-- ============================================================
-- הרחבת מערכת הפניות/הודעות: קבצים מצורפים (תמונה/וידאו/הקלטת קול) בהודעה,
-- ופנייה שנפתחת ביוזמת הצוות (לא רק ע"י המשתמש) - "הודעות" איחדה את הפניות והתמיכה.
-- הריצו את כל הקובץ הזה ב-Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

alter table public.ticket_messages add column if not exists attachment_key text;
alter table public.ticket_messages add column if not exists attachment_name text;
alter table public.ticket_messages add column if not exists attachment_type text;

-- מסמן פנייה/שיחה שהצוות יזם (ולא המשתמש) - כדי להציג זאת נכון בממשק המשתמש.
alter table public.tickets add column if not exists started_by_staff boolean not null default false;
