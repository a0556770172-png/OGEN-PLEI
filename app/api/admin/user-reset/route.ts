import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { SITE_URL } from "@/lib/siteUrl";

// איפוס סיסמה למשתמש ע"י מנהל בפועל בלבד.
// mode="link"  -> שולח לו קישור איפוס למייל הרשום.
// mode="temp"  -> קובע סיסמה זמנית ומחזיר אותה פעם אחת (למסירה בטלפון/מתמחים טופ).
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.profile.role !== "admin") return NextResponse.json({ error: "רק מנהל בפועל" }, { status: 403 });

  const { userId, mode } = await request.json().catch(() => ({}));
  if (typeof userId !== "string" || !userId || !["link", "temp"].includes(mode)) {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: target } = await admin.from("profiles").select("id, username, email").eq("id", userId).maybeSingle();
  if (!target) return NextResponse.json({ error: "המשתמש לא נמצא" }, { status: 404 });

  if (mode === "link") {
    if (!target.email) return NextResponse.json({ error: "אין מייל רשום למשתמש הזה" }, { status: 400 });
    const supabase = createServerSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(target.email, {
      redirectTo: `${SITE_URL}/auth/callback?flow=recovery`
    });
    if (error) return NextResponse.json({ error: `שגיאה בשליחה: ${error.message}` }, { status: 500 });
    await logAudit({
      actorId: result.user.id,
      action: "send_password_reset",
      targetType: "user",
      targetId: userId,
      targetLabel: target.username
    });
    return NextResponse.json({ ok: true, message: `קישור איפוס נשלח אל ${target.email}` });
  }

  // temp
  const temp = crypto.randomBytes(9).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 10) + "9a";
  const { error } = await admin.auth.admin.updateUserById(userId, { password: temp });
  if (error) return NextResponse.json({ error: `שגיאה: ${error.message}` }, { status: 500 });
  await logAudit({
    actorId: result.user.id,
    action: "set_temp_password",
    targetType: "user",
    targetId: userId,
    targetLabel: target.username
  });
  return NextResponse.json({
    ok: true,
    tempPassword: temp,
    message: `נקבעה סיסמה זמנית ל-${target.username}. מסור לו אותה, ובקש שיחליף אותה מיד אחרי הכניסה.`
  });
}
