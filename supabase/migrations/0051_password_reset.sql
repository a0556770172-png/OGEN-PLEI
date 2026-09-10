-- מערכת "שכחתי סיסמה": מסלול ראשי = קישור איפוס במייל (Supabase Auth). הטבלה הזו
-- משמשת (א) ליומן שליחות לצורך הגבלת קצב, (ב) לבקשות הסלמה לצוות כשהמייל לא מגיע.
create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'escalation' check (kind in ('email_sent', 'escalation')),
  email text not null,
  claimed_username text,
  details text,
  ip text,
  status text not null default 'open' check (status in ('open', 'handled', 'rejected')),
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists prr_email_created_idx on public.password_reset_requests (email, created_at desc);
create index if not exists prr_status_idx on public.password_reset_requests (kind, status, created_at desc);

-- RLS פעיל בלי policies = גישה דרך השרת בלבד (admin client).
alter table public.password_reset_requests enable row level security;
