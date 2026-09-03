-- ============================================================
-- עוגן פליי — מנויי התראות + מרכז התראות באתר
-- משתמש נרשם לקבל התראה כשמפתח מסוים מפרסם/מעדכן אפליקציה, כשמתפרסמת אפליקציה
-- ציבורית חדשה, כשמתפרסם משהו חדש בקטגוריה, או על כל אפליקציה חדשה.
-- הפצה: פעמון ההתראות באתר + Web Push (בלי מייל - ראו תכנון).
-- ============================================================

-- ---------- מנויים ----------
-- target_id: מזהה מפתח (עבור type=developer), ערך קטגוריה (type=category), או '' לסוגים גלובליים.
create table if not exists public.notification_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('developer','category','new_public','all_new')),
  target_id text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, type, target_id)
);

create index if not exists notif_sub_match_idx on public.notification_subscriptions(type, target_id);

-- ---------- מרכז ההתראות (feed באתר) ----------
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  url text,
  seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notif_idx on public.user_notifications(user_id, created_at desc);

-- דגל: האם האפליקציה פורסמה אי־פעם - כדי להבחין בין "אפליקציה חדשה" ל"עדכון גרסה".
alter table public.apps add column if not exists was_published boolean not null default false;
-- אפליקציות מאושרות קיימות נחשבות כבר "פורסמו".
update public.apps set was_published = true where status = 'approved' and was_published = false;

-- ---------- RLS ----------
alter table public.notification_subscriptions enable row level security;
alter table public.user_notifications enable row level security;

drop policy if exists notif_sub_select_own on public.notification_subscriptions;
create policy notif_sub_select_own on public.notification_subscriptions for select using (user_id = auth.uid());

drop policy if exists user_notif_select_own on public.user_notifications;
create policy user_notif_select_own on public.user_notifications for select using (user_id = auth.uid());
-- כתיבה (הרשמה, יצירת התראות, סימון כנקרא) עוברת דרך ה-API בשרת.
