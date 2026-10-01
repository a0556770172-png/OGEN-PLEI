-- ============================================================
-- עוגן פליי — תגובות בבקשות קהילה + תגובת מפתח לביקורות על האפליקציה שלו
--  1. community_request_comments: משתמשים מגיבים בבקשת קהילה, וגם עונים לתגובה של משתמש אחר
--     (parent_id = התגובה שעליה עונים). המבקש ומי שקיבל תשובה מקבלים התראה בפעמון.
--  2. app_reviews.developer_reply: בעל האפליקציה עונה לתגובה/דירוג שנכתבו על האפליקציה שלו.
-- הקובץ idempotent - אפשר להריץ שוב בבטחה.
-- ============================================================

create table if not exists public.community_request_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.community_requests(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.community_request_comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists community_request_comments_request_idx
  on public.community_request_comments (request_id, created_at);

alter table public.community_request_comments enable row level security;
-- קריאה: כמו לוח הבקשות עצמו - ציבורי. כתיבה ומחיקה עוברות דרך ה-API בשרת.
drop policy if exists community_request_comments_select_all on public.community_request_comments;
create policy community_request_comments_select_all on public.community_request_comments for select using (true);

alter table public.app_reviews add column if not exists developer_reply text;
alter table public.app_reviews add column if not exists developer_reply_at timestamptz;
