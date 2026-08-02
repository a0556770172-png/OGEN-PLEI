-- מונה כניסות כללי לאתר (נספר בכל טעינת עמוד שורש חדשה, ראה components/SiteVisitTracker.tsx),
-- מוצג בדף הבית לצד כמות משתמשים/אפליקציות/הורדות.
create table if not exists public.site_stats (
  id smallint primary key default 1,
  total_visits bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint site_stats_singleton check (id = 1)
);
insert into public.site_stats (id, total_visits) values (1, 0) on conflict (id) do nothing;

alter table public.site_stats enable row level security;
drop policy if exists site_stats_select_public on public.site_stats;
create policy site_stats_select_public on public.site_stats for select using (true);

-- פונקציה אטומית להגדלת המונה - נקראת דרך admin client מ-API בלבד, כדי למנוע דריסת ספירה
-- מקבילה (race condition) שהייתה קורית עם select+update רגיל.
create or replace function public.increment_site_visits()
returns void
language sql
security definer
as $$
  update public.site_stats set total_visits = total_visits + 1, updated_at = now() where id = 1;
$$;
