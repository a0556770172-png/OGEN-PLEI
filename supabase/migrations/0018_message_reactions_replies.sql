-- ============================================================
-- העשרת הודעות בכל הצ'אטים (הודעות/תמיכה וגם ועדה): תגובות אימוג'י, ציטוט/הגבה
-- להודעה ספציפית, עריכה ומחיקה (רכה - נשמר רישום שהודעה נמחקה/נערכה, לא נמחקת פיזית
-- כדי לא לשבור שרשראות ציטוט/הגבה של הודעות אחרות שמצביעות אליה). "העתקת קישור" ו"הדגשת
-- כתב" הם פיצ'רים בצד הלקוח בלבד ולא דורשים שינוי במסד הנתונים.
-- ============================================================

alter table public.ticket_messages add column if not exists reply_to_id uuid references public.ticket_messages(id) on delete set null;
alter table public.ticket_messages add column if not exists reactions jsonb not null default '{}'::jsonb;
alter table public.ticket_messages add column if not exists edited_at timestamptz;
alter table public.ticket_messages add column if not exists deleted_at timestamptz;

alter table public.council_messages add column if not exists reply_to_id uuid references public.council_messages(id) on delete set null;
alter table public.council_messages add column if not exists reactions jsonb not null default '{}'::jsonb;
alter table public.council_messages add column if not exists edited_at timestamptz;
alter table public.council_messages add column if not exists deleted_at timestamptz;
