import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/push";
import { MAX_SUGGESTION_MB } from "@/lib/constants";
import { consumeOversizeGrant } from "@/lib/uploadQuota";
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
    minAndroidVersion,
    offlineSupport
  } = await request.json().catch(() => ({}));
  // ראו הסבר זהה ב-app/api/apps/finalize/route.ts
  const validOfflineSupport = ["offline", "online", "unknown"].includes(offlineSupport) ? offlineSupport : "unknown";

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
    min_android_version: minAndroidVersion.trim(),
    offline_support: validOfflineSupport
  });

  if (error) {
    return NextResponse.json({ error: `שגיאה בשליחת ההצעה: ${error.message}` }, { status: 500 });
  }

  // אם הקובץ חרג מהמכסה הרגילה של הצעה ציבורית (200MB) - "שורפים" הרשאה אחת (קודם קרדיט
  // הפניה, ואז הרשאת אדמין חד-פעמית). לא רלוונטי אם למשתמש יש חלון "העלאה ציבורית ללא הגבלה"
  // פעיל - במקרה כזה שום דבר לא נצרך.
  const unlimitedUntil = profile.unlimited_public_upload_until
    ? new Date(profile.unlimited_public_upload_until).getTime()
    : 0;
  if (unlimitedUntil <= Date.now()) {
    await consumeOversizeGrant(profile, fileSize, MAX_SUGGESTION_MB);
  }

  notifyAdmins({ title: "הצעת אפליקציה חדשה", body: `הוצעה אפליקציה חדשה: ${appName.trim()}`, url: "/dashboard/admin" }).catch(() => {});

  return NextResponse.json({ ok: true });
}
