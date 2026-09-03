-- ============================================================
-- עוגן פליי — מאגר מפתחי Gemini API עם רוטציה אוטומטית
-- מאחסנים כמה מפתחות (מכמה חשבונות Google). כשמפתח נכשל (מכסה נגמרה / קצב / כל שגיאה
-- שקשורה למפתח) - עוברים אוטומטית למפתח הבא, ומכניסים את הנכשל ל"קירור" עד שיתאושש.
-- הכל דרך ה-API בשרת (service role) - אין policies ללקוח.
-- ============================================================
create table if not exists public.bot_api_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null default '',
  api_key text not null,
  enabled boolean not null default true,
  -- עד מתי לא לנסות את המפתח הזה (נקבע אחרי שגיאת מכסה/קצב). null = זמין.
  cooldown_until timestamptz,
  last_error text,
  last_error_at timestamptz,
  last_ok_at timestamptz,
  ok_count integer not null default 0,
  fail_count integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists bot_api_keys_order_idx on public.bot_api_keys(enabled, sort_order, created_at);

alter table public.bot_api_keys enable row level security;
