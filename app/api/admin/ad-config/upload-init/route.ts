import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createUploadUrl, BUCKETS } from "@/lib/r2";

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
}

const MAX_AD_MB = 15;

// רק מנהל בפועל יכול להעלות תמונה/גיף חדש לפרסומת (מוצג לכולם, אז לא פתוח לכל מפתח).
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.profile.role !== "admin") return NextResponse.json({ error: "רק מנהל בפועל" }, { status: 403 });

  const { fileName, fileSize, contentType } = await request.json().catch(() => ({}));
  if (!fileName || !fileSize || !contentType) {
    return NextResponse.json({ error: "חסרים פרטי קובץ" }, { status: 400 });
  }
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "יש להעלות קובץ תמונה/גיף בלבד" }, { status: 400 });
  }
  const maxBytes = MAX_AD_MB * 1024 * 1024;
  if (fileSize > maxBytes) {
    return NextResponse.json({ error: `גודל הקובץ חורג מהמותר (מקסימום ${MAX_AD_MB}MB)` }, { status: 400 });
  }

  const imageKey = `ads/${crypto.randomUUID()}-${sanitize(fileName)}`;
  const uploadUrl = await createUploadUrl(BUCKETS.assets, imageKey, contentType);

  return NextResponse.json({ uploadUrl, imageKey });
}
