import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createUploadUrl, BUCKETS } from "@/lib/r2";

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
}

// כל משתמש מחובר יכול להעלות קובץ APK להצעת אפליקציה - זה לא סופר במכסת האפליקציות שלו,
// זה רק חומר גלם לבדיקה של הצוות, לא פרסום בחנות.
const MAX_SUGGESTION_MB = 100;

export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const { fileName, fileSize, contentType } = await request.json().catch(() => ({}));
  if (!fileName || !fileSize) {
    return NextResponse.json({ error: "חסרים פרטי קובץ" }, { status: 400 });
  }

  const maxBytes = MAX_SUGGESTION_MB * 1024 * 1024;
  if (fileSize > maxBytes) {
    return NextResponse.json({ error: `גודל הקובץ חורג מהמותר (מקסימום ${MAX_SUGGESTION_MB}MB)` }, { status: 400 });
  }

  const fileKey = `suggestions/${user.id}/${crypto.randomUUID()}-${sanitize(fileName)}`;
  const uploadUrl = await createUploadUrl(BUCKETS.apps, fileKey, contentType || "application/octet-stream");

  return NextResponse.json({ uploadUrl, fileKey });
}
