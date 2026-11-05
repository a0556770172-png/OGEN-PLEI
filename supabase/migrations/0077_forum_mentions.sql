-- ============================================================
-- עוגן פליי — פורום: הזכרות משתמשים (@שם)
-- forum_mentions: מי הוזכר בכל הודעה. הגישה רק דרך השרת (service role).
-- הקובץ idempotent - אפשר להריץ שוב בבטחה.
-- ============================================================

create table if not exists public.forum_mentions (
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists forum_mentions_user_idx on public.forum_mentions (user_id);
alter table public.forum_mentions enable row level security;
