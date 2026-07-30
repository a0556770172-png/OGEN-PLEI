-- ============================================================
-- 1) פרטיות שיחות בין חברי צוות: כל שיחה/פנייה "משוייכת" לחבר הצוות הראשון שהגיב בה
--    (assigned_staff_id) - מאותו רגע רק הוא (וכמובן המנהל בפועל, שרואה הכל תמיד) יכולים
--    לראות את ההתכתבות. פניות חדשות שעדיין לא נענו (assigned_staff_id is null) נשארות
--    גלויות לכל הצוות, עד שמישהו "לוקח" אותן ע"י תגובה ראשונה.
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

alter table public.tickets add column if not exists assigned_staff_id uuid references public.profiles(id) on delete set null;
create index if not exists tickets_assigned_staff_idx on public.tickets(assigned_staff_id);

drop policy if exists tickets_select_staff on public.tickets;
create policy tickets_select_staff on public.tickets for select using (
  public.is_admin() or (public.is_staff() and (assigned_staff_id is null or assigned_staff_id = auth.uid()))
);

drop policy if exists ticket_messages_select_staff on public.ticket_messages;
create policy ticket_messages_select_staff on public.ticket_messages for select using (
  public.is_admin() or (public.is_staff() and exists (
    select 1 from public.tickets t
    where t.id = ticket_id and (t.assigned_staff_id is null or t.assigned_staff_id = auth.uid())
  ))
);

-- ============================================================
-- 2) צ'אט "ועדה" - ערוץ חירום/עדכונים לצוות הפיקוח כולו. המנהל פותח ישירות; חברי צוות
--    יכולים לבקש פתיחה, ואם שני חברי צוות שונים מבקשים תוך 24 שעות זה נפתח אוטומטית.
-- ============================================================

create table if not exists public.council_threads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_by uuid not null references public.profiles(id) on delete cascade,
  auto_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.council_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.council_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.council_open_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'fulfilled')),
  created_at timestamptz not null default now()
);

create index if not exists council_messages_thread_idx on public.council_messages(thread_id);
create index if not exists council_open_requests_status_idx on public.council_open_requests(status);

alter table public.council_threads enable row level security;
alter table public.council_messages enable row level security;
alter table public.council_open_requests enable row level security;

drop policy if exists council_threads_select_staff on public.council_threads;
create policy council_threads_select_staff on public.council_threads for select using (public.is_staff());

drop policy if exists council_messages_select_staff on public.council_messages;
create policy council_messages_select_staff on public.council_messages for select using (public.is_staff());

drop policy if exists council_open_requests_select_staff on public.council_open_requests;
create policy council_open_requests_select_staff on public.council_open_requests for select using (public.is_staff());
