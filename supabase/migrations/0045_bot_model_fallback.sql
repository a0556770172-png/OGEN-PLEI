-- עקיפת מודל זמנית לבוט: כשהמודל המועדף נכשל (למשל 503/עומס), הבוט עובר זמנית
-- למודל אחר שעבד, ואחרי model_fallback_until הוא מנסה שוב את המודל המועדף.
-- כך "שינוי מודל אחרי בעיה" הוא זמני ולא קבוע.
alter table public.bot_config add column if not exists model_fallback text;
alter table public.bot_config add column if not exists model_fallback_until timestamptz;
