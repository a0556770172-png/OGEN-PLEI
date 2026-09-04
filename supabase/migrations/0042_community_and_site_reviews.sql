-- ============================================================
-- עוגן פליי —
--   1. התראות על בקשת קהילה חדשה (סוג מנוי 'community')
--   2. +20 מוניטין למי שממלא בקשת קהילה (נפרד ממוניטין ההעלאה הרגיל)
--   3. ביקורות ודירוגים על האתר (כמו בגוגל פליי)
-- ============================================================

-- 1 - מרחיב את סוגי המנויים
alter table public.notification_subscriptions drop constraint if exists notification_subscriptions_type_check;
alter table public.notification_subscriptions
  add constraint notification_subscriptions_type_check
  check (type in ('developer','category','new_public','all_new','app','community'));

-- 2 - דגל תשלום מוניטין על מילוי בקשת קהילה (מונע כפל)
alter table public.community_requests add column if not exists points_awarded boolean not null default false;

-- 3 - ביקורות על האתר
create table if not exists public.site_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_reviews_created_idx on public.site_reviews(created_at desc);

alter table public.site_reviews enable row level security;
-- קריאה ציבורית (מוצג לכולם ברשימה); כתיבה עוברת דרך ה-API בשרת.
drop policy if exists site_reviews_select_all on public.site_reviews;
create policy site_reviews_select_all on public.site_reviews for select using (not hidden);
