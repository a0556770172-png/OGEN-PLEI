-- ============================================================
-- עוגן פליי — מערכת פניות תמיכה (טיקטים) בין משתמשים/מפתחים לבין המנהל
-- הריצו את כל הקובץ הזה ב-Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_role text not null default 'user' check (sender_role in ('user', 'staff')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists tickets_user_id_idx on public.tickets(user_id);
create index if not exists tickets_status_idx on public.tickets(status);
create index if not exists ticket_messages_ticket_id_idx on public.ticket_messages(ticket_id);

alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;

-- קריאה בלבד מהצד של הלקוח (בדיוק כמו שאר הטבלאות) - כל כתיבה עוברת דרך API Routes עם service role
drop policy if exists tickets_select_own on public.tickets;
create policy tickets_select_own on public.tickets for select using (user_id = auth.uid());

drop policy if exists tickets_select_staff on public.tickets;
create policy tickets_select_staff on public.tickets for select using (public.current_role() in ('admin', 'moderator'));

drop policy if exists ticket_messages_select_own on public.ticket_messages;
create policy ticket_messages_select_own on public.ticket_messages for select using (
  exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid())
);

drop policy if exists ticket_messages_select_staff on public.ticket_messages;
create policy ticket_messages_select_staff on public.ticket_messages for select using (public.current_role() in ('admin', 'moderator'));
