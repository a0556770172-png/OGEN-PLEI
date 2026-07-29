import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { extractApkIcon } from "@/lib/extractIcon";

// חילוץ APK יכול לקחת כמה שניות טובות עבור קבצים גדולים (עד 100MB אצל מפתחי PRO).
// שימו לב: אם הפרויקט ב-Vercel נמצא בתוכנית Hobby, פונקציות serverless מוגבלות שם
// ל-10 שניות בפועל בלי קשר לערך הזה בקוד - במקרה כזה יש לשדרג ל-Vercel Pro (עד 60 שניות)
// או להקטין את גודל הקבצים הנתמכים לחילוץ אוטומטי.
export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  if (profile.role !== "developer" && profile.role !== "admin") {
    return NextResponse.json({ error: "רק חשבון מפתח יכול לחלץ אייקון" }, { status: 403 });
  }

  const { fileKey } = await request.json();
  if (!fileKey || typeof fileKey !== "string") {
    return NextResponse.json({ error: "חסר מזהה קובץ" }, { status: 400 });
  }

  // אבטחה: מוודאים שהקובץ באמת שייך למפתח המבקש (המפתחות תמיד בפורמט apps/{userId}/...)
  if (!fileKey.startsWith(`apps/${user.id}/`)) {
    return NextResponse.json({ error: "אין הרשאה לקובץ הזה" }, { status: 403 });
  }

  const result2 = await extractApkIcon(fileKey, user.id);
  return NextResponse.json(result2);
}
