-- לוג ביקורת (audit log) לכל פעולות צוות הפיקוח/מנהל, מעקב "נקרא לאחרונה" לכל שיחה בנפרד
-- (כדי לדעת בדיוק מאיזו שיחה יש הודעות שלא נקראו), והרשמות ל-Web Push להתראות דפדפן אמיתיות.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id text,
  target_label text,
  meta jsonb not null default '{}'::jsonb,
  undoable boolean not null default false,
  undone_at timestamptz,
  undone_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log(created_at desc);
create index if not exists audit_log_actor_idx on public.audit_log(actor_id);

alter table public.audit_log enable row level security;
drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_admin on public.audit_log for select using (public.is_admin());

create table if not exists public.ticket_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, ticket_id)
);
alter table public.ticket_reads enable row level security;
drop policy if exists ticket_reads_own on public.ticket_reads;
create policy ticket_reads_own on public.ticket_reads for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.council_thread_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  thread_id uuid not null references public.council_threads(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);
alter table public.council_thread_reads enable row level security;
drop policy if exists council_thread_reads_own on public.council_thread_reads;
create policy council_thread_reads_own on public.council_thread_reads for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
