-- ============================================================
-- עוגן פליי — מערכת הפניות (Referral)
-- כל משתמש משתף קישור אישי (ogen-plei.vercel.app/?ref=<שם המשתמש שלו>).
-- חבר חדש שנרשם דרך הקישור ומאמת מייל:
--   • המפנה מקבל 25 מוניטין + קרדיט חריגת העלאה של 150MB (נצבר)
--   • המצטרף מקבל 10 מוניטין (בונוס הצטרפות)
-- הגנות: לא נותנים תגמול אם ה-IP של המצטרף זהה ל-IP האחרון של המפנה, ולא
-- מעבר ל-5 הפניות מתוגמלות ב-24 שעות מתגלגלות (הפניה נוספת נרשמת אך ללא תגמול).
-- ============================================================

-- ---------- עמודות חדשות בטבלת הפרופילים ----------
alter table public.profiles add column if not exists referred_by uuid references public.profiles(id) on delete set null;
-- מתי המפנה קיבל (או נשלל ממנו) התגמול עבור המשתמש הזה - שומר שהעיבוד יקרה פעם אחת בלבד.
alter table public.profiles add column if not exists referral_rewarded_at timestamptz;
-- מתי המשתמש הזה קיבל את בונוס ההצטרפות שלו (10 מוניטין).
alter table public.profiles add column if not exists referral_join_bonus_at timestamptz;
-- מספר קרדיטים של חריגת גודל 150MB שנצברו מהפניות (נצבר, לא דורס - כל הפניה מוסיפה 1).
alter table public.profiles add column if not exists referral_size_override_credits integer not null default 0;
-- ה-IP האחרון שממנו נראה המשתמש (מתעדכן ב-app/api/profile/heartbeat) - לבדיקת רמאות בהפניות.
alter table public.profiles add column if not exists last_ip text;

create index if not exists profiles_referred_by_idx on public.profiles(referred_by);

-- ---------- טבלת אירועי הפניה (ללוג האדמין + ספירת התקרה היומית) ----------
create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_user_id uuid not null unique references public.profiles(id) on delete cascade,
  signup_ip text,
  -- rewarded  = שולם במלואו
  -- capped    = נחסם כי המפנה עבר 5 הפניות מתוגמלות ב-24 שעות
  -- blocked_ip= נחסם כי ה-IP של המצטרף זהה ל-IP האחרון של המפנה
  -- revoked   = אדמין ביטל ידנית תגמול שכבר ניתן
  status text not null check (status in ('rewarded','capped','blocked_ip','revoked')),
  referrer_points_awarded integer not null default 0,
  joiner_points_awarded integer not null default 0,
  size_credit_awarded boolean not null default false,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists referral_events_referrer_idx on public.referral_events(referrer_id);
create index if not exists referral_events_status_idx on public.referral_events(status);

-- ---------- RLS ----------
alter table public.referral_events enable row level security;

-- המפנה רואה את ההפניות שלו; צוות רואה הכל. כל כתיבה עוברת דרך שרת עם service role.
drop policy if exists referral_events_select_own on public.referral_events;
create policy referral_events_select_own on public.referral_events for select using (referrer_id = auth.uid());

drop policy if exists referral_events_select_staff on public.referral_events;
create policy referral_events_select_staff on public.referral_events for select using (public.current_role() in ('admin','moderator'));

-- ============================================================
-- עדכון הטריגר handle_new_user - זהה למקור, בתוספת קריאת raw_user_meta_data->>'ref'
-- וקישור referred_by לפי שם המשתמש של המפנה (case-insensitive).
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
  ref_username text;
  ref_id uuid := null;
begin
  requested_role := coalesce(new.raw_user_meta_data->>'role', 'user');
  if requested_role not in ('user','developer') then
    requested_role := 'user';
  end if;

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

  -- קישור למפנה: הקוד בקישור השיתוף הוא שם המשתמש של המפנה.
  ref_username := nullif(trim(new.raw_user_meta_data->>'ref'), '');
  if ref_username is not null then
    select id into ref_id from public.profiles where lower(username) = lower(ref_username) limit 1;
  end if;

  insert into public.profiles (id, email, username, role, accepted_terms_at, referred_by)
  values (
    new.id,
    new.email,
    final_username,
    final_role,
    case when requested_role = 'developer' and (new.raw_user_meta_data->>'accepted_terms')::boolean is true
         then now() else null end,
    ref_id
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
