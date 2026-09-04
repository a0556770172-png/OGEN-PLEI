-- ============================================================
-- עוגן פליי — מנוי התראות לאפליקציה ספציפית (התראה כשיוצאת גרסה חדשה)
-- מרחיב את סוגי המנויים ב-'app' (target_id = מזהה האפליקציה).
-- ============================================================
alter table public.notification_subscriptions drop constraint if exists notification_subscriptions_type_check;
alter table public.notification_subscriptions
  add constraint notification_subscriptions_type_check
  check (type in ('developer','category','new_public','all_new','app'));
