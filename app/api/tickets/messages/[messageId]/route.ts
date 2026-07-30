import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// עריכת הודעה - רק השולח המקורי, ורק על תוכן טקסט (לא על קבצים מצורפים).
export async function PATCH(request: Request, { params }: { params: { messageId: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const { body } = await request.json().catch(() => ({}));
  if (!body?.trim()) {
    return NextResponse.json({ error: "אי אפשר לשמור הודעה ריקה" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: message } = await admin.from("ticket_messages").select("sender_id, deleted_at").eq("id", params.messageId).single();
  if (!message) return NextResponse.json({ error: "ההודעה לא נמצאה" }, { status: 404 });
  if (message.sender_id !== user.id) {
    return NextResponse.json({ error: "אפשר לערוך רק הודעות שאתה שלחת" }, { status: 403 });
  }
  if (message.deleted_at) {
    return NextResponse.json({ error: "לא ניתן לערוך הודעה שנמחקה" }, { status: 400 });
  }

  const { error } = await admin
    .from("ticket_messages")
    .update({ body: body.trim(), edited_at: new Date().toISOString() })
    .eq("id", params.messageId);
  if (error) return NextResponse.json({ error: "שגיאה בעריכת ההודעה" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// מחיקה רכה - השולח המקורי, או מנהל בפועל (למקרי הצורך). ההודעה נשארת ברשומה אבל
// מוצגת כ"נמחקה" כדי לא לשבור שרשראות ציטוט/הגבה של הודעות אחרות שמצביעות אליה.
export async function DELETE(_request: Request, { params }: { params: { messageId: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const admin = createAdminSupabase();
  const { data: message } = await admin.from("ticket_messages").select("sender_id").eq("id", params.messageId).single();
  if (!message) return NextResponse.json({ error: "ההודעה לא נמצאה" }, { status: 404 });

  if (message.sender_id !== user.id && profile.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה למחוק הודעה זו" }, { status: 403 });
  }

  const { error } = await admin
    .from("ticket_messages")
    .update({ body: "", attachment_key: null, attachment_name: null, attachment_type: null, deleted_at: new Date().toISOString() })
    .eq("id", params.messageId);
  if (error) return NextResponse.json({ error: "שגיאה במחיקת ההודעה" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
