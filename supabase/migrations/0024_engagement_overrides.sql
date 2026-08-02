-- אפשרות למנהל בפועל להעניק ידנית למשתמש ספציפי הרשאת לייק/תגובה גם בלי שהגיע לסף
-- האפליקציות שהעלה (ראה lib/engagement-eligibility.ts).
alter table public.profiles add column if not exists can_like_override boolean not null default false;
alter table public.profiles add column if not exists can_comment_override boolean not null default false;
