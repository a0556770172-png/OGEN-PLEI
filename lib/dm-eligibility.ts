import { createAdminSupabase } from "./supabase/admin";

// צ'אט בין משתמשים נפתח אוטומטית למי שהגיע ל-10 אפליקציות/תוכנות "שלו" במאגר, כאשר
// הספירה כוללת גם אפליקציות שהעלה בעצמו (כמפתח) וגם הצעות ציבוריות שלו שאושרו -
// שני המקורות מתחברים יחד לאותו סכום.
export const DM_UNLOCK_THRESHOLD = 10;

export async function getDeveloperContributionCount(userId: string): Promise<number> {
  const admin = createAdminSupabase();
  const [{ count: uploadedCount }, { count: suggestedCount }] = await Promise.all([
    admin.from("apps").select("id", { count: "exact", head: true }).eq("developer_id", userId).neq("status", "archived"),
    admin.from("app_suggestions").select("id", { count: "exact", head: true }).eq("suggested_by", userId).eq("status", "approved")
  ]);
  return (uploadedCount ?? 0) + (suggestedCount ?? 0);
}

export async function isDmUnlocked(userId: string): Promise<boolean> {
  return (await getDeveloperContributionCount(userId)) >= DM_UNLOCK_THRESHOLD;
}
