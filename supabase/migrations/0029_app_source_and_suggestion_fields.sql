-- מקור פרסום האפליקציה: העלאה פרטית של מפתח מהדשבורד (אפשר לערוך/להעלות גרסאות חדשות)
-- מול אפליקציה שנוצרה מאישור הצעה ציבורית ע"י הצוות (לא ניתנת לעריכה בכלל ע"י המפתח -
-- ראו app/api/apps/[id]/route.ts, app/api/apps/[id]/version-upload-init/route.ts).
alter table public.apps add column if not exists source text not null default 'developer_upload';

-- שם המפתח/חברת הפיתוח האמיתית של האפליקציה (קרדיט) - בעיקר רלוונטי לאפליקציות שמקורן
-- בהצעה ציבורית, כדי שברור מי פיתח את האפליקציה בפועל (בניגוד למי שהעלה/הציע אותה לאתר).
alter table public.apps add column if not exists developer_name text;

-- השלמת שדות בהצעת אפליקציה ציבורית כדי להשוות אותה לטופס ההעלאה הפרטית: תיאור קצר/מלא,
-- קטגוריה, אייקון, ושם המפתח/חברת הפיתוח האמיתית (שדה חובה מעכשיו באפליקציה - קרדיט חובה
-- למפתח המקורי, כדי שלא יעלו אפליקציות/תוכנות פרטיות של אחרים בלי לציין את מי שפיתח אותן).
alter table public.app_suggestions add column if not exists short_description text;
alter table public.app_suggestions add column if not exists description_html text;
alter table public.app_suggestions add column if not exists category text;
alter table public.app_suggestions add column if not exists icon_key text;
alter table public.app_suggestions add column if not exists developer_name text;
