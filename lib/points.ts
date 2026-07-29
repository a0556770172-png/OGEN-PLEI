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
