-- ============================================================
-- עוגן פליי — פורום: סרטון מצורף לפוסט + מונה צפיות
-- video_key / video_poster_key = מפתחות בדלי ה-assets (מוגשים דרך /api/cdn), video_views = מספר צפיות.
-- הקובץ idempotent - אפשר להריץ שוב בבטחה.
-- ============================================================

alter table public.forum_posts add column if not exists video_key text;
alter table public.forum_posts add column if not exists video_poster_key text;
alter table public.forum_posts add column if not exists video_views integer not null default 0;

-- הגדלה אטומית של מונה הצפיות (נקרא מהשרת בלבד, עם service role)
create or replace function public.increment_forum_video_views(p_post uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.forum_posts
     set video_views = video_views + 1
   where id = p_post and video_key is not null
  returning video_views;
$$;

revoke all on function public.increment_forum_video_views(uuid) from public, anon, authenticated;
grant execute on function public.increment_forum_video_views(uuid) to service_role;
