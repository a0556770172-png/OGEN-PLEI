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

  const { data: ticket } = await admin.from("tickets").select("assigned_staff_id").eq("id", params.id).single();
  if (!ticket) return NextResponse.json({ error: "הפנייה לא נמצאה" }, { status: 404 });

  // פרטיות בין חברי צוות: אי אפשר לגעת בשיחה ששוייכה לחבר צוות אחר (מלבד המנהל).
  if (profile.role !== "admin" && ticket.assigned_staff_id && ticket.assigned_staff_id !== profile.id) {
    return NextResponse.json({ error: "שיחה זו משוייכת לחבר צוות אחר" }, { status: 403 });
  }

  await admin.from("tickets").update({ status, updated_at: new Date().toISOString() }).eq("id", params.id);

  return NextResponse.json({ ok: true });
}
