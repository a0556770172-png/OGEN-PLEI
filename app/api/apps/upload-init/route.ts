import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createUploadUrl, BUCKETS } from "@/lib/r2";
import { LIMITS } from "@/lib/constants";
import { effectiveMaxUploadMb } from "@/lib/uploadQuota";
import { isImagesBanned, IMAGES_BANNED_MESSAGE } from "@/lib/imageBan";
import { validateVideoRequest, isValidVideoKey } from "@/lib/media";

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
}

export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  if (profile.role !== "developer" && profile.role !== "admin") {
    return NextResponse.json({ error: "רק חשבון מפתח יכול להעלות אפליקציות" }, { status: 403 });
  }

  const body = await request.json();
  const { fileName, fileSize, contentType, iconFileName, iconContentType, screenshots, video } = body as {
    fileName: string; fileSize: number; contentType: string; iconFileName?: string; iconContentType?: string;
    screenshots?: { fileName: string; contentType: string }[];
    video?: { fileName: string; contentType: string; fileSize: number };
  };

  if (!fileName || !fileSize || !contentType) {
    return NextResponse.json({ error: "חסרים פרטי קובץ" }, { status: 400 });
  }

  if (video) {
    const videoErr = validateVideoRequest(video);
    if (videoErr) return NextResponse.json({ error: videoErr }, { status: 400 });
  }
  if ((iconFileName || video || (Array.isArray(screenshots) && screenshots.length)) && isImagesBanned(profile)) {
    return NextResponse.json({ error: IMAGES_BANNED_MESSAGE }, { status: 403 });
  }

  const plan = profile.is_pro ? LIMITS.pro : LIMITS.free;
  // תקרת הגודל האפקטיבית - כוללת הרשאת גודל חד-פעמית שאדמין נתן (size_override_mb) וגם
  // קרדיט חריגת 150MB שנצבר מהפניות. חייבים לבדוק כבר כאן, לפני יצירת קישור ההעלאה.
  const effectiveMaxMb = effectiveMaxUploadMb(profile, plan.maxFileMb);
  const maxBytes = effectiveMaxMb * 1024 * 1024;
  if (fileSize > maxBytes) {
    return NextResponse.json({ error: `גודל הקובץ חורג מהמותר (מקסימום ${effectiveMaxMb}MB)` }, { status: 400 });
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

  const uuid = crypto.randomUUID();
  const fileKey = `apps/${user.id}/${uuid}-${sanitize(fileName)}`;
  const uploadUrl = await createUploadUrl(BUCKETS.apps, fileKey, contentType);

  let iconKey: string | undefined;
  let iconUploadUrl: string | undefined;
  if (iconFileName && iconContentType) {
    iconKey = `icons/${user.id}/${uuid}-${sanitize(iconFileName)}`;
    iconUploadUrl = await createUploadUrl(BUCKETS.assets, iconKey, iconContentType);
  }

  // צילומי מסך (עד 8) - נשמרים בדלי ה-assets ומוצגים בעמוד האפליקציה.
  const screenshotUploads: { key: string; uploadUrl: string }[] = [];
  if (Array.isArray(screenshots)) {
    for (const s of screenshots.slice(0, 8)) {
      if (!s?.fileName || !s?.contentType || !String(s.contentType).startsWith("image/")) continue;
      const key = `screenshots/${user.id}/${crypto.randomUUID()}-${sanitize(s.fileName)}`;
      screenshotUploads.push({ key, uploadUrl: await createUploadUrl(BUCKETS.assets, key, s.contentType) });
    }
  }

  // סרטון הסבר (אופציונלי)
  let videoUpload: { key: string; uploadUrl: string } | undefined;
  if (video) {
    const key = `videos/${user.id}/${uuid}-${sanitize(video.fileName)}`;
    videoUpload = { key, uploadUrl: await createUploadUrl(BUCKETS.assets, key, video.contentType) };
  }

  return NextResponse.json({ uploadUrl, fileKey, iconUploadUrl, iconKey, screenshotUploads, videoUpload });
}
