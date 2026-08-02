import { createAdminSupabase } from "./supabase/admin";

// ספירת אפליקציות/תוכנות שהמשתמש עצמו העלה (לא כולל הצעות ציבוריות - "כללית שהעלית") -
// משמש לפתיחת יכולות לייק ותגובה, ראה הספים למטה.
export async function getUploadedAppsCount(userId: string): Promise<number> {
  const admin = createAdminSupabase();
  const { count } = await admin
    .from("apps")
    .select("id", { count: "exact", head: true })
    .eq("developer_id", userId)
    .neq("status", "archived");
  return count ?? 0;
}

export const LIKE_UNLOCK_THRESHOLD = 15;
export const COMMENT_UNLOCK_THRESHOLD = 5;

// מנהל בפועל, צוות פיקוח, וחשבון PRO מקבלים לייק ותגובה פתוחים תמיד - בלי תלות בכמות
// האפליקציות שהעלו (בדיוק כמו הצ'אט בין משתמשים). מנהל יכול גם להעניק את זה ידנית למשתמש
// ספציפי דרך can_like_override/can_comment_override (טאב ניהול משתמשים).
export async function canLike(userId: string): Promise<boolean> {
  const admin = createAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, is_pro, is_moderator, can_like_override")
    .eq("id", userId)
    .single();
  if (profile?.role === "admin" || profile?.is_moderator || profile?.is_pro || profile?.can_like_override) return true;
  return (await getUploadedAppsCount(userId)) >= LIKE_UNLOCK_THRESHOLD;
}

export async function canComment(userId: string): Promise<boolean> {
  const admin = createAdminSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, is_pro, is_moderator, can_comment_override")
    .eq("id", userId)
    .single();
  if (profile?.role === "admin" || profile?.is_moderator || profile?.is_pro || profile?.can_comment_override) return true;
  return (await getUploadedAppsCount(userId)) >= COMMENT_UNLOCK_THRESHOLD;
}
