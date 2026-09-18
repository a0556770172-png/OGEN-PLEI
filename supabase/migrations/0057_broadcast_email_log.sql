-- לוג שליחת מיילים המוניים (כרגע: הודעת המעבר לדומיין העצמאי החדש) -
-- כדי שכפתור השליחה בניהול יהיה אידמפוטנטי/ניתן להמשכה: אם השליחה נעצרת באמצע
-- (למשל בגלל מגבלת קצב/מכסה יומית של ספק המייל), לחיצה חוזרת על הכפתור תדלג על
-- מי שכבר קיבל בהצלחה ותשלח רק למי שנשאר, בלי לשלוח כפילויות.
create table if not exists public.broadcast_email_log (
  id uuid primary key default gen_random_uuid(),
  campaign text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (campaign, user_id)
);

create index if not exists broadcast_email_log_campaign_idx on public.broadcast_email_log (campaign);

alter table public.broadcast_email_log enable row level security;

drop policy if exists broadcast_email_log_admin_only on public.broadcast_email_log;
create policy broadcast_email_log_admin_only on public.broadcast_email_log for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
