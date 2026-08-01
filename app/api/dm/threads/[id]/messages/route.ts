import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

async function assertParticipant(admin: ReturnType<typeof createAdminSupabase>, threadId: string, userId: string) {
  const { data: thread } = await admin.from("dm_threads").select("id, user_a, user_b").eq("id", threadId).single();
  if (!thread) return null;
  if (thread.user_a !== userId && thread.user_b !== userId) return null;
  return thread;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const admin = createAdminSupabase();
  const thread = await assertParticipant(admin, params.id, user.id);
  if (!thread) return NextResponse.json({ error: "שיחה לא נמצאה" }, { status: 404 });

  const otherId = thread.user_a === user.id ? thread.user_b : thread.user_a;
  const { data: other } = await admin.from("profiles").select("id, username").eq("id", otherId).single();
  const { data: messages } = await admin
    .from("dm_messages")
    .select("id, sender_id, body, created_at")
    .eq("thread_id", params.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ messages: messages ?? [], otherUsername: other?.username ?? "משתמש" });
}

// מענה על שיחה קיימת פתוח לשני הצדדים ללא בדיקת סף מחדש - הסף (10 אפליקציות/הצעות)
// נבדק רק בפתיחת שיחה חדשה (app/api/dm/start).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const admin = createAdminSupabase();
  const thread = await assertParticipant(admin, params.id, user.id);
  if (!thread) return NextResponse.json({ error: "שיחה לא נמצאה" }, { status: 404 });

  const { body } = await request.json().catch(() => ({}));
  const trimmed = typeof body === "string" ? body.trim() : "";
  if (!trimmed) return NextResponse.json({ error: "חובה להקליד הודעה" }, { status: 400 });
  if (trimmed.length > 2000) return NextResponse.json({ error: "ההודעה ארוכה מדי" }, { status: 400 });

  const { error } = await admin.from("dm_messages").insert({ thread_id: params.id, sender_id: user.id, body: trimmed });
  if (error) return NextResponse.json({ error: "שגיאה בשליחת ההודעה" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
