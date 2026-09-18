-- שליטת מנהל בהצגת כפתור הצ'אט-בוט הצף לכל המשתמשים. ברירת מחדל: מוסתר.
alter table bot_config
  add column if not exists widget_visible boolean not null default false;
