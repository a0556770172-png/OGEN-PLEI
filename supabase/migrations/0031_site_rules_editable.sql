-- מאפשר לצוות (מנהל/פיקוח) לערוך את תוכן "חוקי האתר" מהאתר עצמו (ראו
-- components/SiteRulesEditorPanel.tsx) - כולל עיצוב עשיר (HTML מסוננת, כמו בתיאורי
-- אפליקציות). null = עדיין לא נערך ידנית, ומוצג ברירת המחדל הקבועה בקוד
-- (lib/siteRulesDefault.ts).
alter table public.site_settings add column if not exists site_rules_html text;

-- "גרסת" חוקי האתר - מספר שעולה בכל פעם שהצוות בוחר במפורש "לפרסם עדכון ולהתריע לכולם"
-- (לא בכל שמירה רגילה). ראו app/api/admin/site-rules/notify-update/route.ts.
-- כשהמספר הזה גבוה מ-site_rules_seen_version של משתמש, השער החד-פעמי (SiteRulesGate)
-- קופץ לו שוב - גם אם הוא כבר אישר בעבר גרסה ישנה יותר.
alter table public.site_settings add column if not exists site_rules_version integer not null default 1;

-- הודעה קצרה (כולל אפשרות התנצלות/הסבר) שהצוות כותב כשהוא מפרסם עדכון - מוצגת בשער
-- שקופץ שוב למי שכבר אישר גרסה קודמת, כדי שיבין למה הוא רואה את זה שוב.
alter table public.site_settings add column if not exists site_rules_update_note text;

-- מאיזו גרסה של חוקי האתר כל משתמש אישר לאחרונה (במקום שדה בוליאני יחיד) - כדי שאפשר
-- יהיה "לאפס" רק אותו, לא את כל שאר האישורים שלו באתר, כשמתפרסם עדכון לחוקים.
alter table public.profiles add column if not exists site_rules_seen_version integer not null default 0;

-- מי שכבר הספיק לאשר את הגרסה הראשונית (site_rules_accepted_at כבר מלא) מסומן כמי שראה
-- גרסה 1 - כדי שהמעבר למנגנון הגרסאות לא "יאפס" בטעות את כולם מיד עם ההעברה הזו.
update public.profiles set site_rules_seen_version = 1 where site_rules_accepted_at is not null and site_rules_seen_version = 0;
