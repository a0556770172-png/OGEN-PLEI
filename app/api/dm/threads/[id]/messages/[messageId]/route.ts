import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// עריכה ומחיקה של הודעה בצ'אט בין משתמשים - רק השולח של ההודעה עצמה, ורק בשיחה שהוא משתתף בה.
// שתי הפעולות הן UPDATE מותנה (על השולח ועל "לא נמחקה") ובודקות שבאמת עודכנה שורה - כך שלחיצה כפולה
// או מירוץ בין עריכה למחיקה לא מחזירים לחיים הודעה שנמחקה, ולא עורכים הודעה של מישהו אחר.

const MAX_LEN = 2000;

export async function PATCH(request: Request, { params }: { params: { id: string; messageId: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const { body } = await request.json().catch(() => ({}));
  const trimmed = typeof body === "string" ? body.trim() : "";
  if (!trimmed) return NextResponse.json({ error: "ההודעה לא יכולה להיות ריקה" }, { status: 400 });
  if (trimmed.length > MAX_LEN) return NextResponse.json({ error: "ההודעה ארוכה מדי" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: updated, error } = await admin
    .from("dm_messages")
    .update({ body: trimmed, edited_at: new Date().toISOString() })
    .eq("id", params.messageId)
    .eq("thread_id", params.id)
    .eq("sender_id", user.id)
    .is("deleted_at", null)
    .select("id, body, edited_at");
  if (error) return NextResponse.json({ error: "שגיאה בעריכת ההודעה" }, { status: 500 });
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "אפשר לערוך רק הודעה שלכם שלא נמחקה" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, message: updated[0] });
}

export async function DELETE(_request: Request, { params }: { params: { id: string; messageId: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const admin = createAdminSupabase();
  const { data: deleted, error } = await admin
    .from("dm_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.messageId)
    .eq("thread_id", params.id)
    .eq("sender_id", user.id)
    .is("deleted_at", null)
    .select("id");
  if (error) return NextResponse.json({ error: "שגיאה במחיקת ההודעה" }, { status: 500 });
  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: "אפשר למחוק רק הודעה שלכם שעדיין לא נמחקה" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
