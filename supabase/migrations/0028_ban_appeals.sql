-- פרטי חסימה מורחבים: סיבה, מתי נחסם, ועד מתי (null = לצמיתות). ban_expires_at נבדק
-- אוטומטית ב-lib/auth-helpers.ts - כשהזמן עובר, המשתמש משתחרר לבד בלי צורך בפעולה ידנית.
alter table public.profiles add column if not exists ban_reason text;
alter table public.profiles add column if not exists ban_expires_at timestamptz;
alter table public.profiles add column if not exists banned_at timestamptz;

-- ערעורים על חסימה: משתמש חסום יכול לכתוב הודעה למרות שהוא חסום (זה בדיוק הפעולה
-- שמותרת לו - ראו app/api/appeal/route.ts, שלא משתמש ב-requireProfile הרגיל שחוסם
-- משתמשים חסומים בכל שאר הפעולות באתר).
create table if not exists public.ban_appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  admin_reply text,
  status text not null default 'pending',
  replied_by uuid references public.profiles(id),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ban_appeals_user_id_idx on public.ban_appeals(user_id);

alter table public.ban_appeals enable row level security;
create policy ban_appeals_select_own on public.ban_appeals for select using (user_id = auth.uid());
create policy ban_appeals_select_staff on public.ban_appeals for select using (public.is_staff());
