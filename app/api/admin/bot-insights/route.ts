import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// תובנות על הבוט לצוות: שימוש בכלים, דירוגים, ותשובות שדורגו שלילי.
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isStaff(result.profile)) return NextResponse.json({ error: "רק צוות" }, { status: 403 });

  const admin = createAdminSupabase();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: toolRows }, { data: fbRows }, { data: negRows }] = await Promise.all([
    admin.from("bot_tool_calls").select("tool, ok").gte("created_at", since).limit(3000),
    admin.from("bot_message_feedback").select("rating").limit(5000),
    admin
      .from("bot_message_feedback")
      .select("rating, note, created_at, bot_messages(content, conversation_id)")
      .eq("rating", -1)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  const toolCounts: Record<string, { total: number; failed: number }> = {};
  for (const r of toolRows ?? []) {
    const t = (toolCounts[r.tool] ??= { total: 0, failed: 0 });
    t.total++;
    if (!r.ok) t.failed++;
  }
  const topTools = Object.entries(toolCounts)
    .map(([tool, v]) => ({ tool, ...v }))
    .sort((a, b) => b.total - a.total);

  const up = (fbRows ?? []).filter((f) => f.rating === 1).length;
  const down = (fbRows ?? []).filter((f) => f.rating === -1).length;

  const negatives = (negRows ?? []).map((n: any) => ({
    note: n.note,
    at: n.created_at,
    excerpt: (n.bot_messages?.content ?? "").slice(0, 200),
    conversationId: n.bot_messages?.conversation_id ?? null
  }));

  return NextResponse.json({
    toolCallsTotal: (toolRows ?? []).length,
    topTools,
    thumbsUp: up,
    thumbsDown: down,
    negatives
  });
}
