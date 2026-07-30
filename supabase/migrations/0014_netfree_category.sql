-- קטגוריה מיוחדת "מותאם נטפרי" - לאפליקציות שהמפתח מצהיר שעברו עריכה להמעטת פרסומות
-- כדי שיתאימו לגלישה מסוננת בנטפרי. נבחרת אוטומטית בהעלאה אם המפתח מסמן את הצ'קבוקס
-- המתאים בחלונית האישור, ומחליפה את הקטגוריה הרגילה שבחר (לא מתווספת בנוסף אליה).
insert into public.categories (value, label, sort_order)
select 'netfree', 'מותאם נטפרי', 100
where not exists (select 1 from public.categories where value = 'netfree');
