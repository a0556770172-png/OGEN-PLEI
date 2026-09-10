-- איפוס סיסמה בשאלת אבטחה (במקום מייל). המשתמש קובע שאלה + תשובה כשהוא מחובר;
-- התשובה נשמרת מוצפנת (scrypt + salt), לעולם לא כטקסט גלוי.
alter table public.profiles add column if not exists security_question text;
alter table public.profiles add column if not exists security_answer_hash text;

-- הרחבת סוגי הרשומות בטבלת בקשות האיפוס: 'question_attempt' = ניסיון תשובה שגוי (לספירת נעילה).
alter table public.password_reset_requests drop constraint if exists password_reset_requests_kind_check;
alter table public.password_reset_requests
  add constraint password_reset_requests_kind_check
  check (kind in ('email_sent', 'escalation', 'question_attempt'));
