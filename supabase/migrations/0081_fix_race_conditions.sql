-- תיקון מירוצים (race conditions) שנמצאו בסקירת קוד: כמה endpoints בדקו "האם כבר ניתנו
-- נקודות / נוצרה אפליקציה" בשאילתת SELECT נפרדת לפני ה-UPDATE/INSERT, בלי הגנה אטומית -
-- שתי בקשות כמעט-בו-זמניות (לחיצה כפולה בטעות, או שני אנשי צוות שפועלים על אותה שורה)
-- יכולות שתיהן לעבור את הבדיקה ושתיהן לבצע את הפעולה. התיקון עצמו (בקוד) עובר ל-UPDATE
-- מותנה (.eq על המצב הקודם) ובודק אם הוא באמת השתלט על השורה; שני השינויים כאן הם
-- התמיכה במסד הנתונים לכך.

-- מונע מתן מוניטין-העלאה כפול לאותה אפליקציה (lib/points.ts awardUploadPointsOnce) - האינדקס
-- הייחודי החלקי הזה הוא ההגנה האטומית בפועל: ה-INSERT השני ייכשל בהתנגשות ייחודיות,
-- לא רק "יתעלם" מהבדיקה הקודמת. חלקי (רק reason='upload') כי סיבות אחרות יכולות
-- לחזור על עצמן באופן לגיטימי לאותה אפליקציה.
create unique index if not exists points_log_upload_once_idx
  on public.points_log (app_id)
  where reason = 'upload';

-- "נעילת" ניסיון יצירת אפליקציה מהצעה - בלי זה אין דרך אטומית למנוע משתי בקשות
-- בו-זמניות ליצור שתיהן רשומת apps חדשה לפני שאף אחת מהן הגיעה לכתוב created_app_id
-- (created_app_id עצמו נודע רק *אחרי* היצירה, אז הוא לא יכול לשמש כנעילה מוקדמת).
alter table public.app_suggestions
  add column if not exists app_creation_claimed boolean not null default false;

-- מוניטין (points) לא אמור לרדת מתחת לאפס - "greatest(0, ...)" נוסף כאן (היה רק
-- coalesce(points,0) + delta, בלי רצפה). מגן על המקרה שמשתמש כבר באפס מקבל עוד הורדת
-- נקודה (למשל בעקבות המירוץ בלייק/אנלייק שתוקן בקוד, או אדמין שמבטל הפניה שהוענקה בעבר).
create or replace function public.add_points(p_id uuid, p_delta integer)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.profiles set points = greatest(0, coalesce(points, 0) + p_delta) where id = p_id returning points;
$$;
