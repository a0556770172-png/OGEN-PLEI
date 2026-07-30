import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { addPoints } from "@/lib/points";
import { extractApkIcon } from "@/lib/extractIcon";

export const maxDuration = 60;
export const runtime = "nodejs";

const SUGGESTION_POINTS = 5;

// אישור/דחייה של הצעת אפליקציה - צוות (מנהל/פיקוח) בלבד.
// אישור מזכה את המציע ב-5 נק' (פעם אחת בלבד, גם אם מישהו ילחץ פעמיים בטעות),
// ואם הצבירה הכוללת שלו מגיעה ל-300, הוא משודרג אוטומטית ל-PRO (ראו lib/points.ts).
//
// חשוב: בעבר "אישור" כאן רק סימן את ההצעה כמאושרת והעניק נקודות - הוא לא פרסם
// שום דבר בפועל בחנות! זה בדיוק מה שגרם לבאג "אישרתי וזה לא עובר לחנות" - אישור
// הצעה מעולם לא היה אמור לפרסם את זה, זו הייתה רק "הצעה שכדאי להוסיף", לא בדיקת
// אפליקציה אמיתית. עכשיו, אם להצעה יש קובץ מצורף, אישור שלה יוצר בפועל רשומת
// אפליקציה מאושרת ומפרסמת אותה מיד בחנות - כי אישור ע"י צוות הוא כבר הבדיקה עצמה.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  if (!isStaff(profile)) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { status } = await request.json().catch(() => ({}));
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json({ error: "סטטוס לא חוקי" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: suggestion } = await admin.from("app_suggestions").select("*").eq("id", params.id).single();
  if (!suggestion) return NextResponse.json({ error: "ההצעה לא נמצאה" }, { status: 404 });

  await admin
    .from("app_suggestions")
    .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", suggestion.id);

  let createdAppId: string | null = suggestion.created_app_id ?? null;

  if (status === "approved" && !suggestion.points_awarded) {
    await admin.from("app_suggestions").update({ points_awarded: true }).eq("id", suggestion.id);
    await admin.from("points_log").insert({
      profile_id: suggestion.suggested_by,
      delta: SUGGESTION_POINTS,
      reason: "app_suggestion_approved"
    });
    await addPoints(suggestion.suggested_by, SUGGESTION_POINTS);
  }

  // יצירת האפליקציה בפועל בחנות - רק אם יש קובץ מצורף (הצעות ישנות בלי קובץ לא ניתנות
  // לפרסום אוטומטי) ורק אם עדיין לא נוצרה אפליקציה מההצעה הזו בעבר (מונע כפילות בלחיצה כפולה)
  if (status === "approved" && suggestion.file_key && suggestion.file_name && suggestion.file_size_bytes && !createdAppId) {
    // מנסים לחלץ אייקון מתוך הקובץ (רק אם זה APK) לפני יצירת הרשומה, כדי שהאפליקציה
    // תתפרסם מיד עם אייקון ולא תצטרך תיקון ידני מאוחר יותר.
    let iconKey: string | null = null;
    try {
      const iconResult = await extractApkIcon(suggestion.file_key, suggestion.suggested_by);
      if (iconResult.iconKey !== null) iconKey = iconResult.iconKey;
    } catch {
      // חילוץ אייקון הוא נוחות בלבד - לא מכשילים את פרסום האפליקציה בגללו
    }

    const { data: newApp, error: createError } = await admin
      .from("apps")
      .insert({
        developer_id: suggestion.suggested_by,
        name: suggestion.app_name,
        short_description: (suggestion.note?.trim() || suggestion.app_name).slice(0, 140),
        description_html: suggestion.note ? `<p>${suggestion.note}</p>` : "",
        version: suggestion.version?.trim() || "1.0.0",
        category: "general",
        icon_key: iconKey,
        file_key: suggestion.file_key,
        file_name: suggestion.file_name,
        file_size_bytes: suggestion.file_size_bytes,
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      })
      .select("id")
      .single();

    if (!createError && newApp) {
      createdAppId = newApp.id;
      await admin.from("app_suggestions").update({ created_app_id: newApp.id }).eq("id", suggestion.id);
      revalidatePath("/");
      revalidatePath(`/apps/${newApp.id}`);
    }
  }

  return NextResponse.json({ ok: true, createdAppId });
}
