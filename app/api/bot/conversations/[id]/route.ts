import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// הודעות של שיחה אחת. הבעלים רואה את שלו; צוות רואה כל שיחה (למעקב/שיפור הבוט).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const admin = createAdminSupabase();
  const { data: conv } = await admin
    .from("bot_conversations")
    .select("id, user_id, title, created_at")
    .eq("id", params.id)
    .single();
  if (!conv) return NextResponse.json({ error: "השיחה לא נמצאה" }, { status: 404 });
  if (conv.user_id !== user.id && !isStaff(profile)) {
    return NextResponse.json({ error: "אין הרשאה לשיחה זו" }, { status: 403 });
  }

  const { data: messages } = await admin
    .from("bot_messages")
    .select("id, role, content, meta, created_at")
    .eq("conversation_id", params.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ conversation: conv, messages: messages ?? [] });
}

// מחיקת שיחה - הבעלים בלבד.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const admin = createAdminSupabase();
  const { data: conv } = await admin.from("bot_conversations").select("user_id").eq("id", params.id).single();
  if (!conv) return NextResponse.json({ error: "השיחה לא נמצאה" }, { status: 404 });
  if (conv.user_id !== user.id) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  await admin.from("bot_conversations").delete().eq("id", params.id);
  return NextResponse.json({ ok: true });
}
