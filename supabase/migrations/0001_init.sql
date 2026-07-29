-- ============================================================
-- עוגן פליי — סכמת מסד נתונים ראשונית
-- הרץ את כל הקובץ הזה ב-Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- טבלת פרופילים ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text not null unique,
  role text not null default 'user' check (role in ('user','developer','admin','moderator')),
  is_pro boolean not null default false,
  pro_status text not null default 'none' check (pro_status in ('none','requested','approved','rejected')),
  points integer not null default 0,
  banned boolean not null default false,
  accepted_terms_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- טבלת אפליקציות ----------
create table if not exists public.apps (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  short_description text not null default '',
  description_html text not null default '',
  version text not null default '1.0.0',
  category text not null default 'general',
  icon_key text,
  file_key text not null,
  file_name text not null,
  file_size_bytes bigint not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','archived')),
  review_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  downloads_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists apps_developer_id_idx on public.apps(developer_id);
create index if not exists apps_status_idx on public.apps(status);

-- ---------- בקשות שדרוג ל-PRO ----------
create table if not exists public.pro_requests (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  message text,
  created_at timestamptz not null default now(),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz
);

-- ---------- לוג נקודות ----------
create table if not exists public.points_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null,
  reason text not null,
  app_id uuid references public.apps(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- פונקציית עזר: תפקיד המשתמש הנוכחי (security definer -> עוקפת RLS)
-- ============================================================
create or replace function public.current_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ============================================================
-- יצירת פרופיל אוטומטית עם הרשמה
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  final_role text;
  base_username text;
  final_username text;
  suffix int := 0;
begin
  requested_role := coalesce(new.raw_user_meta_data->>'role', 'user');
  if requested_role not in ('user','developer') then
    requested_role := 'user';
  end if;

  -- מייל המנהל תמיד מקבל הרשאת admin, ללא קשר למה שנשלח בטופס
  -- (מוגדר כאן ישירות בקוד, כי לחשבון של Supabase Dashboard אין הרשאה להגדיר משתני database מותאמים אישית)
  if lower(new.email) = lower('e0556770172@gmail.com') then
    final_role := 'admin';
  else
    final_role := requested_role;
  end if;

  base_username := coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), split_part(new.email, '@', 1));
  final_username := base_username;

  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  end loop;

  insert into public.profiles (id, email, username, role, accepted_terms_at)
  values (
    new.id,
    new.email,
    final_username,
    final_role,
    case when requested_role = 'developer' and (new.raw_user_meta_data->>'accepted_terms')::boolean is true
         then now() else null end
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- הערה: מייל המנהל מוגדר ישירות בתוך הפונקציה handle_new_user למעלה (ולא כאן),
-- כי חשבון ה-SQL Editor של Supabase Dashboard אינו מורשה להריץ ALTER DATABASE ... SET.

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.apps enable row level security;
alter table public.pro_requests enable row level security;
alter table public.points_log enable row level security;

-- profiles: קריאה בלבד מהצד של הלקוח. כל כתיבה (חסימה/דירוג/נקודות) עוברת דרך שרת עם המפתח הסודי.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (id = auth.uid());

drop policy if exists profiles_select_staff on public.profiles;
create policy profiles_select_staff on public.profiles for select using (public.current_role() in ('admin','moderator'));

-- apps: כולם רואים אפליקציות מאושרות; מפתח רואה את שלו; צוות רואה הכל
drop policy if exists apps_select_public on public.apps;
create policy apps_select_public on public.apps for select using (status = 'approved');

drop policy if exists apps_select_own on public.apps;
create policy apps_select_own on public.apps for select using (developer_id = auth.uid());

drop policy if exists apps_select_staff on public.apps;
create policy apps_select_staff on public.apps for select using (public.current_role() in ('admin','moderator'));

-- pro_requests: מפתח רואה את שלו, צוות רואה הכל
drop policy if exists pro_requests_select_own on public.pro_requests;
create policy pro_requests_select_own on public.pro_requests for select using (developer_id = auth.uid());

drop policy if exists pro_requests_select_staff on public.pro_requests;
create policy pro_requests_select_staff on public.pro_requests for select using (public.current_role() in ('admin','moderator'));

-- points_log: בעלים רואה את שלו, צוות רואה הכל
drop policy if exists points_log_select_own on public.points_log;
create policy points_log_select_own on public.points_log for select using (profile_id = auth.uid());

drop policy if exists points_log_select_staff on public.points_log;
create policy points_log_select_staff on public.points_log for select using (public.current_role() in ('admin','moderator'));

-- הערה: אין policies ל-insert/update/delete בכוונה.
-- כל הפעולות הכותבות (העלאת אפליקציה, אישור/דחייה, חסימה, קידום ל-PRO, ניקוד)
-- מתבצעות אך ורק דרך ה-API Routes בשרת (Next.js) עם מפתח ה-service role,
-- כך שכל הכללים העסקיים (מכסת 5/50 אפליקציות, 30/100MB וכו') נאכפים במקום אחד ולא ניתנים לעקיפה מהדפדפן.
