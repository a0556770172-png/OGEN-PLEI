-- תגיות פרופיל (הערות + תיוג מייל להצגה) וכן מערכת צ'אטים בין משתמשים (נפתחת אוטומטית
-- למי שהעלה/הציע 10 אפליקציות/תוכנות ומעלה, ראה lib/dm-eligibility.ts).

alter table public.profiles add column if not exists notes text;
alter table public.profiles add column if not exists display_email text;
alter table public.profiles add column if not exists show_email_tag boolean not null default false;

create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b)
);
create index if not exists dm_threads_user_a_idx on public.dm_threads(user_a);
create index if not exists dm_threads_user_b_idx on public.dm_threads(user_b);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists dm_messages_thread_idx on public.dm_messages(thread_id);

create table if not exists public.dm_thread_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);

alter table public.dm_threads enable row level security;
alter table public.dm_messages enable row level security;
alter table public.dm_thread_reads enable row level security;

drop policy if exists dm_threads_participant on public.dm_threads;
create policy dm_threads_participant on public.dm_threads for select using (
  auth.uid() = user_a or auth.uid() = user_b
);

drop policy if exists dm_messages_participant on public.dm_messages;
create policy dm_messages_participant on public.dm_messages for select using (
  exists (select 1 from public.dm_threads t where t.id = thread_id and (t.user_a = auth.uid() or t.user_b = auth.uid()))
);

drop policy if exists dm_thread_reads_own on public.dm_thread_reads;
create policy dm_thread_reads_own on public.dm_thread_reads for all using (user_id = auth.uid()) with check (user_id = auth.uid());
