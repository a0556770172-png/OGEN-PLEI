-- ============================================================
-- עוגן פליי — גיוס לצוות הפיקוח: שאלון קבלה
-- team_applications: מועמדויות (התשובות נשמרות כ-JSON לפי מזהה שאלה, ראו lib/teamQuestions.ts)
-- site_settings.team_recruit_open: מתג של המנהל - הגיוס פתוח/סגור (מציג/מסתיר את הבאנר וחוסם הגשות)
-- הקובץ idempotent - אפשר להריץ שוב בבטחה.
-- ============================================================

create table if not exists public.team_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'interview', 'approved', 'rejected')),
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists team_applications_user_idx on public.team_applications (user_id, created_at desc);
create index if not exists team_applications_status_idx on public.team_applications (status, created_at desc);
alter table public.team_applications enable row level security;

alter table public.site_settings add column if not exists team_recruit_open boolean not null default true;
