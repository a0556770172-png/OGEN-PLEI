-- מנוי "מעקב אחרי דיון בפורום" - target_id = מזהה הפוסט הראשי.
-- נרשמים אוטומטית כשכותבים פוסט או מגיבים, וניתן לעקוב/להפסיק ידנית מדף הדיון.
alter table public.notification_subscriptions drop constraint if exists notification_subscriptions_type_check;
alter table public.notification_subscriptions
  add constraint notification_subscriptions_type_check
  check (type in ('developer','category','new_public','all_new','app','community','forum_thread'));
