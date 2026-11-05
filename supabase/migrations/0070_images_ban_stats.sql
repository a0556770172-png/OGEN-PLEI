-- ============================================================
-- עוגן פליי — חסימת העלאת תמונות, צילומי מסך בהצעות ציבוריות, סטטיסטיקת הורדות למפתחים
-- images_banned: משתמש שהצוות חסם מהעלאת תמונות (אייקון, צילומי מסך, תמונת פרופיל, תמונות בפניות).
-- app_suggestions.screenshot_keys: צילומי מסך שהמציע העלה בהצעה (עוברים לאפליקציה באישור).
-- app_download_stats: סיכום הורדות לאפליקציה לפי גרסה / יום, בשביל דף הסטטיסטיקות של המפתח.
-- הקובץ idempotent - אפשר להריץ שוב בבטחה.
-- ============================================================

alter table public.profiles add column if not exists images_banned boolean not null default false;
alter table public.profiles add column if not exists images_ban_reason text;
alter table public.profiles add column if not exists images_banned_at timestamptz;

alter table public.app_suggestions add column if not exists screenshot_keys text[] not null default '{}';

create index if not exists download_events_app_created_idx on public.download_events (app_id, created_at);

create or replace function public.app_download_stats(p_app_id uuid, p_exclude_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'versions', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.last_at desc)
      from (
        select coalesce(downloaded_version, '') as version,
               count(*)::int as downloads,
               count(distinct user_id)::int as users,
               min(created_at) as first_at,
               max(created_at) as last_at
        from public.download_events
        where app_id = p_app_id and user_id <> p_exclude_user
        group by 1
      ) v
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.day)
      from (
        select (created_at at time zone 'Asia/Jerusalem')::date as day, count(*)::int as downloads
        from public.download_events
        where app_id = p_app_id and user_id <> p_exclude_user and created_at > now() - interval '30 days'
        group by 1
      ) d
    ), '[]'::jsonb),
    'totals', (
      select jsonb_build_object(
        'events', count(*)::int,
        'users', count(distinct user_id)::int,
        'last7', (count(*) filter (where created_at > now() - interval '7 days'))::int,
        'last30', (count(*) filter (where created_at > now() - interval '30 days'))::int
      )
      from public.download_events
      where app_id = p_app_id and user_id <> p_exclude_user
    )
  );
$$;

revoke all on function public.app_download_stats(uuid, uuid) from public, anon, authenticated;
