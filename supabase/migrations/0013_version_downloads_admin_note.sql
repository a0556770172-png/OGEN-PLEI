-- 1) הצעות אפליקציה חייבות עכשיו גם הן מספר גרסה (כמו העלאת מפתח רגילה), כדי שאפליקציות
--    שנוצרות מהצעה לא ייכנסו תמיד עם "1.0.0" קבוע.
alter table public.app_suggestions add column if not exists version text;

-- 2) טבלת מעקב הורדות - לצורך הגבלת 15 הורדות ביום למשתמש (מניעת זיוף נקודות ע"י הורדות חוזרות).
create table if not exists public.download_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  app_id uuid not null references public.apps(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists download_events_user_created_idx on public.download_events (user_id, created_at);

alter table public.download_events enable row level security;

drop policy if exists download_events_insert_own on public.download_events;
create policy download_events_insert_own on public.download_events
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists download_events_select_own on public.download_events;
create policy download_events_select_own on public.download_events
  for select to authenticated
  using (user_id = auth.uid() or is_staff());

-- 3) הערת מנהל על אפליקציה (למשל: "חסר אייקון, נא להוסיף") - מוצגת למפתח בדשבורד שלו.
alter table public.apps add column if not exists admin_note text;
alter table public.apps add column if not exists admin_note_at timestamptz;
