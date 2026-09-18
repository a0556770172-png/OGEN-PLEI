-- שליטת מנהל בהצגת כפתור הפורום ("הצעות לשיפור ורעיונות") בעמוד הבית. ברירת מחדל: מוסתר.
alter table site_settings
  add column if not exists forum_button_visible boolean not null default false;
