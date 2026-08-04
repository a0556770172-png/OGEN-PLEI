import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
  const { name, shortDescription, descriptionHtml, version, category, fileKey, fileName, fileSize, iconKey, minAndroidVersion, offlineSupport } = body;
  // "אופליין / אונליין / לא ידוע" - נשאל תמיד באותה חלונית אישור כמו שאלת הנטפרי; אם משום
  // מה לא הגיע ערך תקין (למשל מטופס ישן שעוד לא עודכן), נופלים חזרה ל"לא ידוע" בלי להכשיל
  // את ההעלאה כולה בגלל זה.
  const validOfflineSupport = ["offline", "online", "unknown"].includes(offlineSupport) ? offlineSupport : "unknown";

  if (!name || !fileKey || !fileName || !fileSize) {
    return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });
  }
  if (!version || !String(version).trim()) {
    return NextResponse.json({ error: "חובה למלא את מספר הגרסה" }, { status: 400 });
  }
  // חובה לציין גרסת אנדרואיד מינימלית נדרשת בכל העלאה - כדי שמשתמשים ידעו מראש אם
  // המכשיר שלהם תואם, לפני שהם מורידים.
  if (!minAndroidVersion || !String(minAndroidVersion).trim()) {
    return NextResponse.json({ error: "חובה לציין גרסת אנדרואיד מינימלית נדרשת" }, { status: 400 });
  }

  const plan = profile.is_pro ? LIMITS.pro : LIMITS.free;
  // הרשאת גודל חד-פעמית שמנהל נתן למשתמש הזה (ראו app/api/admin/users/[id]/route.ts) -
  // אם קיימת וגדולה מהמכסה הרגילה שלו, היא זו שקובעת את התקרה האפקטיבית להעלאה הזו בלבד.
  const sizeOverrideMb = profile.size_override_mb ?? null;
  const effectiveMaxMb = sizeOverrideMb && sizeOverrideMb > plan.maxFileMb ? sizeOverrideMb : plan.maxFileMb;
  const maxBytes = effectiveMaxMb * 1024 * 1024;
  if (fileSize > maxBytes) {
    return NextResponse.json({ error: `גודל הקובץ חורג מהמותר (מקסימום ${effectiveMaxMb}MB)` }, { status: 400 });
  }
  // ההרשאה נוצלת בפועל רק אם הקובץ שהועלה באמת חרג מהמכסה הרגילה - אם המשתמש מעלה בכל
  // זאת קובץ בתוך המכסה הרגילה שלו, ההרשאה החד-פעמית נשארת זמינה לשימוש הבא.
  const usedSizeOverride = sizeOverrideMb && sizeOverrideMb > plan.maxFileMb && fileSize > plan.maxFileMb * 1024 * 1024;

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
      min_android_version: String(minAndroidVersion).trim(),
      offline_support: validOfflineSupport,
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

  // ההעלאה הזו ניצלה בפועל את הרשאת הגודל החד-פעמית - מבטלים אותה כדי שלא ניתן יהיה
  // להשתמש בה שוב בלי אישור ידני חדש מהמנהל.
  if (usedSizeOverride) {
    await admin.from("profiles").update({ size_override_mb: null }).eq("id", user.id);
  }

  // חשוב במיוחד כשמנהל מעלה ומאושר מיידית: בלי זה, הפרופיל הציבורי שלו (/users/[id]) יכול
  // להציג עותק ישן מה-Router Cache של Next.js ולא להראות את מה שהוא בדיוק העלה.
  if (initialStatus === "approved") {
    revalidatePath("/");
    revalidatePath(`/apps/${app.id}`);
    revalidatePath("/users");
    revalidatePath(`/users/${user.id}`);
  }

  return NextResponse.json({ app });
}
