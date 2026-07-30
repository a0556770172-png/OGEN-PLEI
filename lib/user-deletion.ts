import { createAdminSupabase } from "@/lib/supabase/admin";
import { BUCKETS, deleteObject } from "@/lib/r2";

// מבצע בפועל את מחיקת המשתמש - כולל כל האפליקציות/תוכנות שהוא העלה, קבצי R2 (אפליקציות,
// אייקונים, תמונת פרופיל, קבצי הצעות), וההרשמה עצמה ב-auth. פעולה בלתי הפיכה.
// משמש גם ממחיקה ישירה ע"י מנהל, וגם מאישור בקשת מחיקה שהגיש צוות פיקוח.
export async function deleteUserCompletely(targetId: string) {
  const admin = createAdminSupabase();

  const { data: targetProfile } = await admin.from("profiles").select("id, role, avatar_key").eq("id", targetId).single();
  if (!targetProfile) {
    return { error: "המשתמש לא נמצא", status: 404 as const };
  }
  if (targetProfile.role === "admin") {
    return { error: "לא ניתן למחוק חשבון מנהל בדרך זו", status: 400 as const };
  }

  const { data: userApps } = await admin.from("apps").select("file_key, icon_key").eq("developer_id", targetId);
  const { data: userSuggestions } = await admin.from("app_suggestions").select("file_key").eq("suggested_by", targetId);

  const filesToDelete: { bucket: string; key: string }[] = [];
  for (const app of userApps ?? []) {
    if (app.file_key) filesToDelete.push({ bucket: BUCKETS.apps, key: app.file_key });
    if (app.icon_key) filesToDelete.push({ bucket: BUCKETS.assets, key: app.icon_key });
  }
  for (const sug of userSuggestions ?? []) {
    if (sug.file_key) filesToDelete.push({ bucket: BUCKETS.apps, key: sug.file_key });
  }
  if (targetProfile.avatar_key) {
    filesToDelete.push({ bucket: BUCKETS.assets, key: targetProfile.avatar_key });
  }

  await Promise.all([
    admin.from("apps").update({ reviewed_by: null }).eq("reviewed_by", targetId),
    admin.from("pro_requests").update({ resolved_by: null }).eq("resolved_by", targetId),
    admin.from("app_suggestions").update({ reviewed_by: null }).eq("reviewed_by", targetId)
  ]);

  const { error: authError } = await admin.auth.admin.deleteUser(targetId);
  if (authError) {
    return { error: `שגיאה במחיקת המשתמש: ${authError.message}`, status: 500 as const };
  }

  await Promise.all(filesToDelete.map((f) => deleteObject(f.bucket, f.key).catch(() => {})));

  return { ok: true as const };
}
