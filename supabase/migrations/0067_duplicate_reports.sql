-- ============================================================
-- עוגן פליי — דיווח על כפילות
-- משתמש שראה עוד אפליקציה זהה / שעושה את אותה פעולה מדווח עליה מעמוד האפליקציה, עם
-- קישור חובה לאפליקציה השנייה. הדיווח נשלח ללשונית "כפילויות" אצל צוות הפיקוח והמנהל.
-- other_app_id ממולא אוטומטית כשהקישור הוא לאפליקציה בעוגן פליי עצמו (/apps/<id>).
-- הקובץ idempotent - אפשר להריץ שוב בבטחה.
-- ============================================================

create table if not exists public.duplicate_reports (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  reported_by uuid not null references public.profiles(id) on delete cascade,
  other_url text not null,
  other_app_id uuid references public.apps(id) on delete set null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists duplicate_reports_status_idx on public.duplicate_reports (status, created_at desc);

alter table public.duplicate_reports enable row level security;
drop policy if exists duplicate_reports_select_own on public.duplicate_reports;
create policy duplicate_reports_select_own on public.duplicate_reports
  for select using (reported_by = auth.uid());
-- כתיבה וטיפול עוברים רק דרך ה-API בשרת (service role).
