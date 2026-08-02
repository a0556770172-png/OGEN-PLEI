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

export async function canLike(userId: string): Promise<boolean> {
  return (await getUploadedAppsCount(userId)) >= LIKE_UNLOCK_THRESHOLD;
}

export async function canComment(userId: string): Promise<boolean> {
  return (await getUploadedAppsCount(userId)) >= COMMENT_UNLOCK_THRESHOLD;
}
