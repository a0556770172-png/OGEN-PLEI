-- מרכז אבטחה בזמן אמת: אירועי תקיפה, פרופילי תוקפים, מדדי תנועה, חסימות והגדרות.
-- הגישה לכל הטבלאות רק דרך service_role (ה-API של האדמין ושירות ה-sentinel בשרת).
-- RLS פעיל ובכוונה אין מדיניות - אף משתמש אתר (גם מחובר / גם אדמין בדפדפן) לא יכול לקרוא או לכתוב ישירות.
-- המיגרציה אידמפוטנטית (אפשר להריץ שוב ושוב).

create table if not exists public.security_events (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  ip text not null,
  type text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  path text,
  method text,
  status int,
  ua text,
  details jsonb not null default '{}'::jsonb,
  count int not null default 1,
  blocked boolean not null default false
);
create index if not exists security_events_ts_idx on public.security_events (ts desc);
create index if not exists security_events_ip_ts_idx on public.security_events (ip, ts desc);
create index if not exists security_events_type_ts_idx on public.security_events (type, ts desc);
create index if not exists security_events_sev_ts_idx on public.security_events (ts desc) where severity in ('high', 'critical');

create table if not exists public.security_attackers (
  ip text primary key,
  first_seen timestamptz not null,
  last_seen timestamptz not null,
  hits int not null default 0,
  score numeric not null default 0,
  attack_types text[] not null default '{}',
  type_counts jsonb not null default '{}'::jsonb,
  profile jsonb not null default '{}'::jsonb,
  blocked_until timestamptz,
  block_count int not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists security_attackers_last_seen_idx on public.security_attackers (last_seen desc);
create index if not exists security_attackers_score_idx on public.security_attackers (score desc);

create table if not exists public.security_metrics (
  minute timestamptz primary key,
  req int not null default 0,
  s2xx int not null default 0,
  s3xx int not null default 0,
  s4xx int not null default 0,
  s5xx int not null default 0,
  r429 int not null default 0,
  blocked_hits int not null default 0,
  unique_ips int not null default 0,
  waf_blocked int not null default 0,
  auth_failures int not null default 0,
  avg_rt_ms numeric not null default 0,
  p95_rt_ms numeric not null default 0,
  cache_hits int not null default 0
);

-- חסימות: source=auto נכתב ע"י ה-sentinel, source=manual מהלוח (חסימה / שחרור / רשימה לבנה קבועה)
create table if not exists public.security_blocklist (
  ip text primary key,
  status text not null check (status in ('blocked', 'released', 'allowed')),
  until timestamptz,
  reason text,
  source text not null default 'auto' check (source in ('auto', 'manual')),
  note text,
  updated_at timestamptz not null default now()
);
create index if not exists security_blocklist_updated_idx on public.security_blocklist (updated_at);

create table if not exists public.security_settings (
  id int primary key default 1 check (id = 1),
  mode text not null default 'observe' check (mode in ('observe', 'enforce')),
  block_score int not null default 100 check (block_score between 40 and 1000),
  whitelist text[] not null default '{}',
  updated_at timestamptz not null default now()
);
insert into public.security_settings (id) values (1) on conflict (id) do nothing;

alter table public.security_events enable row level security;
alter table public.security_attackers enable row level security;
alter table public.security_metrics enable row level security;
alter table public.security_blocklist enable row level security;
alter table public.security_settings enable row level security;

revoke all on public.security_events, public.security_attackers, public.security_metrics, public.security_blocklist, public.security_settings from anon, authenticated;

-- הקשחה: שתי פונקציות SECURITY DEFINER ישנות (מונה צפיות) רצו בלי search_path קבוע. פונקציית SECURITY DEFINER בלי
-- search_path אפשר לחטוף דרך אובייקט באותו שם בסכימה אחרת. מקבעים ל-public (בלי שינוי התנהגות).
do $$
begin
  begin alter function public.increment_site_visits() set search_path = public; exception when undefined_function then null; end;
  begin alter function public.add_site_visits(integer) set search_path = public; exception when undefined_function then null; end;
end $$;

-- ניקוי תקופתי (ה-sentinel קורא לזה פעם ביום): אירועים 30 יום, מדדים 90 יום
create or replace function public.security_prune()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.security_events where ts < now() - interval '30 days';
  delete from public.security_metrics where minute < now() - interval '90 days';
  delete from public.security_attackers where last_seen < now() - interval '30 days' and (blocked_until is null or blocked_until < now());
  delete from public.security_blocklist where source = 'auto' and until is not null and until < now() - interval '7 days';
$$;
revoke all on function public.security_prune() from public, anon, authenticated;
grant execute on function public.security_prune() to service_role;
