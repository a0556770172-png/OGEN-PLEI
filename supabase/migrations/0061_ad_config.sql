-- מערכת פרסומות מנוהלת: פרסומת ביניים לפני הורדה (עם תמונה/גיף ניתנים להחלפה, קישור,
-- זמן עד שכפתור הדילוג מופיע, ומגבלה יומית לצוות) + באדג' צף קבוע באתר. ראו lib/adConfig.ts.
create table if not exists public.site_ad_config (
  id boolean primary key default true,
  interstitial_enabled boolean not null default true,
  floating_enabled boolean not null default true,
  image_key text,
  link_url text not null default 'https://etgarbacheder.netlify.app/?src=ogenplai&c=%D7%A2%D7%95%D7%92%D7%9F-%D7%A4%D7%9C%D7%99%D7%99',
  skip_after_seconds int not null default 4,
  staff_daily_limit int not null default 2,
  click_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint site_ad_config_singleton check (id)
);

insert into public.site_ad_config (id) values (true) on conflict (id) do nothing;

alter table public.site_ad_config enable row level security;

-- כולם (גם לא מחוברים) צריכים לקרוא את ההגדרות כדי להציג את הפרסומת - אין בזה מידע רגיש.
drop policy if exists "site_ad_config_read" on public.site_ad_config;
create policy "site_ad_config_read" on public.site_ad_config for select using (true);
-- כתיבה רק דרך השרת (service role, ב-API של המנהל/מעקב קליקים) - אין מדיניות insert/update ללקוח.
