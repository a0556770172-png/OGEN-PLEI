import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createDownloadUrl, BUCKETS } from "@/lib/r2";

// מחזיר קישור זמני חתום לצפייה/הורדה של קובץ מצורף בהודעה - רק לבעל הפנייה או לצוות.
export async function GET(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!key) return NextResponse.json({ error: "חסר מפתח קובץ" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: message } = await admin
    .from("ticket_messages")
    .select("ticket_id, attachment_name")
    .eq("attachment_key", key)
    .single();
  if (!message) return NextResponse.json({ error: "הקובץ לא נמצא" }, { status: 404 });

  if (!isStaff(profile)) {
    const { data: ticket } = await admin.from("tickets").select("user_id").eq("id", message.ticket_id).single();
    if (!ticket || ticket.user_id !== user.id) {
      return NextResponse.json({ error: "אין הרשאה לקובץ זה" }, { status: 403 });
    }
  }

  const url = await createDownloadUrl(BUCKETS.uploads, key, message.attachment_name ?? undefined);
  return NextResponse.json({ url });
}
