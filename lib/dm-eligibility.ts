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

// חשבון PRO, מנהל בפועל, או צוות פיקוח - מקבלים את הצ'אט פתוח תמיד, בלי קשר לכמות
// האפליקציות/הצעות שהעלו (הם כבר הוכיחו את עצמם/ממלאים תפקיד באתר).
export async function isDmUnlocked(userId: string): Promise<boolean> {
  const admin = createAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("role, is_pro, is_moderator").eq("id", userId).single();
  if (profile?.role === "admin" || profile?.is_moderator || profile?.is_pro) return true;
  return (await getDeveloperContributionCount(userId)) >= DM_UNLOCK_THRESHOLD;
}
