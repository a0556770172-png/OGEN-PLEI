import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// הוספת הודעה לפנייה קיימת - הבעלים של הפנייה, או צוות (מנהל/פיקוח)
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const { message } = await request.json().catch(() => ({}));
  if (!message?.trim()) {
    return NextResponse.json({ error: "אי אפשר לשלוח הודעה ריקה" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: ticket } = await admin.from("tickets").select("*").eq("id", params.id).single();
  if (!ticket) return NextResponse.json({ error: "הפנייה לא נמצאה" }, { status: 404 });

  const staff = isStaff(profile);
  if (!staff && ticket.user_id !== user.id) {
    return NextResponse.json({ error: "אין הרשאה לפנייה זו" }, { status: 403 });
  }

  const { error } = await admin.from("ticket_messages").insert({
    ticket_id: ticket.id,
    sender_id: user.id,
    sender_role: staff ? "staff" : "user",
    body: message.trim()
  });
  if (error) {
    return NextResponse.json({ error: `שגיאה בשליחת ההודעה: ${error.message}` }, { status: 500 });
  }

  // תגובת משתמש פותחת מחדש פנייה סגורה. תגובת צוות לא סוגרת אוטומטית - יש כפתור נפרד לסגירה.
  await admin
    .from("tickets")
    .update({
      status: !staff && ticket.status === "closed" ? "open" : ticket.status,
      updated_at: new Date().toISOString()
    })
    .eq("id", ticket.id);

  return NextResponse.json({ ok: true });
}
