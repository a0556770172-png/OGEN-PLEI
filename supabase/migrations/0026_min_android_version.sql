-- שדה חובה: גרסת אנדרואיד מינימלית נדרשת להפעלת האפליקציה/תוכנה - נדרש בכל דרך העלאה
-- (העלאה פרטית של מפתח מהדשבורד, וגם הצעת אפליקציה ציבורית) כדי שמשתמשים יידעו מראש
-- אם המכשיר שלהם תואם, לפני שהם מורידים.
alter table public.apps add column if not exists min_android_version text;
alter table public.app_suggestions add column if not exists min_android_version text;
