-- ============================================================
-- עוגן פליי — תיקון RLS: פיקוח הוא דגל (is_moderator), לא ערך role='moderator'
-- באג שתוקן: כל חוקי ה-RLS "צוות רואה הכל" (profiles/apps/pro_requests/points_log/tickets)
-- בדקו עד כה current_role() in ('admin','moderator') - אבל אחרי המעבר ל-is_moderator כדגל,
-- שום פרופיל לא מקבל יותר role='moderator' בפועל, ולכן פיקוח אמיתי (is_moderator=true אך
-- role='user'/'developer') לא היה רואה כלום דרך קריאות בצד הלקוח (Client-side, כפוף ל-RLS).
-- הריצו את כל הקובץ הזה ב-Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' or is_moderator from public.profiles where id = auth.uid()),
    false
  )
$$;

drop policy if exists profiles_select_staff on public.profiles;
create policy profiles_select_staff on public.profiles for select using (public.is_staff());

drop policy if exists apps_select_staff on public.apps;
create policy apps_select_staff on public.apps for select using (public.is_staff());

drop policy if exists pro_requests_select_staff on public.pro_requests;
create policy pro_requests_select_staff on public.pro_requests for select using (public.is_staff());

drop policy if exists points_log_select_staff on public.points_log;
create policy points_log_select_staff on public.points_log for select using (public.is_staff());

drop policy if exists tickets_select_staff on public.tickets;
create policy tickets_select_staff on public.tickets for select using (public.is_staff());

drop policy if exists ticket_messages_select_staff on public.ticket_messages;
create policy ticket_messages_select_staff on public.ticket_messages for select using (public.is_staff());
