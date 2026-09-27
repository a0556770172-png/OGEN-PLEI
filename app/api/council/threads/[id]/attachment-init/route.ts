import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createUploadUrl, BUCKETS } from "@/lib/r2";
import { sanitizeFileName, normalizeContentType, validateAttachment } from "@/lib/attachments";

// יוזם העלאת קובץ מצורף להודעה בוועדה - כל סוג קובץ (כולל ZIP), לכל חבר צוות. הוועדה היא
// ערוץ פנימי של הצוות בלבד, ולכן אין כאן את הרשאת can_send_attachments של הפניות.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isStaff(result.profile)) return NextResponse.json({ error: "רק צוות יכול לכתוב בוועדה" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data: thread } = await admin.from("council_threads").select("id").eq("id", params.id).single();
  if (!thread) return NextResponse.json({ error: "הוועדה לא נמצאה" }, { status: 404 });

  const { fileName, fileSize, contentType } = await request.json().catch(() => ({}));
  const invalid = validateAttachment(fileName, fileSize);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const type = normalizeContentType(contentType);
  const attachmentKey = `council-attachments/${params.id}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
  const uploadUrl = await createUploadUrl(BUCKETS.uploads, attachmentKey, type);

  return NextResponse.json({ uploadUrl, attachmentKey, attachmentName: fileName, attachmentType: type });
}
