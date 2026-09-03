-- ============================================================
-- עוגן פליי — צ'אט-בוט לאתר (מבוסס Google Gemini)
-- משתמשים מחוברים שואלים שאלות (עזרה באתר, חיפוש אפליקציה לפי דרישות, מוניטין וכו')
-- והבוט עונה. מפתח ה-API והגדרות הבוט נקבעים מפאנל הניהול.
-- ============================================================

-- ---------- טבלת הגדרות הבוט (שורה יחידה) ----------
-- אין policy ל-select בכוונה: מפתח ה-Gemini לא ייחשף לעולם ללקוח. כל גישה (קריאה
-- וכתיבה) עוברת דרך השרת עם מפתח ה-service role בלבד.
create table if not exists public.bot_config (
  id boolean primary key default true,
  enabled boolean not null default false,
  gemini_api_key text,
  model text not null default 'gemini-2.5-flash',
  -- הנחיית מערכת מותאמת; null = שימוש בברירת המחדל שבקוד (lib/bot.ts).
  system_prompt text,
  -- מקסימום הודעות משתמש ל-24 שעות מתגלגלות (צוות פטור מהמגבלה).
  daily_limit integer not null default 30,
  updated_at timestamptz not null default now(),
  constraint bot_config_singleton check (id)
);

insert into public.bot_config (id) values (true) on conflict (id) do nothing;

alter table public.bot_config enable row level security;
-- שום policy - הטבלה נגישה אך ורק דרך service role בשרת.

-- ---------- שיחות ----------
create table if not exists public.bot_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'שיחה חדשה',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bot_conversations_user_idx on public.bot_conversations(user_id, updated_at desc);

-- ---------- הודעות ----------
create table if not exists public.bot_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.bot_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists bot_messages_conversation_idx on public.bot_messages(conversation_id, created_at);
-- לספירת מגבלת הקצב (הודעות משתמש ב-24 שעות אחרונות).
create index if not exists bot_messages_role_created_idx on public.bot_messages(role, created_at);

-- ---------- RLS ----------
-- כל הקריאה/כתיבה של שיחות והודעות עוברת דרך ה-API בשרת (app/api/bot/*), עם בדיקה
-- שהשיחה שייכת למשתמש או שהוא צוות. אין policies ללקוח.
alter table public.bot_conversations enable row level security;
alter table public.bot_messages enable row level security;
