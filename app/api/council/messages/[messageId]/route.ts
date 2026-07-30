import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: { messageId: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;
  if (!isStaff(profile)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { body } = await request.json().catch(() => ({}));
  if (!body?.trim()) {
    return NextResponse.json({ error: "אי אפשר לשמור הודעה ריקה" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: message } = await admin.from("council_messages").select("sender_id, deleted_at").eq("id", params.messageId).single();
  if (!message) return NextResponse.json({ error: "ההודעה לא נמצאה" }, { status: 404 });
  if (message.sender_id !== user.id) {
    return NextResponse.json({ error: "אפשר לערוך רק הודעות שאתה שלחת" }, { status: 403 });
  }
  if (message.deleted_at) {
    return NextResponse.json({ error: "לא ניתן לערוך הודעה שנמחקה" }, { status: 400 });
  }

  const { error } = await admin
    .from("council_messages")
    .update({ body: body.trim(), edited_at: new Date().toISOString() })
    .eq("id", params.messageId);
  if (error) return NextResponse.json({ error: "שגיאה בעריכת ההודעה" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: { messageId: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;
  if (!isStaff(profile)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data: message } = await admin.from("council_messages").select("sender_id").eq("id", params.messageId).single();
  if (!message) return NextResponse.json({ error: "ההודעה לא נמצאה" }, { status: 404 });

  if (message.sender_id !== user.id && profile.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה למחוק הודעה זו" }, { status: 403 });
  }

  const { error } = await admin
    .from("council_messages")
    .update({ body: "", deleted_at: new Date().toISOString() })
    .eq("id", params.messageId);
  if (error) return NextResponse.json({ error: "שגיאה במחיקת ההודעה" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
