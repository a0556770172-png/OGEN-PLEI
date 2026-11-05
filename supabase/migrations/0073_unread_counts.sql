-- ============================================================
-- עוגן פליי — ספירת הודעות שלא נקראו בשאילתה אחת
-- קודם: פעמון ההתראות שלח שאילתת ספירה נפרדת לכל פנייה ולכל דיון ועדה (מאות שאילתות למנהל בכל רענון).
-- עכשיו: פונקציה אחת שסופרת לכל השיחות יחד.
-- הקובץ idempotent - אפשר להריץ שוב בבטחה.
-- ============================================================

create or replace function public.ticket_unread_counts(p_user uuid, p_ids uuid[])
returns table(conv_id uuid, unread bigint)
language sql
stable
security definer
set search_path = public
as $$
  select m.ticket_id, count(*)::bigint
  from public.ticket_messages m
  left join public.ticket_reads r on r.ticket_id = m.ticket_id and r.user_id = p_user
  where m.ticket_id = any(p_ids)
    and m.sender_id <> p_user
    and m.deleted_at is null
    and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
  group by m.ticket_id;
$$;

create or replace function public.council_unread_counts(p_user uuid, p_ids uuid[])
returns table(conv_id uuid, unread bigint)
language sql
stable
security definer
set search_path = public
as $$
  select m.thread_id, count(*)::bigint
  from public.council_messages m
  left join public.council_thread_reads r on r.thread_id = m.thread_id and r.user_id = p_user
  where m.thread_id = any(p_ids)
    and m.sender_id <> p_user
    and m.deleted_at is null
    and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
  group by m.thread_id;
$$;

revoke all on function public.ticket_unread_counts(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.council_unread_counts(uuid, uuid[]) from public, anon, authenticated;

create index if not exists ticket_messages_ticket_created_idx on public.ticket_messages (ticket_id, created_at);
create index if not exists council_messages_thread_created_idx on public.council_messages (thread_id, created_at);

-- עדכונים אטומיים: קודם הקוד קרא ערך, הוסיף 1/2 וכתב חזרה - כשכמה הורדות מגיעות יחד, חלקן אבדו
-- (מונה הורדות ומוניטין נמוכים מהאמת). עכשיו העדכון נעשה במסד בפעולה אחת.
create or replace function public.add_points(p_id uuid, p_delta integer)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.profiles set points = coalesce(points, 0) + p_delta where id = p_id returning points;
$$;

create or replace function public.increment_app_downloads(p_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.apps set downloads_count = coalesce(downloads_count, 0) + 1 where id = p_id returning downloads_count;
$$;

revoke all on function public.add_points(uuid, integer) from public, anon, authenticated;
revoke all on function public.increment_app_downloads(uuid) from public, anon, authenticated;
