import { createAdminSupabase } from "./supabase/admin";

// סף נקודות למתן PRO אוטומטי - כל מי שמגיע לסף הזה (מכל מקור נקודות: העלאות, הורדות,
// הצעות אפליקציות שאושרו וכו') מקבל אוטומטית שדרוג ל-PRO, גם אם אינו מפתח עדיין
// (במקרה כזה הוא פשוט "ייהנה" מהמכסה המוגברת ברגע שיהפוך למפתח).
const PRO_POINTS_THRESHOLD = 300;

export async function addPoints(profileId: string, delta: number) {
  const admin = createAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("points, is_pro").eq("id", profileId).single();
  if (!profile) return;

  const newPoints = (profile.points ?? 0) + delta;
  const patch: Record<string, any> = { points: newPoints };
  if (!profile.is_pro && newPoints >= PRO_POINTS_THRESHOLD) {
    patch.is_pro = true;
    patch.pro_status = "approved";
  }

  await admin.from("profiles").update(patch).eq("id", profileId);
}

// מוניטין על העלאה פרטית (10 - כפול מהצעה ציבורית, שמזכה ב-5) - ניתן רק כשהאפליקציה מאושרת
// (לא בזמן ההעלאה), ופעם אחת לכל
// אפליקציה: נבדק לפי שורת "upload" קיימת ב-points_log, כך שאישור חוזר (למשל אחרי ארכיון)
// או אפליקציה ישנה שכבר קיבלה מוניטין בהעלאה (לפני השינוי) לא מקבלים שוב.
export const UPLOAD_POINTS = 10;

export async function awardUploadPointsOnce(appId: string, developerId: string): Promise<boolean> {
  const admin = createAdminSupabase();
  const { count } = await admin
    .from("points_log")
    .select("id", { count: "exact", head: true })
    .eq("app_id", appId)
    .eq("reason", "upload");
  if ((count ?? 0) > 0) return false;
  await admin.from("points_log").insert({ profile_id: developerId, delta: UPLOAD_POINTS, reason: "upload", app_id: appId });
  await addPoints(developerId, UPLOAD_POINTS);
  return true;
}
