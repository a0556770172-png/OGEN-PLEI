import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// דירוג תשובת בוט (👍 / 👎). מוצג לאדמין בטאב "צ'אט-בוט" לזיהוי איפה הבוט נכשל.
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const { messageId, rating, note } = await request.json().catch(() => ({}));
  if (!messageId || (rating !== 1 && rating !== -1)) {
    return NextResponse.json({ error: "נתונים לא תקינים" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: msg } = await admin
    .from("bot_messages")
    .select("id, role, bot_conversations(user_id)")
    .eq("id", messageId)
    .single();
  const ownerId = (msg as any)?.bot_conversations?.user_id;
  if (!msg || (msg as any).role !== "assistant" || ownerId !== user.id) {
    return NextResponse.json({ error: "הודעה לא נמצאה" }, { status: 404 });
  }

  await admin.from("bot_message_feedback").upsert({
    message_id: messageId,
    user_id: user.id,
    rating,
    note: typeof note === "string" ? note.slice(0, 500) : null
  });

  return NextResponse.json({ ok: true });
}
