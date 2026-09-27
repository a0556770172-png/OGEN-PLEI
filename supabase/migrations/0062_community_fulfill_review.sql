-- ============================================================
-- עוגן פליי — בקשות קהילה: סימון "בוצעה" דורש אישור צוות פיקוח
-- מתנדב/מבקש שמסמן "בוצעה" מעביר את הבקשה לסטטוס pending_review ("ממתינה לאישור צוות").
-- רק צוות (מנהל/פיקוח) מאשר - ורק אז הבקשה עוברת ל-fulfilled והמתנדב מקבל את המוניטין.
-- בנוסף: עדכון בקשות ישירות מהדפדפן (RLS) מוגבל לצוות בלבד. כל הפעולות של משתמשים רגילים
-- עוברות ממילא דרך app/api/community-requests/[id]/route.ts, שאוכף את הכללים - בלי זה משתמש
-- היה יכול לעקוף את אישור הצוות ולעדכן סטטוס ישירות מול Supabase.
-- הקובץ idempotent - אפשר להריץ שוב בבטחה.
-- ============================================================

alter table public.community_requests drop constraint if exists community_requests_status_check;
alter table public.community_requests
  add constraint community_requests_status_check
  check (status in ('open', 'claimed', 'pending_review', 'fulfilled', 'closed'));

drop policy if exists community_requests_update_involved on public.community_requests;
drop policy if exists community_requests_update_staff on public.community_requests;
create policy community_requests_update_staff on public.community_requests
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- לבדיקה המהירה "האם המשתמש כבר מתנדב לבקשה אחרת" (ראו פעולת claim ב-API).
create index if not exists community_requests_claimed_by_idx
  on public.community_requests (claimed_by)
  where status in ('claimed', 'pending_review');
