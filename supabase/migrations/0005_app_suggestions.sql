-- ============================================================
-- עוגן פליי — הצעות אפליקציות למאגר (על ידי כל משתמש), עם ניקוד ושדרוג PRO אוטומטי
-- הריצו את כל הקובץ הזה ב-Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

create table if not exists public.app_suggestions (
  id uuid primary key default gen_random_uuid(),
  suggested_by uuid not null references public.profiles(id) on delete cascade,
  app_name text not null,
  app_link text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  points_awarded boolean not null default false,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists app_suggestions_suggested_by_idx on public.app_suggestions(suggested_by);
create index if not exists app_suggestions_status_idx on public.app_suggestions(status);

alter table public.app_suggestions enable row level security;

drop policy if exists app_suggestions_select_own on public.app_suggestions;
create policy app_suggestions_select_own on public.app_suggestions for select using (suggested_by = auth.uid());

drop policy if exists app_suggestions_select_staff on public.app_suggestions;
create policy app_suggestions_select_staff on public.app_suggestions for select using (public.is_staff());
