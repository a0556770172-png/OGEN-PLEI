-- טבלת הגדרות אתר גלובליות (שורה אחת בלבד) - כרגע רק דגל אחד: האם חובה לאמת מייל
-- כדי להתחבר לאתר. זהו מנגנון אכיפה שלנו בקוד (לא הגדרת Supabase Auth הפרוייקטית) -
-- כדי שהמנהל יוכל להדליק/לכבות את זה בלחיצת כפתור באתר עצמו, בלי להיכנס ללוח הבקרה
-- של Supabase בכל פעם. חשוב: יש לוודא שההגדרה "Confirm email" בפרויקט Supabase
-- (Authentication -> Providers -> Email) כבויה, אחרת Supabase עצמו יחסום התחברות
-- למשתמשים לא מאומתים גם אם הדגל כאן כבוי.
create table if not exists public.site_settings (
  id boolean primary key default true,
  require_email_verification boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint site_settings_singleton check (id)
);

insert into public.site_settings (id, require_email_verification)
values (true, false)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists site_settings_select_all on public.site_settings;
create policy site_settings_select_all on public.site_settings for select using (true);

drop policy if exists site_settings_write_admin on public.site_settings;
create policy site_settings_write_admin on public.site_settings for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
