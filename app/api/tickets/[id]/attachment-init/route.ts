import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createUploadUrl, BUCKETS } from "@/lib/r2";

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
}

const MAX_ATTACHMENT_MB = 50;
const ALLOWED_PREFIXES = ["image/", "video/", "audio/"];

// יוזם העלאת קובץ מצורף להודעה בפנייה (תמונה/וידאו/הקלטת קול). זו פעולה רגישה מבחינת
// עומס אחסון ולכן מוגבלת: מנהל בפועל תמיד יכול, וחבר צוות פיקוח רק אם הוענקה לו
// הרשאה מפורשת ונפרדת (can_send_attachments) ע"י המנהל - לא באופן אוטומטי לכל הצוות.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;

  if (!isStaff(profile)) {
    return NextResponse.json({ error: "רק צוות יכול לשלוח קבצים מצורפים" }, { status: 403 });
  }
  if (profile.role !== "admin" && !profile.can_send_attachments) {
    return NextResponse.json(
      { error: "אין לך הרשאה לשלוח קבצים מצורפים - יש לבקש מהמנהל להעניק הרשאה זו" },
      { status: 403 }
    );
  }

  const admin = createAdminSupabase();
  const { data: ticket } = await admin.from("tickets").select("id").eq("id", params.id).single();
  if (!ticket) return NextResponse.json({ error: "הפנייה לא נמצאה" }, { status: 404 });

  const { fileName, fileSize, contentType } = await request.json().catch(() => ({}));
  if (!fileName || !fileSize || !contentType) {
    return NextResponse.json({ error: "חסרים פרטי קובץ" }, { status: 400 });
  }
  if (!ALLOWED_PREFIXES.some((p) => contentType.startsWith(p))) {
    return NextResponse.json({ error: "ניתן לצרף רק תמונה, וידאו או הקלטת קול" }, { status: 400 });
  }
  const maxBytes = MAX_ATTACHMENT_MB * 1024 * 1024;
  if (fileSize > maxBytes) {
    return NextResponse.json({ error: `גודל הקובץ חורג מהמותר (מקסימום ${MAX_ATTACHMENT_MB}MB)` }, { status: 400 });
  }

  const attachmentKey = `ticket-attachments/${params.id}/${crypto.randomUUID()}-${sanitize(fileName)}`;
  const uploadUrl = await createUploadUrl(BUCKETS.uploads, attachmentKey, contentType);

  return NextResponse.json({ uploadUrl, attachmentKey, attachmentName: fileName, attachmentType: contentType });
}
