-- 1) הסכם צוות פיקוח - מתי (אם בכלל) חבר הצוות חתם עליו. מיושם בקוד כמסך חובה שקופץ
--    לכל בעל דגל is_moderator שעדיין לא חתם (moderator_agreement_signed_at is null).
alter table public.profiles add column if not exists moderator_agreement_signed_at timestamptz;

-- 2) הרשאה נפרדת וספציפית שהמנהל מעניק ידנית לחבר צוות פיקוח מסוים, לאפשר לו לשלוח
--    קבצים/תמונות/הקלטות קוליות בהודעות למשתמשים (בברירת מחדל אף אחד מלבד מנהל בפועל
--    לא יכול לשלוח קבצים כאלה, גם לא צוות פיקוח).
alter table public.profiles add column if not exists can_send_attachments boolean not null default false;

-- 3) בקשות מחיקת משתמש - צוות פיקוח לא יכול למחוק משתמש ישירות, רק לבקש מחיקה.
--    בקשה כזו מחכה לאישור מנהל בפועל; רק אישור שלו מבצע בפועל את המחיקה הבלתי הפיכה.
create table if not exists public.user_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists user_deletion_requests_status_idx on public.user_deletion_requests (status);

alter table public.user_deletion_requests enable row level security;

drop policy if exists user_deletion_requests_select_staff on public.user_deletion_requests;
create policy user_deletion_requests_select_staff on public.user_deletion_requests
  for select using (is_staff());
