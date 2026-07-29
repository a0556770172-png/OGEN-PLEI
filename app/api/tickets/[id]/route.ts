import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// סגירה/פתיחה מחדש של פנייה - צוות (מנהל/פיקוח) בלבד
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;

  if (!isStaff(profile)) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { status } = await request.json().catch(() => ({}));
  if (status !== "open" && status !== "closed") {
    return NextResponse.json({ error: "סטטוס לא חוקי" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  await admin.from("tickets").update({ status, updated_at: new Date().toISOString() }).eq("id", params.id);

  return NextResponse.json({ ok: true });
}
