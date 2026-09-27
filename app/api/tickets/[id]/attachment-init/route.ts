import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createUploadUrl, BUCKETS } from "@/lib/r2";
import { sanitizeFileName, normalizeContentType, validateAttachment } from "@/lib/attachments";

// יוזם העלאת קובץ מצורף להודעה בפנייה - כל סוג קובץ (תמונה, וידאו, קול, ZIP, PDF וכו'),
// עד MAX_ATTACHMENT_MB. מי יכול: המשתמש שפתח את הפנייה, מנהל בפועל, וחבר צוות פיקוח
// שקיבל מהמנהל הרשאה מפורשת (can_send_attachments) - ההרשאה לצוות נשארת כמו שהייתה.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const admin = createAdminSupabase();
  const { data: ticket } = await admin.from("tickets").select("id, user_id, assigned_staff_id").eq("id", params.id).single();
  if (!ticket) return NextResponse.json({ error: "הפנייה לא נמצאה" }, { status: 404 });

  const staff = isStaff(profile);
  if (!staff && ticket.user_id !== user.id) {
    return NextResponse.json({ error: "אין הרשאה לפנייה זו" }, { status: 403 });
  }
  if (staff && ticket.user_id !== user.id) {
    if (profile.role !== "admin" && !profile.can_send_attachments) {
      return NextResponse.json(
        { error: "אין לך הרשאה לשלוח קבצים מצורפים - יש לבקש מהמנהל להעניק הרשאה זו" },
        { status: 403 }
      );
    }
    if (profile.role !== "admin" && ticket.assigned_staff_id && ticket.assigned_staff_id !== profile.id) {
      return NextResponse.json({ error: "שיחה זו משוייכת לחבר צוות אחר" }, { status: 403 });
    }
  }

  const { fileName, fileSize, contentType } = await request.json().catch(() => ({}));
  const invalid = validateAttachment(fileName, fileSize);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const type = normalizeContentType(contentType);
  const attachmentKey = `ticket-attachments/${params.id}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
  const uploadUrl = await createUploadUrl(BUCKETS.uploads, attachmentKey, type);

  return NextResponse.json({ uploadUrl, attachmentKey, attachmentName: fileName, attachmentType: type });
}
