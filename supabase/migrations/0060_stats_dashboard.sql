-- ============================================================
-- עוגן פליי — לוח סטטיסטיקה למנהל: כניסות/הורדות/משתמשים חדשים לפי יום
-- מרחיב את המונה הכללי הקיים (site_stats.total_visits) בפילוח יומי, כדי שאפשר יהיה
-- לראות מגמה (עולה/יורדת) ולא רק מספר מצטבר אחד. הורדות ומשתמשים חדשים כבר נשמרים עם
-- תאריך (download_events, profiles.created_at) - רק כניסות לאתר היו חסרות פילוח יומי.
-- הריצו את כל הקובץ הזה ב-Supabase Dashboard -> SQL Editor -> New query (או psql בשרת)
-- ============================================================

create table if not exists public.daily_site_visits (
  stat_date date primary key,
  visits int not null default 0
);

alter table public.daily_site_visits enable row level security;

drop policy if exists daily_site_visits_select_staff on public.daily_site_visits;
create policy daily_site_visits_select_staff on public.daily_site_visits for select using (public.is_staff());

-- מחליפה את הפונקציה הקיימת (ראו 0022_site_stats.sql) - מוסיפה עדכון הדלי היומי,
-- באותה פעולה אטומית, בלי לשנות את הקריאה הקיימת מ-app/api/site/visit/route.ts.
create or replace function public.increment_site_visits()
returns void
language sql
security definer
as $$
  update public.site_stats set total_visits = total_visits + 1, updated_at = now() where id = 1;
  insert into public.daily_site_visits (stat_date, visits) values (current_date, 1)
    on conflict (stat_date) do update set visits = public.daily_site_visits.visits + 1;
$$;
