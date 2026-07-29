-- ============================================================
-- עוגן פליי — טאב "משתמשים" ציבורי, מעקב "ביקור אחרון", מנהל=PRO, הודעת מנהל לבקשת PRO
-- הריצו את כל הקובץ הזה ב-Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

-- "ביקור אחרון" - מתעדכן בכל טעינת עמוד (ראו /api/profile/heartbeat)
alter table public.profiles add column if not exists last_seen_at timestamptz;

-- הודעת הסבר שהמנהל יכול לצרף כשהוא מאשר/דוחה בקשת PRO
alter table public.pro_requests add column if not exists admin_message text;

-- המנהל מקבל חשבון PRO אוטומטית (גם אם כבר קיים בדאטהבייס)
update public.profiles
set is_pro = true, pro_status = 'approved'
where role = 'admin' and (is_pro is distinct from true or pro_status is distinct from 'approved');
