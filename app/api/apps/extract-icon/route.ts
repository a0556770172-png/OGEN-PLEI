import { NextResponse } from "next/server";
import { rm, mkdtemp } from "fs/promises";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { tmpdir } from "os";
import path from "path";
// @ts-ignore - אין טיפוסי TypeScript רשמיים לחבילה הזו
// שימוש בנקודת הכניסה הרשמית של החבילה (מזהה APK/IPA אוטומטית) במקום ייבוא פנימי לקובץ src,
// שהתברר כפחות אמין (חלק מהגרסאות/באנדלינג לא מזהות נכון את apk.js כייבוא פנימי).
import AppInfoParser from "app-info-parser";
import { requireProfile } from "@/lib/auth-helpers";
import { createDownloadUrl, createUploadUrl, BUCKETS } from "@/lib/r2";

// חילוץ APK יכול לקחת כמה שניות טובות עבור קבצים גדולים (עד 100MB אצל מפתחי PRO).
// שימו לב: אם הפרויקט ב-Vercel נמצא בתוכנית Hobby, פונקציות serverless מוגבלות שם
// ל-10 שניות בפועל בלי קשר לערך הזה בקוד - במקרה כזה יש לשדרג ל-Vercel Pro (עד 60 שניות)
// או להקטין את גודל הקבצים הנתמכים לחילוץ אוטומטי.
export const maxDuration = 60;
export const runtime = "nodejs";

// עוזר: מוריד קובץ מ-R2 ישירות בזרימה (stream) לדיסק הזמני של הפונקציה, בלי לטעון
// את כל הקובץ לזיכרון פעמיים (unit8array + Buffer.from) כמו שהיה קודם - חשוב במיוחד
// לקבצי APK גדולים כדי לא לפגוע בביצועים/בזיכרון הפונקציה.
async function downloadToTempFile(url: string, destPath: string) {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`הורדת הקובץ מהאחסון נכשלה (קוד ${res.status})`);
  }
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(destPath));
}

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

  if (!fileKey.toLowerCase().endsWith(".apk")) {
    return NextResponse.json({ iconKey: null, reason: "not-apk" });
  }

  let tempDir: string | null = null;
  let stage = "init";
  try {
    stage = "download";
    const downloadUrl = await createDownloadUrl(BUCKETS.apps, fileKey);
    tempDir = await mkdtemp(path.join(tmpdir(), "ogenplay-apk-"));
    const apkPath = path.join(tempDir, "app.apk");
    await downloadToTempFile(downloadUrl, apkPath);

    stage = "parse";
    const parser = new AppInfoParser(apkPath);
    const parsed = await parser.parse();

    if (!parsed?.icon || typeof parsed.icon !== "string" || !parsed.icon.startsWith("data:")) {
      // סיבה שכיחה: אפליקציות מודרניות רבות משתמשות ב"אייקון אדפטיבי" (שכבות XML נפרדות
      // של רקע+חזית) במקום קובץ PNG בודד למגירת האפליקציות - הספרייה הזו לא יודעת עדיין
      // להרכיב אייקון כזה לתמונה אחת, ולכן לא תמיד תמצא אייקון גם באפליקציה תקינה לגמרי.
      return NextResponse.json({ iconKey: null, reason: "no-icon-found" });
    }

    stage = "decode";
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(parsed.icon);
    if (!match) {
      return NextResponse.json({ iconKey: null, reason: "unsupported-icon-format" });
    }
    const [, mimeType, base64Data] = match;
    const iconBuffer = Buffer.from(base64Data, "base64");

    stage = "upload";
    const extension = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "png";
    const iconKey = `icons/${user.id}/${crypto.randomUUID()}-auto-extracted.${extension}`;
    const uploadUrl = await createUploadUrl(BUCKETS.assets, iconKey, mimeType);

    const putRes = await fetch(uploadUrl, { method: "PUT", body: iconBuffer, headers: { "Content-Type": mimeType } });
    if (!putRes.ok) {
      return NextResponse.json({ iconKey: null, reason: "icon-upload-failed", detail: `R2 PUT status ${putRes.status}` });
    }

    return NextResponse.json({ iconKey, appName: parsed.name, versionName: parsed.versionName });
  } catch (err: any) {
    // חילוץ אייקון הוא נוחות בלבד — אף פעם לא מכשילים את כל תהליך ההעלאה בגללו.
    // חושפים גם את השלב שבו נכשל (stage) וגם את הודעת השגיאה המדויקת - כדי שאם זה עדיין
    // נכשל בפרודקשן, אפשר יהיה לאבחן בדיוק איפה ולמה, במקום הודעת "נכשל" כללית שמסתירה הכל.
    return NextResponse.json({
      iconKey: null,
      reason: "parse-error",
      detail: `[${stage}] ${String(err?.message || err)}`
    });
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
