-- ============================================================
-- עוגן פליי — גרסאות חדשות ממתינות לאישור (בלי לגעת באפליקציה החיה)
-- כל גרסה חדשה לאפליקציה שכבר מפורסמת נשמרת כאן עד שהצוות מאשר:
--   * בעלים שמעלה גרסה לאפליקציה הפרטית שלו
--   * כל משתמש שמעדכן אפליקציה ציבורית ("עדכן את האפליקציה") - באישור הוא הופך לבעלים
-- עד האישור האפליקציה ממשיכה להופיע בחנות עם הגרסה הקודמת. באישור - הקובץ והפרטים עוברים
-- לאפליקציה, והקובץ הישן נמחק לגמרי מהאחסון. בדחייה - נמחק הקובץ המוצע.
-- last_updated_at = מתי אושרה הגרסה החדשה האחרונה (תווית "עודכן" לכמה ימים).
-- הקובץ idempotent - אפשר להריץ שוב בבטחה.
-- ============================================================

create table if not exists public.app_version_proposals (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  -- owner = הבעלים מעדכן את שלו; public = משתמש מעדכן אפליקציה ציבורית (מעבר בעלות באישור)
  kind text not null default 'owner' check (kind in ('owner', 'public')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  version text not null,
  file_key text not null,
  file_name text not null,
  file_size_bytes bigint not null,
  icon_key text,
  -- פרטים מעודכנים (null = להשאיר את הקיים באפליקציה)
  name text,
  short_description text,
  description_html text,
  category text,
  min_android_version text,
  offline_support text,
  platform_override text check (platform_override in ('apk', 'software')),
  review_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists app_version_proposals_pending_idx on public.app_version_proposals (status, created_at);
create index if not exists app_version_proposals_app_idx on public.app_version_proposals (app_id);

alter table public.app_version_proposals enable row level security;
drop policy if exists app_version_proposals_select_own on public.app_version_proposals;
create policy app_version_proposals_select_own on public.app_version_proposals
  for select using (uploader_id = auth.uid());
-- כתיבה ואישור עוברים רק דרך ה-API בשרת (service role).

alter table public.apps add column if not exists last_updated_at timestamptz;
