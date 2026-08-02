import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { addPoints } from "@/lib/points";
import { LIMITS } from "@/lib/constants";
import { sanitizeUserHtml } from "@/lib/sanitizeHtml";

export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  // מנהל יכול גם הוא להעלות אפליקציות בעצמו, בדיוק כמו מפתח רגיל
  if (profile.role !== "developer" && profile.role !== "admin") {
    return NextResponse.json({ error: "רק חשבון מפתח יכול להעלות אפליקציות" }, { status: 403 });
  }

  const body = await request.json();
  const { name, shortDescription, descriptionHtml, version, category, fileKey, fileName, fileSize, iconKey } = body;

  if (!name || !fileKey || !fileName || !fileSize) {
    return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });
  }
  if (!version || !String(version).trim()) {
    return NextResponse.json({ error: "חובה למלא את מספר הגרסה" }, { status: 400 });
  }

  const plan = profile.is_pro ? LIMITS.pro : LIMITS.free;
  const maxBytes = plan.maxFileMb * 1024 * 1024;
  if (fileSize > maxBytes) {
    return NextResponse.json({ error: `גודל הקובץ חורג מהמותר (מקסימום ${plan.maxFileMb}MB)` }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { count } = await admin
    .from("apps")
    .select("id", { count: "exact", head: true })
    .eq("developer_id", user.id)
    .neq("status", "archived");

  if ((count ?? 0) >= plan.maxApps) {
    return NextResponse.json({ error: `הגעת למכסת האפליקציות המקסימלית (${plan.maxApps})` }, { status: 400 });
  }

  // מנהל בפועל שמעלה אפליקציה/תוכנה בעצמו לא צריך לעבור תור בדיקה נפרד - הוא כבר הסמכות
  // העליונה באתר, ואין טעם שיאשר לעצמו את מה שהוא כבר בדק לפני ההעלאה. מפתחים רגילים
  // (וגם צוות פיקוח שהוא לא מנהל בפועל) עדיין עוברים את תור הבדיקה הרגיל כרגיל.
  const initialStatus = profile.role === "admin" ? "approved" : "pending";

  const { data: app, error } = await admin
    .from("apps")
    .insert({
      developer_id: user.id,
      name,
      short_description: shortDescription ?? "",
      description_html: sanitizeUserHtml(descriptionHtml ?? ""),
      version: version || "1.0.0",
      category: category || "general",
      icon_key: iconKey ?? null,
      file_key: fileKey,
      file_name: fileName,
      file_size_bytes: fileSize,
      status: initialStatus,
      ...(initialStatus === "approved" ? { reviewed_by: user.id, reviewed_at: new Date().toISOString() } : {})
    })
    .select()
    .single();

  if (error || !app) {
    // חושפים את השגיאה האמיתית מ-Supabase (כמו שעשינו בהרשמה) כדי לאבחן תקלות סכימה/מסד-נתונים
    // ישירות מהמסך, בלי צורך לחפור שוב בלוגים בכל פעם שמשהו נכשל.
    return NextResponse.json(
      { error: error?.message ? `שגיאה בשמירת האפליקציה: ${error.message}` : "שגיאה בשמירת האפליקציה", code: (error as any)?.code },
      { status: 500 }
    );
  }

  const UPLOAD_POINTS = 5;
  await admin.from("points_log").insert({ profile_id: user.id, delta: UPLOAD_POINTS, reason: "upload", app_id: app.id });
  await addPoints(user.id, UPLOAD_POINTS);

  return NextResponse.json({ app });
}
