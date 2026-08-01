import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { extractApkIcon } from "@/lib/extractIcon";

export const maxDuration = 60;
export const runtime = "nodejs";

// חילוץ אייקון "למפרע" לאפליקציות שכבר פורסמו בלי אייקון (למשל אפליקציות שאושרו לפני
// שהמנגנון הזה חובר גם לזרימת אישור הצעות).
//
// חשוב: אפליקציה אחת בלבד בכל קריאה, לא יותר! ב-Vercel Hobby, כל בקשת שרת מוגבלת בפועל
// ל-10 שניות בלי קשר למה שכתוב כאן בקוד. אם היינו מעבדים כמה אפליקציות ברצף בבקשה אחת,
// אפליקציה גדולה אחת שתיתקע (או כמה קטנות ביחד) הייתה גורמת לכל הבקשה "להיעלם" בלי שום
// תוצאה בכלל - זה בדיוק מה שגרם לתחושת "לא עובד בכלל / עובד רק לפעמים". עכשיו כל קריאה
// מטפלת רק באפליקציה אחת (עם טיימאאוט פנימי משלה, ראו lib/extractIcon.ts), כך שהיא כמעט
// תמיד תספיק לחזור בזמן עם תוצאה ברורה - הפאנל בצד הלקוח כבר קורא לזה שוב אוטומטית ברצף.
const BATCH_SIZE = 1;

export async function POST() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;

  if (!isStaff(profile)) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const admin = createAdminSupabase();
  const startedAt = Date.now();
  const { data: candidates } = await admin
    .from("apps")
    .select("id, name, developer_id, file_key")
    .is("icon_key", null)
    .neq("status", "archived")
    // "%.apk" לא תופס קבצי ".apks" (חבילת APK מרובת-קבצים שנפוצה בהצעות שהורדו מ-APKPure) -
    // בלעדי ה-or הזה אפליקציות כאלה נעלמות בשקט מרשימת המועמדים, בלי שום שגיאה, וזה בדיוק מה
    // שגרם ל"0 הצליחו, 0 נכשלו" אצל כל האפליקציות הישנות שהגיעו מהצעות עם קובץ .apks.
    .or("file_key.ilike.%.apk,file_key.ilike.%.apks")
    .limit(BATCH_SIZE);

  const list = candidates ?? [];
  const results: { id: string; name: string; ok: boolean; reason?: string; detail?: string; ms: number }[] = [];

  for (const app of list) {
    const appStartedAt = Date.now();
    try {
      const iconResult = await extractApkIcon(app.file_key, app.developer_id);
      // חשוב: הבדיקה חייבת להיות "!== null" ולא בדיקת אמת רגילה (if (iconResult.iconKey)) -
      // כי מבחינת טיפוסי TypeScript, מחרוזת ריקה היא גם היא "falsy", אז בדיקת אמת רגילה לא
      // מצליחה לצמצם (narrow) את הטיפוס באופן ודאי, וזה גרם לשגיאת קומפילציה על .reason
      // שהפילה את כל הבנייה ב-Vercel בלי שום שגיאה גלויה מלבד "Command npm run build exited with 1".
      if (iconResult.iconKey !== null) {
        await admin.from("apps").update({ icon_key: iconResult.iconKey }).eq("id", app.id);
        results.push({ id: app.id, name: app.name, ok: true, ms: Date.now() - appStartedAt });
      } else {
        results.push({
          id: app.id,
          name: app.name,
          ok: false,
          reason: iconResult.reason,
          detail: iconResult.detail,
          ms: Date.now() - appStartedAt
        });
      }
    } catch (err: any) {
      results.push({
        id: app.id,
        name: app.name,
        ok: false,
        reason: "exception",
        detail: String(err?.message || err),
        ms: Date.now() - appStartedAt
      });
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
    // "%.apk" לא תופס קבצי ".apks" (חבילת APK מרובת-קבצים שנפוצה בהצעות שהורדו מ-APKPure) -
    // בלעדי ה-or הזה אפליקציות כאלה נעלמות בשקט מרשימת המועמדים, בלי שום שגיאה, וזה בדיוק מה
    // שגרם ל"0 הצליחו, 0 נכשלו" אצל כל האפליקציות הישנות שהגיעו מהצעות עם קובץ .apks.
    .or("file_key.ilike.%.apk,file_key.ilike.%.apks");

  return NextResponse.json({
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok),
    results,
    remaining: remaining ?? 0,
    batchMs: Date.now() - startedAt
  });
}
