-- שדה חדש: האם האפליקציה/התוכנה פועלת אופליין, חייבת חיבור אינטרנט, או לא ידוע.
-- נשאל באותה חלונית אישור שבה נשאלת שאלת "נטפרי" בהעלאה, בכל מסלולי העלאת אפליקציה חדשה
-- (העלאה פרטית והצעה ציבורית כאחד).
alter table public.apps add column if not exists offline_support text not null default 'unknown'
  check (offline_support in ('offline', 'online', 'unknown'));

alter table public.app_suggestions add column if not exists offline_support text not null default 'unknown'
  check (offline_support in ('offline', 'online', 'unknown'));
