-- ============================================================
-- עוגן פליי — לייקים על ביקורות האתר
-- ============================================================
create table if not exists public.site_review_likes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.site_reviews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (review_id, user_id)
);

create index if not exists site_review_likes_review_idx on public.site_review_likes(review_id);

alter table public.site_review_likes enable row level security;
drop policy if exists site_review_likes_select_all on public.site_review_likes;
create policy site_review_likes_select_all on public.site_review_likes for select using (true);
