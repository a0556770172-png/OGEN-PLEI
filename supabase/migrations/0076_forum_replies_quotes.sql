-- ============================================================
-- עוגן פליי — פורום: תגובה לתגובה ספציפית, וסימון "נערך"
-- reply_to_id: התגובה הזו עונה לתגובה מסוימת בדיון (לא רק לפוסט הראשי)
-- edited_at: מתי הכותב ערך את הטקסט (הסתרה/נעיצה של הצוות לא נחשבות עריכה)
-- הקובץ idempotent - אפשר להריץ שוב בבטחה.
-- ============================================================

alter table public.forum_posts add column if not exists reply_to_id uuid references public.forum_posts(id) on delete set null;
alter table public.forum_posts add column if not exists edited_at timestamptz;
create index if not exists forum_posts_reply_to_idx on public.forum_posts (reply_to_id) where reply_to_id is not null;
