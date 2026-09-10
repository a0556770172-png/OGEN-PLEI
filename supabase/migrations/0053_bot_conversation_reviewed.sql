-- סימון "הצוות קרא את השיחה" בפאנל הבוט. נקבע אוטומטית בפתיחת שיחה, וניתן לסמן/לבטל
-- ידנית ("סמן הכל שקראתי" / בחירה מרובה).
alter table public.bot_conversations add column if not exists staff_reviewed_at timestamptz;
