-- ============================================================
-- עוגן פליי — קבצים מצורפים בוועדה (כל סוג קובץ, כולל ZIP)
-- אותו מבנה בדיוק כמו בהודעות הפניות (0016_ticket_attachments): הקובץ עצמו נשמר בדלי
-- ה-uploads ב-R2, וכאן רק המפתח, השם המקורי וסוג הקובץ. הורדה דרך קישור חתום זמני
-- (app/api/tickets/attachment-url), רק לצוות.
-- הקובץ idempotent - אפשר להריץ שוב בבטחה.
-- ============================================================

alter table public.council_messages add column if not exists attachment_key text;
alter table public.council_messages add column if not exists attachment_name text;
alter table public.council_messages add column if not exists attachment_type text;
