import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// הוספת הודעה לדיון ועדה קיים - כל חבר צוות (מנהל/פיקוח) יכול לכתוב, זה ערוץ משותף לכולם.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  if (!isStaff(profile)) {
    return NextResponse.json({ error: "רק צוות יכול לכתוב בוועדה" }, { status: 403 });
  }

  const { message, replyToId } = await request.json().catch(() => ({}));
  if (!message?.trim()) {
    return NextResponse.json({ error: "אי אפשר לשלוח הודעה ריקה" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: thread } = await admin.from("council_threads").select("id").eq("id", params.id).single();
  if (!thread) return NextResponse.json({ error: "הוועדה לא נמצאה" }, { status: 404 });

  const { error } = await admin.from("council_messages").insert({
    thread_id: params.id,
    sender_id: user.id,
    body: message.trim(),
    reply_to_id: replyToId ?? null
  });
  if (error) return NextResponse.json({ error: "שגיאה בשליחת ההודעה" }, { status: 500 });

  await admin.from("council_threads").update({ updated_at: new Date().toISOString() }).eq("id", params.id);

  return NextResponse.json({ ok: true });
}
