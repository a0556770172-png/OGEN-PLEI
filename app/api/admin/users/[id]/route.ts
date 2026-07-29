import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { BUCKETS, deleteObject } from "@/lib/r2";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;

  if (profile.role !== "admin") {
    return NextResponse.json({ error: "רק מנהל יכול לנהל משתמשים" }, { status: 403 });
  }
  if (params.id === profile.id) {
    return NextResponse.json({ error: "לא ניתן לבצע פעולה זו על החשבון שלך" }, { status: 400 });
  }

  const { action } = await request.json();
  const admin = createAdminSupabase();

  const patch: Record<string, any> = {};
  switch (action) {
    case "ban": patch.banned = true; break;
    case "unban": patch.banned = false; break;
    // פיקוח הוא דגל נוסף על גבי התפקיד הבסיסי (לא דורס אותו) - כך שמפתח שהתמנה לצוות
    // פיקוח לא מאבד את מעמד המפתח שלו (הגישה לאזור המפתח והאפליקציות שלו).
    case "promote_moderator": patch.is_moderator = true; break;
    case "demote_moderator": patch.is_moderator = false; break;
    case "make_pro": patch.is_pro = true; patch.pro_status = "approved"; break;
    case "remove_pro": patch.is_pro = false; patch.pro_status = "none"; break;
    default:
      return NextResponse.json({ error: "פעולה לא חוקית" }, { status: 400 });
  }

  const { error } = await admin.from("profiles").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: "שגיאה בעדכון המשתמש" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// מחיקת משתמש לגמרי מהמערכת - כולל כל האפליקציות/תוכנות שהוא העלה, קבצי R2 (אפליקציות,
// אייקונים, תמונת פרופיל, קבצי הצעות), וההרשמה עצמה ב-auth. פעולה בלתי הפיכה, מנהל בלבד.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;

  if (profile.role !== "admin") {
    return NextResponse.json({ error: "רק מנהל יכול למחוק משתמשים" }, { status: 403 });
  }
  if (params.id === profile.id) {
    return NextResponse.json({ error: "לא ניתן למחוק את החשבון שלך" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const targetId = params.id;

  const { data: targetProfile } = await admin.from("profiles").select("id, role, avatar_key").eq("id", targetId).single();
  if (!targetProfile) {
    return NextResponse.json({ error: "המשתמש לא נמצא" }, { status: 404 });
  }
  if (targetProfile.role === "admin") {
    return NextResponse.json({ error: "לא ניתן למחוק חשבון מנהל אחר בדרך זו" }, { status: 400 });
  }

  // שלב 1: איסוף כל קבצי ה-R2 שיש לנקות (אפליקציות/תוכנות שהעלה, תמונת פרופיל, קבצי הצעות)
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

  // שלב 2: איפוס עמודות ייחוס שאינן נמחקות אוטומטית (reviewed_by / resolved_by) כדי
  // למנוע שגיאת מפתח זר כשהמשתמש הזה שימש בעבר כסוקר/מאשר (למשל היה בעבר בצוות פיקוח)
  await Promise.all([
    admin.from("apps").update({ reviewed_by: null }).eq("reviewed_by", targetId),
    admin.from("pro_requests").update({ resolved_by: null }).eq("resolved_by", targetId),
    admin.from("app_suggestions").update({ reviewed_by: null }).eq("reviewed_by", targetId)
  ]);

  // שלב 3: מחיקת המשתמש מ-auth.users - זה מפעיל מחיקת מפל (cascade) של הפרופיל וכל מה
  // שמקושר אליו: apps, pro_requests, points_log, tickets, ticket_messages, app_suggestions
  const { error: authError } = await admin.auth.admin.deleteUser(targetId);
  if (authError) {
    return NextResponse.json({ error: `שגיאה במחיקת המשתמש: ${authError.message}` }, { status: 500 });
  }

  // שלב 4: מחיקת הקבצים מ-R2 (best-effort - המשתמש כבר נמחק מה-DB בכל מקרה)
  await Promise.all(
    filesToDelete.map((f) => deleteObject(f.bucket, f.key).catch(() => {}))
  );

  return NextResponse.json({ ok: true });
}
