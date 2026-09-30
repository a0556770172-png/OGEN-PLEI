-- ============================================================
-- עוגן פליי — אפליקציה שקיבלה גרסה חדשה עולה לראש החנות
-- published_at = מתי האפליקציה "פורסמה" לאחרונה: באישור הראשון, ושוב בכל פעם שגרסה חדשה
-- מאושרת (ראו notifyForApprovedApp ב-lib/notifications.ts). החנות ממוינת לפיה (אחרי הנעוצות),
-- כך שעדכון גרסה מקפיץ את האפליקציה למעלה כאילו היא חדשה.
-- published_version = הגרסה שפורסמה אז - כדי שאישור חוזר של אותה גרסה לא יקפיץ שוב.
-- הקובץ idempotent - אפשר להריץ שוב בבטחה.
-- ============================================================

alter table public.apps add column if not exists published_at timestamptz;
alter table public.apps add column if not exists published_version text;

-- אפליקציות קיימות: שומרים על הסדר הנוכחי (לפי תאריך האישור, או תאריך היצירה).
update public.apps set published_at = coalesce(reviewed_at, created_at) where published_at is null;
update public.apps set published_version = version where published_version is null and status = 'approved';

create index if not exists apps_published_at_idx on public.apps (published_at desc);
