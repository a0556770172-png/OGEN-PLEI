-- דיווחים על אפליקציות/תוכנות מהמשתמשים (למשל "הקישור לא עובד", "לא תואם לנטפרי" וכו').
-- דיווח שאושר ע"י צוות הפיקוח/מנהל מוצג בפומבי בעמוד האפליקציה, כדי שמשתמשים אחרים ידעו.
create table if not exists public.app_reports (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  reported_by uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists app_reports_app_idx on public.app_reports(app_id);
create index if not exists app_reports_status_idx on public.app_reports(status);

alter table public.app_reports enable row level security;

drop policy if exists app_reports_select_approved on public.app_reports;
create policy app_reports_select_approved on public.app_reports for select using (
  status = 'approved' or public.is_staff() or reported_by = auth.uid()
);

drop policy if exists app_reports_insert_own on public.app_reports;
create policy app_reports_insert_own on public.app_reports for insert with check (reported_by = auth.uid());
