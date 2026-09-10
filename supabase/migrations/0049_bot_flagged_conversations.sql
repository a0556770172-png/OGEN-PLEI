-- סימון שיחות בוט שבהן זוהה ניסיון להסיט את השיחה (jailbreak / חילוץ פרומפט / הסטה מכוונת).
-- השיחה נשמרת (לא נמחקת) כדי שהמנהל יוכל לגשת אליה מפאנל הבוט.
alter table public.bot_conversations add column if not exists flagged_at timestamptz;
alter table public.bot_conversations add column if not exists flagged_reason text;
create index if not exists bot_conversations_flagged_idx on public.bot_conversations (flagged_at desc) where flagged_at is not null;
