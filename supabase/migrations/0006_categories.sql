-- ============================================================
-- עוגן פליי — טבלת קטגוריות ניתנת לניהול מהאדמין (במקום רשימה קבועה בקוד)
-- הריצו את כל הקובץ הזה ב-Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  value text unique not null,
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- זריעת הקטגוריות הקיימות (רק אם הטבלה ריקה, כדי לא לדרוס נתונים אם המיגרציה רצה שוב)
insert into public.categories (value, label, sort_order)
select v, l, o from (values
  ('general', 'כללי', 0),
  ('utilities', 'כלי עזר', 1),
  ('education', 'חינוך', 2),
  ('torah', 'תורה ויהדות', 3),
  ('productivity', 'פרודוקטיביות', 4),
  ('games', 'משחקים', 5),
  ('finance', 'פיננסים', 6),
  ('health', 'בריאות', 7)
) as seed(v, l, o)
where not exists (select 1 from public.categories);

alter table public.categories enable row level security;

drop policy if exists categories_select_all on public.categories;
create policy categories_select_all on public.categories for select using (true);

-- כתיבה/מחיקה מותרת רק למנהל בפועל (role = 'admin'), לא לצוות פיקוח רגיל
drop policy if exists categories_write_admin on public.categories;
create policy categories_write_admin on public.categories for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
