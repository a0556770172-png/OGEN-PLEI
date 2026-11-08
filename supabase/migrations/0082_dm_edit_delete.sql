-- צ'אט בין משתמשים: עריכה ומחיקה של הודעה על ידי השולח.
--   edited_at  - מתי ההודעה נערכה לאחרונה (מוצג למשתמשים כ"נערך").
--   deleted_at - מחיקה "רכה": ההודעה נעלמת לשני הצדדים (מוצג "ההודעה נמחקה"), אבל השורה נשארת
--                כדי שמיקום ההודעות, ספירת הלא-נקראו וצפיית הפיקוח בשיחות (לאכיפת חוקי האתר,
--                ראו app/api/admin/chat-monitor) יישארו שלמים - אחרת אפשר היה לשלוח הודעה פוגענית
--                ולמחוק אותה לפני שהפיקוח רואה.
alter table public.dm_messages add column if not exists edited_at timestamptz;
alter table public.dm_messages add column if not exists deleted_at timestamptz;
