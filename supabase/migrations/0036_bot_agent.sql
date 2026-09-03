-- ============================================================
-- עוגן פליי — שדרוג הצ'אט-בוט לסוכן (Agent) עם קריאת כלים (function calling)
-- ראו lib/botTools.ts, lib/botContext.ts, lib/bot.ts, app/api/bot/*.
-- ============================================================

-- ---------- לוג קריאות כלים ----------
-- כל כלי שהסוכן מפעיל נרשם כאן: לשקיפות מול הצוות, לניפוי באגים, ולאנליטיקה.
create table if not exists public.bot_tool_calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.bot_conversations(id) on delete cascade,
  tool text not null,
  args jsonb not null default '{}'::jsonb,
  ok boolean not null default true,
  result_summary text,
  ms integer,
  created_at timestamptz not null default now()
);

create index if not exists bot_tool_calls_conv_idx on public.bot_tool_calls(conversation_id, created_at);
create index if not exists bot_tool_calls_tool_idx on public.bot_tool_calls(tool, created_at);

-- ---------- דירוג תשובות (👍 / 👎) ----------
create table if not exists public.bot_message_feedback (
  message_id uuid primary key references public.bot_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating in (-1, 1)),
  note text,
  created_at timestamptz not null default now()
);

-- ---------- מטא על הודעת בוט (כרטיסי אפליקציה, פעולה מוצעת, הצעות המשך) ----------
alter table public.bot_messages add column if not exists meta jsonb;

-- ---------- תוספות ל-bot_config ----------
-- מודל "חזק" לעזרה למפתחים / ניסוח / הסקה מורכבת (ריק = משתמשים באותו מודל).
alter table public.bot_config add column if not exists model_smart text;
-- האם הבוט רשאי לפתוח שיחה יזומה (המלצות פרואקטיביות בפתיחת חלונית).
alter table public.bot_config add column if not exists proactive_enabled boolean not null default true;
-- מקסימום סבבי כלים לכל בקשה (הגנת עלות/לולאות).
alter table public.bot_config add column if not exists max_tool_rounds integer not null default 5;

-- ---------- RLS ----------
-- הכל דרך ה-API בשרת (service role). אין policies ללקוח.
alter table public.bot_tool_calls enable row level security;
alter table public.bot_message_feedback enable row level security;
