import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  getBotConfig,
  botIsLive,
  buildBotGrounding,
  callGemini,
  DEFAULT_BOT_SYSTEM_PROMPT,
  type GeminiTurn
} from "@/lib/bot";

// כמה הודעות אחרונות מהשיחה לשלוח כהקשר ל-Gemini (מעבר לזה - חותכים כדי לא לנפח).
const HISTORY_TURNS = 16;

export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const cfg = await getBotConfig();
  if (!botIsLive(cfg)) {
    return NextResponse.json({ error: "הצ'אט-בוט אינו זמין כרגע." }, { status: 503 });
  }

  const { conversationId, message } = await request.json().catch(() => ({}));
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return NextResponse.json({ error: "יש לכתוב הודעה" }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ error: "ההודעה ארוכה מדי" }, { status: 400 });

  const admin = createAdminSupabase();
  const staff = isStaff(profile);

  // --- מגבלת קצב: X הודעות משתמש ב-24 שעות מתגלגלות (צוות פטור) ---
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

  // --- שיחה: קיימת (של המשתמש) או חדשה ---
  let convId: string = typeof conversationId === "string" ? conversationId : "";
  let createdNewConv = false;
  let history: GeminiTurn[] = [];

  if (convId) {
    const { data: conv } = await admin
      .from("bot_conversations")
      .select("id, user_id")
      .eq("id", convId)
      .single();
    if (!conv || conv.user_id !== user.id) {
      return NextResponse.json({ error: "השיחה לא נמצאה" }, { status: 404 });
    }
    const { data: msgs } = await admin
      .from("bot_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_TURNS);
    history = ((msgs ?? []).reverse() as GeminiTurn[]);
  } else {
    const title = text.replace(/\s+/g, " ").slice(0, 60);
    const { data: created, error: convErr } = await admin
      .from("bot_conversations")
      .insert({ user_id: user.id, title: title || "שיחה חדשה" })
      .select("id")
      .single();
    if (convErr || !created) {
      return NextResponse.json({ error: "שגיאה בפתיחת שיחה" }, { status: 500 });
    }
    convId = created.id;
    createdNewConv = true;
  }

  // --- קריאה ל-Gemini ---
  let reply: string;
  try {
    const grounding = await buildBotGrounding();
    const systemInstruction = `${cfg.system_prompt?.trim() || DEFAULT_BOT_SYSTEM_PROMPT}\n\n---\nמידע רקע עדכני (השתמש בו כדי לענות, אל תמציא מעבר לזה):\n${grounding}`;
    reply = await callGemini(cfg, systemInstruction, [...history, { role: "user", content: text }]);
  } catch (err: any) {
    // ההודעה של המשתמש עדיין לא נשמרה - לא משאירים שיחה "תלויה" בלי תשובה.
    if (createdNewConv) await admin.from("bot_conversations").delete().eq("id", convId);
    return NextResponse.json(
      { error: "הבוט לא הצליח לענות כרגע. נסו שוב בעוד רגע.", detail: String(err?.message ?? err).slice(0, 200) },
      { status: 502 }
    );
  }

  // --- שמירה ---
  await admin.from("bot_messages").insert([
    { conversation_id: convId, role: "user", content: text },
    { conversation_id: convId, role: "assistant", content: reply }
  ]);
  await admin.from("bot_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);

  return NextResponse.json({ conversationId: convId, reply });
}
