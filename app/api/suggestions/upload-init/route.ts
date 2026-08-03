import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createUploadUrl, BUCKETS } from "@/lib/r2";
import { MAX_SUGGESTION_MB } from "@/lib/constants";

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
}

// כל משתמש מחובר יכול להעלות קובץ APK להצעת אפליקציה - זה לא סופר במכסת האפליקציות שלו,
// זה רק חומר גלם לבדיקה של הצוות, לא פרסום בחנות.

export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const { fileName, fileSize, contentType } = await request.json().catch(() => ({}));
  if (!fileName || !fileSize) {
    return NextResponse.json({ error: "חסרים פרטי קובץ" }, { status: 400 });
  }

  // אותה הרשאת גודל חד-פעמית שמנהל נותן ב"הרשאות גודל" (ראו app/api/admin/users/[id]/route.ts)
  // תקפה גם כאן, בהצעת אפליקציה ציבורית - לא רק בהעלאה פרטית. אם קיימת וגדולה מהמכסה
  // הרגילה (200MB), היא זו שקובעת את התקרה האפקטיבית להעלאה הזו.
  const sizeOverrideMb = profile.size_override_mb ?? null;
  const effectiveMaxMb = sizeOverrideMb && sizeOverrideMb > MAX_SUGGESTION_MB ? sizeOverrideMb : MAX_SUGGESTION_MB;
  const maxBytes = effectiveMaxMb * 1024 * 1024;
  if (fileSize > maxBytes) {
    return NextResponse.json({ error: `גודל הקובץ חורג מהמותר (מקסימום ${effectiveMaxMb}MB)` }, { status: 400 });
  }

  const fileKey = `suggestions/${user.id}/${crypto.randomUUID()}-${sanitize(fileName)}`;
  const uploadUrl = await createUploadUrl(BUCKETS.apps, fileKey, contentType || "application/octet-stream");

  return NextResponse.json({ uploadUrl, fileKey });
}
