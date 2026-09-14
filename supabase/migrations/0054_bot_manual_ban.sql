-- חסימה ידנית וקבועה מגישה לצ'אט-בוט (בנוסף לחסימת השעה האוטומטית על ניסיון מניפולציה
-- ב-bot_blocked_until). המשתמש עדיין יכול להשתמש בכל שאר האתר, כולל פתיחת פנייה לתמיכה
-- (זו דרך הערר - אין צורך בטופס נפרד כמו בחסימת אתר מלאה).
alter table public.profiles add column if not exists bot_banned boolean not null default false;
alter table public.profiles add column if not exists bot_ban_reason text;
