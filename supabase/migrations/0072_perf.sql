-- ============================================================
-- עוגן פליי — שיפורי עומס
-- add_site_visits: מוסיפה כמה כניסות בבת אחת (השרת מצבר ספירות ושולח פעם בכמה שניות במקום
--   עדכון שורה אחת בכל צפייה בעמוד).
-- אינדקסים לשאילתות שרצות בכל כניסה לאתר.
-- הקובץ idempotent - אפשר להריץ שוב בבטחה.
-- ============================================================

create or replace function public.add_site_visits(p_n integer)
returns void
language sql
security definer
as $$
  update public.site_stats set total_visits = total_visits + p_n, updated_at = now() where id = 1;
  insert into public.daily_site_visits (stat_date, visits) values (current_date, p_n)
    on conflict (stat_date) do update set visits = public.daily_site_visits.visits + p_n;
$$;

revoke all on function public.add_site_visits(integer) from public, anon, authenticated;

create index if not exists apps_status_created_idx on public.apps (status, created_at desc);
create index if not exists apps_developer_idx on public.apps (developer_id);
create index if not exists profiles_points_idx on public.profiles (points desc);
create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at);
create index if not exists download_events_user_created_desc_idx on public.download_events (user_id, created_at desc);
