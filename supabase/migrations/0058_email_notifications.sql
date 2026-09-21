-- ============================================================
-- עוגן פליי — התראות גם במייל (בנוסף לפעמון באתר), עם תור חכם ומכסה יומית
-- כל משתמש יכול להדליק בפרופיל שלו "קבלת התראות גם במייל". כשהוא מקבל התראה
-- (עקיבה אחרי מפתח/קטגוריה, אפליקציה ציבורית חדשה, תגובה על אפליקציה, פוסט בפורום וכו' -
-- כל מה שכבר נכנס ל-user_notifications דרך lib/notifications.ts) היא מצטרפת לתור מייל.
-- ג'וב (cron בשרת, ראו app/api/cron/email-notifications) שולח פעם בכמה דקות, בתוך חלון
-- שעות שהמנהל קובע, עד למכסה יומית שהמנהל קובע (כדי לא לחרוג ממכסת Resend החינמית).
-- כל מייל הוא "דייג'סט" - כל ההתראות הממתינות של אותו משתמש מרוכזות במייל אחד, כדי
-- שכל מייל שנשלח "יעלה" רק יחידה אחת מהמכסה היומית (ולא לפי מספר ההתראות עצמן).
-- מי שלא הגיע אליו תור היום (המכסה נגמרה) - נשאר בתור ונשלח לו אוטומטית מחר (הבדיקה
-- "כמה נשלחו היום" מתאפסת עם התאריך, וההתראות שממתינות פשוט ממשיכות להמתין).
-- הריצו את כל הקובץ הזה ב-Supabase Dashboard -> SQL Editor -> New query (או psql בשרת)
-- ============================================================

-- מתג אישי למשתמש - כבוי כברירת מחדל, כדי לא להציף בלי הסכמה מפורשת.
alter table public.profiles add column if not exists email_notifications_enabled boolean not null default false;

-- מצב שליחת מייל לכל שורת התראה בתור. 'pending' = ממתין, 'sent' = נשלח בדייג'סט,
-- 'skipped' = לא ייכנס למייל בכלל (למשל התראות ישנות מלפני הפעלת הפיצ'ר, או כבות מנהל).
alter table public.user_notifications add column if not exists email_status text not null default 'pending' check (email_status in ('pending','sent','skipped'));
alter table public.user_notifications add column if not exists email_sent_at timestamptz;
create index if not exists user_notif_email_pending_idx on public.user_notifications(email_status, created_at) where email_status = 'pending';

-- התראות שכבר קיימות לפני שהפיצ'ר עלה - לא רלוונטיות יותר לתור המייל (כדי שמשתמש
-- שידליק את המתג לא "יוצף" בהיסטוריה ישנה של חודשים). רק התראות חדשות מכאן ואילך נכנסות לתור.
update public.user_notifications set email_status = 'skipped' where email_status = 'pending';

-- הגדרות גלובליות לניהול המנהל - מתג ראשי, מכסה יומית, וחלון שעות שליחה (שעון ישראל).
alter table public.site_settings add column if not exists email_notifications_enabled boolean not null default true;
alter table public.site_settings add column if not exists email_notifications_daily_cap integer not null default 180;
alter table public.site_settings add column if not exists email_notifications_window_start smallint not null default 7;
alter table public.site_settings add column if not exists email_notifications_window_end smallint not null default 23;
