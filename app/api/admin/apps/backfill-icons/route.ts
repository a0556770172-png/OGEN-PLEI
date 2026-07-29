import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { extractApkIcon } from "@/lib/extractIcon";

export const maxDuration = 60;
export const runtime = "nodejs";

// חילוץ אייקון "למפרע" לאפליקציות שכבר פורסמו בלי אייקון (למשל אפליקציות שאושרו לפני
// שהמנגנון הזה חובר גם לזרימת אישור הצעות). מוגבל לכמה אפליקציות בכל קריאה כדי לא לחרוג
// ממגבלת הזמן של Vercel - אפשר ללחוץ שוב כדי להמשיך אם נשארו עוד.
const BATCH_SIZE = 8;

export async function POST() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;

  if (!isStaff(profile)) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const admin = createAdminSupabase();
  const { data: candidates } = await admin
    .from("apps")
    .select("id, developer_id, file_key")
    .is("icon_key", null)
    .neq("status", "archived")
    .ilike("file_key", "%.apk")
    .limit(BATCH_SIZE);

  const list = candidates ?? [];
  const results: { id: string; ok: boolean; reason?: string; detail?: string }[] = [];

  for (const app of list) {
    try {
      const iconResult = await extractApkIcon(app.file_key, app.developer_id);
      // חשוב: הבדיקה חייבת להיות "!== null" ולא בדיקת אמת רגילה (if (iconResult.iconKey)) -
      // כי מבחינת טיפוסי TypeScript, מחרוזת ריקה היא גם היא "falsy", אז בדיקת אמת רגילה לא
      // מצליחה לצמצם (narrow) את הטיפוס באופן ודאי, וזה גרם לשגיאת קומפילציה על .reason
      // שהפילה את כל הבנייה ב-Vercel בלי שום שגיאה גלויה מלבד "Command npm run build exited with 1".
      if (iconResult.iconKey !== null) {
        await admin.from("apps").update({ icon_key: iconResult.iconKey }).eq("id", app.id);
        results.push({ id: app.id, ok: true });
      } else {
        results.push({ id: app.id, ok: false, reason: iconResult.reason, detail: iconResult.detail });
      }
    } catch (err: any) {
      results.push({ id: app.id, ok: false, reason: "exception", detail: String(err?.message || err) });
    }
  }

  if (results.some((r) => r.ok)) {
    revalidatePath("/");
  }

  const { count: remaining } = await admin
    .from("apps")
    .select("id", { count: "exact", head: true })
    .is("icon_key", null)
    .neq("status", "archived")
    .ilike("file_key", "%.apk");

  return NextResponse.json({
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok),
    remaining: remaining ?? 0
  });
}
