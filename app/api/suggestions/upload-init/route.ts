import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createUploadUrl, BUCKETS } from "@/lib/r2";
import { MAX_SUGGESTION_MB } from "@/lib/constants";
import { effectiveMaxUploadMb } from "@/lib/uploadQuota";
import { isImagesBanned, IMAGES_BANNED_MESSAGE } from "@/lib/imageBan";
import { validateVideoRequest, isValidVideoKey } from "@/lib/media";

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
}

// כל משתמש מחובר יכול להעלות קובץ APK להצעת אפליקציה - זה לא סופר במכסת האפליקציות שלו,
// זה רק חומר גלם לבדיקה של הצוות, לא פרסום בחנות.

export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const { fileName, fileSize, contentType, iconFileName, iconContentType, screenshots, video } = await request.json().catch(() => ({}));
  if (video) {
    const videoErr = validateVideoRequest(video);
    if (videoErr) return NextResponse.json({ error: videoErr }, { status: 400 });
  }
  if ((iconFileName || video || (Array.isArray(screenshots) && screenshots.length)) && isImagesBanned(profile)) {
    return NextResponse.json({ error: IMAGES_BANNED_MESSAGE }, { status: 403 });
  }
  if (!fileName || !fileSize) {
    return NextResponse.json({ error: "חסרים פרטי קובץ" }, { status: 400 });
  }

  // הרשאה זמנית (מוגבלת בשעות) שמנהל נתן ב"הרשאות גודל" - כל עוד לא פגה, אין שום הגבלת
  // גודל בהצעה ציבורית בכלל (בניגוד להרשאת הגודל החד-פעמית, זו לא מוגבלת למספר מגה מסוים).
  const unlimitedUntil = profile.unlimited_public_upload_until ? new Date(profile.unlimited_public_upload_until).getTime() : 0;
  const hasUnlimitedWindow = unlimitedUntil > Date.now();

  if (!hasUnlimitedWindow) {
    // תקרת הגודל האפקטיבית - כוללת הרשאת גודל חד-פעמית שאדמין נתן וגם קרדיט חריגת 150MB
    // שנצבר מהפניות (ראו lib/uploadQuota.ts). תקפה גם כאן, בהצעה ציבורית - לא רק בהעלאה פרטית.
    const effectiveMaxMb = effectiveMaxUploadMb(profile, MAX_SUGGESTION_MB);
    const maxBytes = effectiveMaxMb * 1024 * 1024;
    if (fileSize > maxBytes) {
      return NextResponse.json({ error: `גודל הקובץ חורג מהמותר (מקסימום ${effectiveMaxMb}MB)` }, { status: 400 });
    }
  }

  const uuid = crypto.randomUUID();
  const fileKey = `suggestions/${user.id}/${uuid}-${sanitize(fileName)}`;
  const uploadUrl = await createUploadUrl(BUCKETS.apps, fileKey, contentType || "application/octet-stream");

  // אייקון - אופציונלי, בדיוק כמו בהעלאה הפרטית (ראו app/api/apps/upload-init/route.ts).
  let iconKey: string | undefined;
  let iconUploadUrl: string | undefined;
  if (iconFileName && iconContentType) {
    iconKey = `icons/${user.id}/${uuid}-${sanitize(iconFileName)}`;
    iconUploadUrl = await createUploadUrl(BUCKETS.assets, iconKey, iconContentType);
  }

  // צילומי מסך (עד 8) - נשמרים בדלי ה-assets ועוברים לאפליקציה באישור הצוות.
  const screenshotUploads: { key: string; uploadUrl: string }[] = [];
  if (Array.isArray(screenshots)) {
    for (const s of screenshots.slice(0, 8)) {
      if (!s?.fileName || !String(s?.contentType).startsWith("image/")) continue;
      const key = `screenshots/${user.id}/${crypto.randomUUID()}-${sanitize(String(s.fileName))}`;
      screenshotUploads.push({ key, uploadUrl: await createUploadUrl(BUCKETS.assets, key, s.contentType) });
    }
  }

  let videoUpload: { key: string; uploadUrl: string } | undefined;
  if (video) {
    const key = `videos/${user.id}/${uuid}-${sanitize(String(video.fileName))}`;
    videoUpload = { key, uploadUrl: await createUploadUrl(BUCKETS.assets, key, video.contentType) };
  }

  return NextResponse.json({ uploadUrl, fileKey, iconUploadUrl, iconKey, screenshotUploads, videoUpload });
}
