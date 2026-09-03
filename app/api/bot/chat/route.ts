import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getBotConfig, botIsLive, buildBotGrounding, runBotAgent, DEFAULT_BOT_SYSTEM_PROMPT, type GeminiTurn } from "@/lib/bot";
import { buildBotUserContext } from "@/lib/botContext";
import type { ToolContext } from "@/lib/botTools";

const HISTORY_TURNS = 16;

export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const cfg = await getBotConfig();
  if (!botIsLive(cfg)) return NextResponse.json({ error: "הצ'אט-בוט אינו זמין כרגע." }, { status: 503 });

  const { conversationId, message } = await request.json().catch(() => ({}));
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return NextResponse.json({ error: "יש לכתוב הודעה" }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ error: "ההודעה ארוכה מדי" }, { status: 400 });

  const admin = createAdminSupabase();
  const staff = isStaff(profile);

  // --- מגבלת קצב ---
  if (!staff) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: myConvs } = await admin.from("bot_conversations").select("id").eq("user_id", user.id);
    const convIds = (myConvs ?? []).map((c) => c.id);
    if (convIds.length > 0) {
      const { count } = await admin
        .from("bot_messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", convIds)
        .eq("role", "user")
        .gte("created_at", since);
      if ((count ?? 0) >= cfg.daily_limit) {
        return NextResponse.json(
          { error: `הגעת למגבלת ${cfg.daily_limit} השאלות היומית לבוט. אפשר לנסות שוב מחר, או לפנות לצוות דרך עמוד התמיכה.` },
          { status: 429 }
        );
      }
    }
  }

  // --- שיחה ---
  let convId: string = typeof conversationId === "string" ? conversationId : "";
  let createdNewConv = false;
  let history: GeminiTurn[] = [];

  if (convId) {
    const { data: conv } = await admin.from("bot_conversations").select("id, user_id").eq("id", convId).single();
    if (!conv || conv.user_id !== user.id) return NextResponse.json({ error: "השיחה לא נמצאה" }, { status: 404 });
    const { data: msgs } = await admin
      .from("bot_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_TURNS);
    history = (msgs ?? []).reverse() as GeminiTurn[];
  } else {
    const title = text.replace(/\s+/g, " ").slice(0, 60);
    const { data: created, error: convErr } = await admin
      .from("bot_conversations")
      .insert({ user_id: user.id, title: title || "שיחה חדשה" })
      .select("id")
      .single();
    if (convErr || !created) return NextResponse.json({ error: "שגיאה בפתיחת שיחה" }, { status: 500 });
    convId = created.id;
    createdNewConv = true;
  }

  // --- לולאת הסוכן ---
  let agent;
  try {
    const [grounding, userCtx] = await Promise.all([buildBotGrounding(), buildBotUserContext(profile)]);
    const systemInstruction = [
      cfg.system_prompt?.trim() || DEFAULT_BOT_SYSTEM_PROMPT,
      "\n---\n## מידע רקע על האתר\n" + grounding,
      "\n---\n## המשתמש הנוכחי\n" + userCtx.text
    ].join("\n");

    const ctx: ToolContext = {
      userId: user.id,
      profile,
      isStaff: staff,
      isDeveloper: profile.role === "developer" || profile.role === "admin",
      conversationId: convId
    };

    agent = await runBotAgent(cfg, systemInstruction, [...history, { role: "user", content: text }], ctx);
  } catch (err: any) {
    if (createdNewConv) await admin.from("bot_conversations").delete().eq("id", convId);
    return NextResponse.json(
      { error: "הבוט לא הצליח לענות כרגע.", detail: String(err?.message ?? err).slice(0, 250) },
      { status: 502 }
    );
  }

  // --- שמירת המודל שעבד ---
  if (agent.modelUsed && agent.modelUsed !== cfg.model) {
    await admin.from("bot_config").update({ model: agent.modelUsed, updated_at: new Date().toISOString() }).eq("id", true);
  }

  // --- לוג קריאות כלים ---
  if (agent.toolLog.length) {
    await admin.from("bot_tool_calls").insert(
      agent.toolLog.map((t) => ({
        conversation_id: convId,
        tool: t.tool,
        args: t.args,
        ok: t.ok,
        result_summary: t.summary,
        ms: t.ms
      }))
    );
  }

  // --- שמירת ההודעות ---
  const meta = {
    appCards: agent.appCards,
    followUps: agent.followUps,
    proposedAction: agent.proposedAction
  };
  await admin.from("bot_messages").insert({ conversation_id: convId, role: "user", content: text });
  const { data: botMsg } = await admin
    .from("bot_messages")
    .insert({ conversation_id: convId, role: "assistant", content: agent.text, meta })
    .select("id")
    .single();
  await admin.from("bot_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);

  return NextResponse.json({
    conversationId: convId,
    messageId: botMsg?.id ?? null,
    reply: agent.text,
    appCards: agent.appCards,
    followUps: agent.followUps,
    proposedAction: agent.proposedAction
  });
}
