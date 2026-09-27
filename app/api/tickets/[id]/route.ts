import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// שמות חברי הצוות שענו בשיחה - כדי שבתגובות יוצג מי מהצוות כתב. המשתמש עצמו לא יכול לקרוא
// פרופילים של אחרים ישירות (RLS), לכן השמות מגיעים מכאן, ורק של מי ששלח הודעת צוות בשיחה הזו.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const admin = createAdminSupabase();
  const { data: ticket } = await admin.from("tickets").select("user_id").eq("id", params.id).single();
  if (!ticket) return NextResponse.json({ error: "הפנייה לא נמצאה" }, { status: 404 });
  if (ticket.user_id !== user.id && !isStaff(profile)) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { data: rows } = await admin
    .from("ticket_messages")
    .select("sender_id")
    .eq("ticket_id", params.id)
    .eq("sender_role", "staff");
  const ids = [...new Set((rows ?? []).map((r) => r.sender_id as string))];

  const staffNames: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: people } = await admin.from("profiles").select("id, username").in("id", ids);
    for (const p of people ?? []) staffNames[p.id] = p.username;
  }
  return NextResponse.json({ staffNames });
}

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
