-- ============================================================
-- עוגן פליי — סינון AI לביקורות על האתר
-- כל ביקורת עם טקסט נבדקת אוטומטית ע"י Gemini. ביקורת שמסומנת כספאם/פוגענית/לא צנועה/
-- לא רלוונטית/טרול - נשמרת מוסתרת (auto_hidden) עם הסיבה, וממתינה לאישור ידני של הצוות.
-- ============================================================
alter table public.site_reviews add column if not exists auto_hidden boolean not null default false;
alter table public.site_reviews add column if not exists moderation_reason text;
