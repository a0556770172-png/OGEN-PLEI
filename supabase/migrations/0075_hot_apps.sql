-- ============================================================
-- עוגן פליי — "החמים שלנו": האפליקציות הכי מורדות לאחרונה
-- hot_apps: מספר ההורדות של כל אפליקציה מאושרת בתקופה האחרונה (בלי הורדות של המפתח עצמו), מהגבוה לנמוך.
-- הקובץ idempotent - אפשר להריץ שוב בבטחה.
-- ============================================================

create index if not exists download_events_created_idx on public.download_events (created_at);

create or replace function public.hot_apps(p_days integer, p_limit integer)
returns table(app_id uuid, recent bigint)
language sql
stable
security definer
set search_path = public
as $$
  select e.app_id, count(*)::bigint as recent
  from public.download_events e
  join public.apps a on a.id = e.app_id
  where a.status = 'approved'
    and e.user_id <> a.developer_id
    and e.created_at > now() - make_interval(days => p_days)
  group by e.app_id
  order by 2 desc, 1
  limit p_limit;
$$;

revoke all on function public.hot_apps(integer, integer) from public, anon, authenticated;
