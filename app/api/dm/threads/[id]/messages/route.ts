import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getAvatarUrl } from "@/lib/avatar";

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
  const [{ data: other }, { data: messages }] = await Promise.all([
    admin.from("profiles").select("id, username, role, avatar_key").eq("id", otherId).single(),
    admin
      .from("dm_messages")
      .select("id, sender_id, body, created_at, edited_at, deleted_at")
      .eq("thread_id", params.id)
      .order("created_at", { ascending: true })
  ]);

  // הודעה שנמחקה: הטקסט לא נשלח בכלל לדפדפן של אף אחד מהצדדים (הוא נשמר ב-DB רק לצפיית הפיקוח)
  const safe = (messages ?? []).map((m) => (m.deleted_at ? { ...m, body: "" } : m));
  return NextResponse.json({
    meId: user.id,
    messages: safe,
    otherUsername: other?.username ?? "משתמש",
    otherUserId: otherId,
    otherAvatarUrl: other ? await getAvatarUrl(other.avatar_key, other.role) : null
  });
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

  const { data: inserted, error } = await admin
    .from("dm_messages")
    .insert({ thread_id: params.id, sender_id: user.id, body: trimmed })
    .select("id, sender_id, body, created_at, edited_at, deleted_at")
    .single();
  if (error) return NextResponse.json({ error: "שגיאה בשליחת ההודעה" }, { status: 500 });

  // מי שהגיב קרא את השיחה - מעדכנים "נקרא עד" כדי שלא תופיע לו כלא-נקראה אחרי שכבר ענה.
  await admin
    .from("dm_thread_reads")
    .upsert({ user_id: user.id, thread_id: params.id, last_read_at: new Date().toISOString() }, { onConflict: "user_id,thread_id" });

  return NextResponse.json({ ok: true, message: inserted });
}
