import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// השיחות/הניסיונות החשודים שהבוט זיהה (jailbreak / חילוץ פרומפט / הסטה מכוונת).
// מקור אמת: audit_log עם action='bot_block_user' - כולל כל מה שזוהה בעבר (למפרע).
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isStaff(result.profile)) return NextResponse.json({ error: "רק צוות" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data: rows } = await admin
    .from("audit_log")
    .select("id, actor_id, target_id, target_label, meta, created_at")
    .eq("action", "bot_block_user")
    .order("created_at", { ascending: false })
    .limit(300);

  const list = (rows ?? []) as any[];

  // אילו מהשיחות המסומנות עדיין קיימות (כדי שהפאנל יידע אם אפשר לפתוח)
  const convIds = [...new Set(list.map((r) => r.meta?.conversationId).filter(Boolean))];
  let existing = new Set<string>();
  if (convIds.length) {
    const { data: convs } = await admin.from("bot_conversations").select("id").in("id", convIds);
    existing = new Set((convs ?? []).map((c: any) => c.id));
  }

  // גם שיחות שסומנו flagged_at אך אין להן שורת audit (למקרה קצה) - נצרף
  let flaggedConvs: any[] = [];
  try {
    const { data } = await admin
      .from("bot_conversations")
      .select("id, flagged_at, flagged_reason, user:profiles!bot_conversations_user_id_fkey(username)")
      .not("flagged_at", "is", null)
      .order("flagged_at", { ascending: false })
      .limit(300);
    flaggedConvs = data ?? [];
  } catch {
    // מיגרציה 0049 עוד לא רצה
  }
  const seenConvIds = new Set(convIds);
  const extra = flaggedConvs
    .filter((c) => !seenConvIds.has(c.id))
    .map((c) => ({
      id: `conv-${c.id}`,
      at: c.flagged_at,
      username: c.user?.username ?? "—",
      userId: null as string | null,
      reason: c.flagged_reason ?? "ניסיון חשוד",
      sample: null as string | null,
      conversationId: c.id,
      conversationExists: true
    }));

  const detections = list.map((r) => ({
    id: r.id,
    at: r.created_at,
    username: r.target_label ?? "—",
    userId: r.target_id ?? null,
    reason: r.meta?.reason ?? "ניסיון חשוד",
    sample: r.meta?.sample ?? null,
    conversationId: r.meta?.conversationId ?? null,
    conversationExists: r.meta?.conversationId ? existing.has(r.meta.conversationId) : false
  }));

  const all = [...detections, ...extra].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );

  return NextResponse.json({ detections: all });
}
