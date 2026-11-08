-- ביצועים: מחיקת אינדקסים כפולים, הוספת אינדקסים חסרים, וחיפוש טקסט מהיר (pg_trgm).
-- כל השינויים כאן הם רק מבנה (DDL) - אין שינוי בנתונים או בהתנהגות השאילתות, רק במהירות שלהן.

-- --- אינדקסים כפולים (זהים ב-100% לאינדקס אחר על אותה עמודה) - תוספת מיגרציות קודמות
-- שלא בדקו מה כבר קיים. כל INSERT/UPDATE על הטבלאות האלה היה מתחזק אינדקס מיותר בחינם.
drop index if exists public.apps_developer_id_idx;
drop index if exists public.tickets_assigned_staff_idx;
drop index if exists public.tickets_user_id_idx;
-- אינדקס ASC רגיל על (user_id, created_at) משרת היטב גם מיון DESC (סקירה לאחור) -
-- אומת ב-EXPLAIN שהתוכנית לא השתנתה אחרי המחיקה.
drop index if exists public.download_events_user_created_desc_idx;

-- --- אינדקסים חסרים על שאילתות חמות בלי אינדקס מתאים בכלל ---

-- council_threads: נבדק ב-WHERE status='open' AND auto_approved=true בכל טעינה של
-- דשבורד אדמין/מנהל-קהילה (lib/admin-data.ts) - לא היה שום אינדקס מעבר למפתח הראשי.
create index if not exists council_threads_status_idx
  on public.council_threads (status, auto_approved);

-- site_review_likes: נבדק ב-WHERE user_id=... (lib/siteReviews.ts getMyLikedReviews),
-- אבל האינדקס הייחודי הקיים הוא (review_id, user_id) - user_id הוא עמודה שנייה שם,
-- אז חיפוש לפי user_id בלבד לא יכול להשתמש בו ביעילות.
create index if not exists site_review_likes_user_idx
  on public.site_review_likes (user_id);

-- --- חיפוש טקסט מהיר (app/api/apps/search) ---
-- החיפוש עושה ILIKE '%...%' (וילדקארד מוביל) על name/short_description/description_html -
-- אי אפשר להשתמש באינדקס B-tree רגיל לזה, אז זו הייתה סריקה מלאה של הטבלה בכל חיפוש,
-- כולל העמודה הכבדה ביותר (description_html, עד כמה מגה-בייט לפי ההערות בקוד).
-- שלושה אינדקסי GIN+trigram, אחד לכל עמודה - תואם בדיוק לצורת ה-.or(ilike,ilike,ilike)
-- הקיימת בקוד (app/api/apps/search/route.ts), Postgres משלב אותם אוטומטית ב-BitmapOr.
-- בלי צורך בשום שינוי קוד.
create extension if not exists pg_trgm;
create index if not exists apps_name_trgm_idx on public.apps using gin (name gin_trgm_ops);
create index if not exists apps_short_description_trgm_idx on public.apps using gin (short_description gin_trgm_ops);
create index if not exists apps_description_html_trgm_idx on public.apps using gin (description_html gin_trgm_ops);
