import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { deleteUserCompletely } from "@/lib/user-deletion";
import { logAudit } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;

  if (!isStaff(profile)) {
    return NextResponse.json({ error: "רק צוות יכול לנהל משתמשים" }, { status: 403 });
  }
  if (params.id === profile.id) {
    return NextResponse.json({ error: "לא ניתן לבצע פעולה זו על החשבון שלך" }, { status: 400 });
  }

  const { action, username, sizeOverrideMb, hours } = await request.json();

  // פעולות אלה (מינוי/הדחה מפיקוח, מתן/הסרת PRO, מתן הרשאת קבצים, עריכת פרטי משתמש) הן
  // בסמכות מנהל בפועל בלבד - גם חבר צוות פיקוח שרואה את המסך הזה לא יכול לבצע אותן.
  // הרשאת גודל (set_size_override/clear_size_override) פתוחה גם לצוות פיקוח - אבל עם
  // תקרה נמוכה יותר (1GB), שנאכפת בהמשך למטה. מנהל בפועל ללא הגבלה.
  const adminOnlyActions = [
    "promote_moderator", "demote_moderator", "make_pro", "remove_pro", "grant_attachments", "revoke_attachments", "edit_profile",
    "grant_like", "revoke_like", "grant_comment", "revoke_comment",
    "set_unlimited_public_upload", "clear_unlimited_public_upload"
  ];
  if (adminOnlyActions.includes(action) && profile.role !== "admin") {
    return NextResponse.json({ error: "רק מנהל בפועל יכול לבצע פעולה זו" }, { status: 403 });
  }

  const admin = createAdminSupabase();

  if (action === "edit_profile") {
    const trimmed = typeof username === "string" ? username.trim() : "";
    if (trimmed.length < 3) {
      return NextResponse.json({ error: "שם המשתמש חייב להכיל לפחות 3 תווים" }, { status: 400 });
    }
    const { count: taken } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("username", trimmed)
      .neq("id", params.id);
    if ((taken ?? 0) > 0) {
      return NextResponse.json({ error: "שם המשתמש הזה כבר תפוס" }, { status: 400 });
    }
    const { data: before } = await admin.from("profiles").select("username").eq("id", params.id).single();
    const { error: updateError } = await admin.from("profiles").update({ username: trimmed }).eq("id", params.id);
    if (updateError) return NextResponse.json({ error: "שגיאה בעדכון שם המשתמש" }, { status: 500 });

    await logAudit({
      actorId: profile.id,
      action: "edit_user_profile",
      targetType: "user",
      targetId: params.id,
      targetLabel: trimmed,
      meta: { from: before?.username ?? null, to: trimmed },
      undoable: false
    });
    return NextResponse.json({ ok: true });
  }

  // הרשאת גודל חד-פעמית: מנהל/צוות פיקוח קובעים למשתמש ספציפי מכסת קובץ חריגה לפעם אחת
  // בלבד (למשל 300 או 500 מגה) - זה נבדק ומנוצל/מתבטל אוטומטית ב-app/api/apps/finalize/route.ts
  // וב-app/api/suggestions/route.ts, ברגע שהמשתמש בפועל מעלה קובץ שחורג מהמכסה הרגילה שלו.
  // צוות פיקוח מוגבל לתקרה של 1GB (1024MB) - מנהל בפועל ללא הגבלה (רק בדיקת שפיות בסיסית).
  if (action === "set_size_override") {
    const mb = Number(sizeOverrideMb);
    const staffCapMb = 1024;
    // 1,000,000MB (כ-1TB) זה לא באמת "הגבלה" למנהל - רק הגנה בסיסית מפני הקלדה שגויה/עמודת
    // מספרים שלמים שתתפוצץ.
    if (!Number.isFinite(mb) || mb <= 0 || mb > 1_000_000) {
      return NextResponse.json({ error: "יש להזין גודל תקין במגה-בייט" }, { status: 400 });
    }
    if (profile.role !== "admin" && mb > staffCapMb) {
      return NextResponse.json({ error: `צוות פיקוח יכול לאשר עד ${staffCapMb}MB (1GB) בלבד - מעל זה נדרש אישור מנהל בפועל` }, { status: 403 });
    }
    const { data: targetForLabel } = await admin.from("profiles").select("username").eq("id", params.id).single();
    const { error: updateError } = await admin.from("profiles").update({ size_override_mb: Math.round(mb) }).eq("id", params.id);
    if (updateError) return NextResponse.json({ error: "שגיאה בעדכון הרשאת הגודל" }, { status: 500 });

    await logAudit({
      actorId: profile.id,
      action: "grant_size_override",
      targetType: "user",
      targetId: params.id,
      targetLabel: targetForLabel?.username ?? null,
      meta: { sizeOverrideMb: Math.round(mb) },
      undoable: false
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "clear_size_override") {
    const { data: targetForLabel } = await admin.from("profiles").select("username").eq("id", params.id).single();
    const { error: updateError } = await admin.from("profiles").update({ size_override_mb: null }).eq("id", params.id);
    if (updateError) return NextResponse.json({ error: "שגיאה בביטול הרשאת הגודל" }, { status: 500 });

    await logAudit({
      actorId: profile.id,
      action: "revoke_size_override",
      targetType: "user",
      targetId: params.id,
      targetLabel: targetForLabel?.username ?? null,
      undoable: false
    });
    return NextResponse.json({ ok: true });
  }

  // הרשאה זמנית (מוגבלת בשעות, לא חד-פעמית): מנהל בפועל בלבד קובע למשתמש ספציפי אפשרות
  // להעלות הצעת אפליקציה ציבורית (suggest-app) בכל גודל שהוא, ללא שום הגבלת מגה-בייט,
  // למשך מספר שעות שהוא בוחר - נבדק ב-app/api/suggestions/upload-init/route.ts. בניגוד
  // ל-size_override_mb זו לא חד-פעמית וגם לא רלוונטית להעלאה הפרטית מדשבורד המפתח.
  if (action === "set_unlimited_public_upload") {
    const h = Number(hours);
    if (!Number.isFinite(h) || h <= 0 || h > 24 * 30) {
      return NextResponse.json({ error: "יש להזין מספר שעות תקין (עד 720, כלומר חודש)" }, { status: 400 });
    }
    const until = new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
    const { data: targetForLabel } = await admin.from("profiles").select("username").eq("id", params.id).single();
    const { error: updateError } = await admin.from("profiles").update({ unlimited_public_upload_until: until }).eq("id", params.id);
    if (updateError) return NextResponse.json({ error: "שגיאה בעדכון ההרשאה" }, { status: 500 });

    await logAudit({
      actorId: profile.id,
      action: "grant_unlimited_public_upload",
      targetType: "user",
      targetId: params.id,
      targetLabel: targetForLabel?.username ?? null,
      meta: { hours: h, until },
      undoable: false
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "clear_unlimited_public_upload") {
    const { data: targetForLabel } = await admin.from("profiles").select("username").eq("id", params.id).single();
    const { error: updateError } = await admin.from("profiles").update({ unlimited_public_upload_until: null }).eq("id", params.id);
    if (updateError) return NextResponse.json({ error: "שגיאה בביטול ההרשאה" }, { status: 500 });

    await logAudit({
      actorId: profile.id,
      action: "revoke_unlimited_public_upload",
      targetType: "user",
      targetId: params.id,
      targetLabel: targetForLabel?.username ?? null,
      undoable: false
    });
    return NextResponse.json({ ok: true });
  }

  // תיקון באג חמור: חבר צוות פיקוח הצליח לחסום את חשבון המנהל בפועל, מה שנועל אותו
  // מחוץ לאתר. חשבון מנהל (role === "admin") מוגן לחלוטין מפעולות חסימה/הדחה של כל אחד -
  // כולל מנהל אחר, אם יש כזה - בלי יוצא מן הכלל.
  if (action === "ban") {
    const { data: targetProfile } = await admin.from("profiles").select("role").eq("id", params.id).single();
    if (targetProfile?.role === "admin") {
      return NextResponse.json({ error: "לא ניתן לחסום חשבון מנהל בפועל" }, { status: 403 });
    }
  }

  const patch: Record<string, any> = {};
  switch (action) {
    // חסימה/הסרת חסימה - גם צוות פיקוח יכול לבצע, לא רק מנהל.
    case "ban": patch.banned = true; break;
    case "unban": patch.banned = false; break;
    // פיקוח הוא דגל נוסף על גבי התפקיד הבסיסי (לא דורס אותו) - כך שמפתח שהתמנה לצוות
    // פיקוח לא מאבד את מעמד המפתח שלו (הגישה לאזור המפתח והאפליקציות שלו).
    case "promote_moderator": patch.is_moderator = true; break;
    case "demote_moderator": patch.is_moderator = false; break;
    case "make_pro": patch.is_pro = true; patch.pro_status = "approved"; break;
    case "remove_pro": patch.is_pro = false; patch.pro_status = "none"; break;
    case "grant_attachments": patch.can_send_attachments = true; break;
    case "revoke_attachments": patch.can_send_attachments = false; break;
    // מתן/שלילה ידניים של הרשאת לייק/תגובה למשתמש ספציפי, גם אם עוד לא הגיע לסף
    // האפליקציות שדרוש בדרך כלל (ראו lib/engagement-eligibility.ts).
    case "grant_like": patch.can_like_override = true; break;
    case "revoke_like": patch.can_like_override = false; break;
    case "grant_comment": patch.can_comment_override = true; break;
    case "revoke_comment": patch.can_comment_override = false; break;
    default:
      return NextResponse.json({ error: "פעולה לא חוקית" }, { status: 400 });
  }

  const { data: targetForLabel } = await admin.from("profiles").select("username").eq("id", params.id).single();
  const { error } = await admin.from("profiles").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: "שגיאה בעדכון המשתמש" }, { status: 500 });

  if (action === "ban" || action === "unban") {
    await logAudit({
      actorId: profile.id,
      action: action === "ban" ? "ban_user" : "unban_user",
      targetType: "user",
      targetId: params.id,
      targetLabel: targetForLabel?.username ?? null,
      undoable: true
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;

  if (!isStaff(profile)) {
    return NextResponse.json({ error: "רק צוות יכול למחוק משתמשים" }, { status: 403 });
  }
  if (params.id === profile.id) {
    return NextResponse.json({ error: "לא ניתן למחוק את החשבון שלך" }, { status: 400 });
  }

  // מנהל בפועל בלבד יכול למחוק מיידית. חבר צוות פיקוח (לא מנהל) שמגיע לנתיב הזה
  // מקבל שגיאה מפורשת שמכוונת אותו לבקש מחיקה במקום - זה נאכף גם ב-UI (הכפתור שונה).
  if (profile.role !== "admin") {
    return NextResponse.json(
      { error: "צוות פיקוח לא יכול למחוק משתמש ישירות - יש להגיש בקשת מחיקה לאישור מנהל" },
      { status: 403 }
    );
  }

  const outcome = await deleteUserCompletely(params.id);
  if ("error" in outcome) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  return NextResponse.json({ ok: true });
}
