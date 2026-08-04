import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/push";
import { MAX_SUGGESTION_MB } from "@/lib/constants";
import { sanitizeUserHtml } from "@/lib/sanitizeHtml";

// כל משתמש מחובר (רגיל או מפתח) יכול להציע אפליקציה פופולרית להוספה למאגר
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const {
    appName,
    version,
    note,
    shortDescription,
    descriptionHtml,
    category,
    iconKey,
    developerName,
    fileKey,
    fileName,
    fileSize,
    minAndroidVersion
  } = await request.json().catch(() => ({}));

  if (!appName?.trim()) {
    return NextResponse.json({ error: "חובה למלא את שם האפליקציה/התוכנה" }, { status: 400 });
  }
  if (!version?.trim()) {
    return NextResponse.json({ error: "חובה למלא את מספר הגרסה" }, { status: 400 });
  }
  if (!shortDescription?.trim()) {
    return NextResponse.json({ error: "חובה למלא תיאור קצר" }, { status: 400 });
  }
  // שדה חובה חדש: שם המפתח/חברת הפיתוח האמיתית של האפליקציה - קרדיט חובה למפתח המקורי.
  // אסור להעלות אפליקציות/תוכנות פרטיות של אחרים בלי לציין במפורש מי פיתח אותן בפועל.
  if (!developerName?.trim()) {
    return NextResponse.json({ error: "חובה לציין את שם המפתח/חברת הפיתוח האמיתית של האפליקציה" }, { status: 400 });
  }
  if (!fileKey || !fileName || !fileSize) {
    return NextResponse.json({ error: "חובה להעלות את קובץ ההתקנה של האפליקציה/התוכנה" }, { status: 400 });
  }
  // חובה לציין גרסת אנדרואיד מינימלית נדרשת גם בהצעת אפליקציה ציבורית, בדיוק כמו בהעלאה
  // פרטית של מפתח - כדי שמשתמשים ידעו מראש אם המכשיר שלהם תואם.
  if (!minAndroidVersion?.trim()) {
    return NextResponse.json({ error: "חובה לציין גרסת אנדרואיד מינימלית נדרשת" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { error } = await admin.from("app_suggestions").insert({
    suggested_by: user.id,
    app_name: appName.trim(),
    version: version.trim(),
    note: note?.trim() || null,
    short_description: shortDescription.trim().slice(0, 140),
    description_html: typeof descriptionHtml === "string" && descriptionHtml.trim() ? sanitizeUserHtml(descriptionHtml) : null,
    category: category?.trim() || "general",
    icon_key: iconKey || null,
    developer_name: developerName.trim(),
    file_key: fileKey,
    file_name: fileName,
    file_size_bytes: fileSize,
    min_android_version: minAndroidVersion.trim()
  });

  if (error) {
    return NextResponse.json({ error: `שגיאה בשליחת ההצעה: ${error.message}` }, { status: 500 });
  }

  // אם הקובץ שהועלה כאן בפועל חרג מהמכסה הרגילה של הצעה ציבורית (200MB) - זה סימן שנוצלה
  // הרשאת הגודל החד-פעמית שהמנהל נתן (ראו app/api/suggestions/upload-init/route.ts ו-
  // app/api/admin/users/[id]/route.ts) - מבטלים אותה כדי שלא ניתן יהיה לנצל אותה שוב.
  const sizeOverrideMb = profile.size_override_mb ?? null;
  if (sizeOverrideMb && sizeOverrideMb > MAX_SUGGESTION_MB && fileSize > MAX_SUGGESTION_MB * 1024 * 1024) {
    await admin.from("profiles").update({ size_override_mb: null }).eq("id", user.id);
  }

  notifyAdmins({ title: "הצעת אפליקציה חדשה", body: `הוצעה אפליקציה חדשה: ${appName.trim()}`, url: "/dashboard/admin" }).catch(() => {});

  return NextResponse.json({ ok: true });
}
