-- ============================================================
-- עוגן פליי — שדרוג פלטפורמה (מסמך אפיון דרישות)
-- הריצו את כל הקובץ הזה ב-Supabase Dashboard -> SQL Editor -> New query.
-- כל הפקודות idempotent (IF NOT EXISTS / OR REPLACE) - אפשר להריץ שוב בבטחה.
-- ============================================================

-- ------------------------------------------------------------
-- באג #8: הרשאת לייק/תגובה ידנית מהמנהל לא "נתפסה".
-- הסיבה: העמודות can_like_override / can_comment_override (מיגרציה 0024) כנראה לא הורצו
-- במסד בפועל, ולכן ה-SELECT ב-lib/engagement-eligibility.ts נכשל בשקט ונפל חזרה לבדיקת
-- הסף. שורות ה-ALTER כאן מוודאות סופית שהעמודות קיימות (בטוח גם אם כבר קיימות).
-- ------------------------------------------------------------
alter table public.profiles add column if not exists can_like_override boolean not null default false;
alter table public.profiles add column if not exists can_comment_override boolean not null default false;

-- ------------------------------------------------------------
-- פיצ'ר 6: נעיצה/קידום אפליקציות ע"י מנהל (מוצגות בראש העמוד הראשי).
-- pinned = האם נעוצה, pinned_at = מתי ננעצה (לקביעת סדר בין נעוצות - החדשה ביותר קודם).
-- ------------------------------------------------------------
alter table public.apps add column if not exists pinned boolean not null default false;
alter table public.apps add column if not exists pinned_at timestamptz;
create index if not exists apps_pinned_idx on public.apps (pinned, pinned_at desc);

-- ------------------------------------------------------------
-- פיצ'ר 5: התראות חכמות על עדכוני גרסה.
-- שומרים איזו גרסה המשתמש הוריד בפועל (downloaded_version), כדי לזהות אחר כך אם עלה
-- עדכון חדש יותר לאפליקציה שהוא כבר הוריד - ואז להציג סימון (Badge) + חלונית כניסה.
-- ------------------------------------------------------------
alter table public.download_events add column if not exists downloaded_version text;

-- ------------------------------------------------------------
-- פיצ'ר 4: מערכת "בקשות קהילתיות".
-- משתמש מדביק קישור לבקשה מפורום חיצוני ("מתמחים טופ" וכו'), ומתנדב מוריד מהמקור
-- ומעלה עבורו את הקובץ. הבקשה עוברת סטטוסים: open -> claimed (מתנדב לקח על עצמו) ->
-- fulfilled (הועלתה בפועל). closed = נסגרה ע"י המבקש/צוות.
-- ------------------------------------------------------------
create table if not exists public.community_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  source_link text,
  note text,
  category text,
  status text not null default 'open' check (status in ('open', 'claimed', 'fulfilled', 'closed')),
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  fulfilled_by uuid references public.profiles(id) on delete set null,
  fulfilled_app_id uuid references public.apps(id) on delete set null,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_requests_status_idx on public.community_requests (status, created_at desc);

alter table public.community_requests enable row level security;

-- קריאה: כל אחד (גם אורח לא מחובר) יכול לראות את לוח הבקשות הציבורי.
drop policy if exists community_requests_select_all on public.community_requests;
create policy community_requests_select_all on public.community_requests for select using (true);

-- יצירה: משתמש מחובר יוצר בקשה בשם עצמו בלבד.
drop policy if exists community_requests_insert_own on public.community_requests;
create policy community_requests_insert_own on public.community_requests
  for insert to authenticated
  with check (requested_by = auth.uid());

-- עדכון: המבקש עצמו, המתנדב שלקח את הבקשה, או צוות. (הרוב מתבצע בשרת עם service-role
-- שעוקף RLS, אבל משאירים מדיניות שפויה גם לקריאות ישירות מהלקוח.)
drop policy if exists community_requests_update_involved on public.community_requests;
create policy community_requests_update_involved on public.community_requests
  for update to authenticated
  using (requested_by = auth.uid() or claimed_by = auth.uid() or public.is_staff())
  with check (requested_by = auth.uid() or claimed_by = auth.uid() or public.is_staff());

-- מחיקה: המבקש עצמו או צוות.
drop policy if exists community_requests_delete_own on public.community_requests;
create policy community_requests_delete_own on public.community_requests
  for delete to authenticated
  using (requested_by = auth.uid() or public.is_staff());
