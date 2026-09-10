-- דירוג "עניין/ערך" של שיחת בוט - ה-AI מדרג 1-10 כמה השיחה מעניינת/שווה עיון למנהל
-- (צורך אמיתי, פער במוצר, באג, בלבול, משתמש לא מרוצה, בקשת פיצ'ר...). מאפשר למיין
-- ולהגיע לשיחות החשובות במקום לגלול הכל.
alter table public.bot_conversations add column if not exists interest_score smallint;
alter table public.bot_conversations add column if not exists interest_note text;
alter table public.bot_conversations add column if not exists interest_scored_msgs int;
create index if not exists bot_conversations_interest_idx
  on public.bot_conversations (interest_score desc nulls last, updated_at desc);
