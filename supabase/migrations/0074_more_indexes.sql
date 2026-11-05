-- ============================================================
-- עוגן פליי — אינדקסים נוספים לשאילתות שנמצאו בסריקה (pg_stat_user_tables בשרת)
-- הקובץ idempotent - אפשר להריץ שוב בבטחה.
-- ============================================================

create index if not exists tickets_user_idx on public.tickets (user_id);
create index if not exists tickets_assigned_idx on public.tickets (assigned_staff_id);
create index if not exists ticket_reads_ticket_idx on public.ticket_reads (ticket_id);
create index if not exists points_log_app_reason_idx on public.points_log (app_id, reason);
create index if not exists points_log_profile_idx on public.points_log (profile_id);
-- ספירת התראות שלא נקראו (פעמון) - אינדקס חלקי קטן רק על השורות שלא נקראו
create index if not exists user_notif_unread_idx on public.user_notifications (user_id) where seen_at is null;
create index if not exists download_events_app_version_idx on public.download_events (app_id, downloaded_version);
