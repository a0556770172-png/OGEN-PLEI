-- דירוג בכוכבים + תגובות על אפליקציות, ולייקים (מוסיפים נקודה למפתח). ראה
-- lib/engagement-eligibility.ts לספי הפתיחה (לייק מ-15 אפליקציות שהועלו, תגובה מ-5).

create table if not exists public.app_reviews (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_id, user_id)
);
create index if not exists app_reviews_app_idx on public.app_reviews(app_id);

alter table public.app_reviews enable row level security;
drop policy if exists app_reviews_select_all on public.app_reviews;
create policy app_reviews_select_all on public.app_reviews for select using (true);

create table if not exists public.app_likes (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (app_id, user_id)
);
create index if not exists app_likes_app_idx on public.app_likes(app_id);

alter table public.app_likes enable row level security;
drop policy if exists app_likes_select_all on public.app_likes;
create policy app_likes_select_all on public.app_likes for select using (true);
