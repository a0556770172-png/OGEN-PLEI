import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createUploadUrl, BUCKETS } from "@/lib/r2";

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
}

const MAX_AVATAR_MB = 5;

// כל משתמש מחובר (רגיל/מפתח/מנהל) יכול להעלות לעצמו תמונת פרופיל
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const { fileName, fileSize, contentType } = await request.json().catch(() => ({}));
  if (!fileName || !fileSize || !contentType) {
    return NextResponse.json({ error: "חסרים פרטי קובץ" }, { status: 400 });
  }
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "יש להעלות קובץ תמונה בלבד" }, { status: 400 });
  }
  const maxBytes = MAX_AVATAR_MB * 1024 * 1024;
  if (fileSize > maxBytes) {
    return NextResponse.json({ error: `גודל התמונה חורג מהמותר (מקסימום ${MAX_AVATAR_MB}MB)` }, { status: 400 });
  }

  const avatarKey = `avatars/${user.id}/${crypto.randomUUID()}-${sanitize(fileName)}`;
  const uploadUrl = await createUploadUrl(BUCKETS.assets, avatarKey, contentType);

  return NextResponse.json({ uploadUrl, avatarKey });
}
