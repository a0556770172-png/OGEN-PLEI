import { createAdminSupabase } from "./supabase/admin";

// סף נקודות למתן PRO אוטומטי - כל מי שמגיע לסף הזה (מכל מקור נקודות: העלאות, הורדות,
// הצעות אפליקציות שאושרו וכו') מקבל אוטומטית שדרוג ל-PRO, גם אם אינו מפתח עדיין
// (במקרה כזה הוא פשוט "ייהנה" מהמכסה המוגברת ברגע שיהפוך למפתח).
const PRO_POINTS_THRESHOLD = 300;

export async function addPoints(profileId: string, delta: number) {
  const admin = createAdminSupabase();

  // עדכון אטומי במסד (מיגרציה 0073) - בלי אובדן עדכונים כשכמה הורדות/לייקים מגיעים יחד
  const { data: updatedPoints, error: rpcError } = await admin.rpc("add_points", { p_id: profileId, p_delta: delta });
  if (!rpcError) {
    if (typeof updatedPoints !== "number") return; // הפרופיל לא קיים
    if (updatedPoints >= PRO_POINTS_THRESHOLD) {
      await admin.from("profiles").update({ is_pro: true, pro_status: "approved" }).eq("id", profileId).eq("is_pro", false);
    }
    return;
  }

  // גיבוי (לפני המיגרציה): קריאה-חישוב-כתיבה כמו קודם
  const { data: profile } = await admin.from("profiles").select("points, is_pro").eq("id", profileId).single();
  if (!profile) return;

  // greatest(0, ...) - מוניטין לא אמור לרדת מתחת לאפס (ראו גם תיקון מקביל ב-add_points ב-DB,
  // migration 0081; הנתיב הזה הוא רק גיבוי למקרה שה-RPC עצמו לא קיים).
  const newPoints = Math.max(0, (profile.points ?? 0) + delta);
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
  // תוקן: בדיקת COUNT לפני ה-INSERT היתה check-then-act לא אטומי - שני אישורים כמעט-בו-זמניים
  // (לחיצה כפולה בטעות) יכלו שניהם לראות count=0 ושניהם להכניס שורה, כלומר 20 נקודות
  // במקום 10 להעלאה אחת. עכשיו ההגנה האמיתית היא אינדקס ייחודי חלקי ב-DB
  // (points_log_upload_once_idx, migration 0081) - ה-INSERT השני מתנגש ונכשל, לא רק נבדק.
  const { error } = await admin
    .from("points_log")
    .insert({ profile_id: developerId, delta: UPLOAD_POINTS, reason: "upload", app_id: appId });
  if (error) {
    if (error.code === "23505") return false; // כבר ניתן - "הפסדנו" במירוץ, לא שגיאה אמיתית
    throw new Error(`שגיאה ברישום מוניטין העלאה: ${error.message}`);
  }
  await addPoints(developerId, UPLOAD_POINTS);
  return true;
}
