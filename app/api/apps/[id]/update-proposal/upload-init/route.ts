import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createUploadUrl, BUCKETS } from "@/lib/r2";
import { MAX_SUGGESTION_MB } from "@/lib/constants";
import { effectiveMaxUploadMb } from "@/lib/uploadQuota";

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
}

// "עדכן את האפליקציה" - כל משתמש מחובר יכול להעלות גרסה חדשה לאפליקציה ציבורית מאושרת.
// שלב 1: קישור חתום להעלאת הקובץ (והאייקון). הגרסה נשמרת כהצעה עד אישור הצוות (ראו finalize).
// מכסת הגודל - של המעלה עצמו (הוא זה שיהפוך לבעלים), כמו בהצעת אפליקציה ציבורית.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const admin = createAdminSupabase();
  const { data: app } = await admin.from("apps").select("id, status, source").eq("id", params.id).single();
  if (!app) return NextResponse.json({ error: "האפליקציה לא נמצאה" }, { status: 404 });
  if (app.status !== "approved" || app.source !== "public_suggestion") {
    return NextResponse.json({ error: "אפשר לעדכן כך רק אפליקציה ציבורית שמפורסמת בחנות" }, { status: 403 });
  }

  const { fileName, fileSize, contentType, iconFileName, iconContentType } = await request.json().catch(() => ({}));
  if (!fileName || !fileSize) {
    return NextResponse.json({ error: "חסרים פרטי קובץ" }, { status: 400 });
  }

  const unlimitedUntil = profile.unlimited_public_upload_until ? new Date(profile.unlimited_public_upload_until).getTime() : 0;
  if (unlimitedUntil <= Date.now()) {
    const effectiveMaxMb = effectiveMaxUploadMb(profile, MAX_SUGGESTION_MB);
    if (fileSize > effectiveMaxMb * 1024 * 1024) {
      return NextResponse.json({ error: `גודל הקובץ חורג מהמותר (מקסימום ${effectiveMaxMb}MB)` }, { status: 400 });
    }
  }

  const uuid = crypto.randomUUID();
  const fileKey = `apps/${user.id}/${uuid}-${sanitize(fileName)}`;
  const uploadUrl = await createUploadUrl(BUCKETS.apps, fileKey, contentType || "application/octet-stream");

  let iconKey: string | undefined;
  let iconUploadUrl: string | undefined;
  if (iconFileName && iconContentType) {
    iconKey = `icons/${user.id}/${uuid}-${sanitize(iconFileName)}`;
    iconUploadUrl = await createUploadUrl(BUCKETS.assets, iconKey, iconContentType);
  }

  return NextResponse.json({ uploadUrl, fileKey, iconUploadUrl, iconKey });
}
