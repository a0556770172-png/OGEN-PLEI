import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  getBotConfig,
  botIsLive,
  buildBotGrounding,
  runBotAgent,
  effectiveBotModel,
  MODEL_FALLBACK_MINUTES,
  DEFAULT_BOT_SYSTEM_PROMPT,
  BOT_HARD_RULES,
  type GeminiTurn
} from "@/lib/bot";
import { buildBotUserContext } from "@/lib/botContext";
import { personaSystemBlock } from "@/lib/botPersonas";
import { detectBotManipulation, ABUSE_BLOCK_SENTINEL, BOT_BLOCK_MINUTES } from "@/lib/botGuard";
import { notifyAdminsInApp } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import type { ToolContext } from "@/lib/botTools";

const HISTORY_TURNS = 16;

// חוסם משתמש מהבוט לשעה, מתעד, ומתריע למנהל.
async function blockUserFromBot(userId: string, username: string, reason: string, sample: string) {
  const admin = createAdminSupabase();
  const until = new Date(Date.now() + BOT_BLOCK_MINUTES * 60_000).toISOString();
  try {
    await admin.from("profiles").update({ bot_blocked_until: until }).eq("id", userId);
  } catch {
    // מיגרציה 0048 עוד לא רצה - החסימה לא תישמר, אבל ההתראה למנהל כן תישלח
  }
  logAudit({
    actorId: userId,
    action: "bot_block_user",
    targetType: "user",
    targetId: userId,
    targetLabel: username,
    meta: { reason, sample: sample.slice(0, 300), until }
  }).catch(() => {});
  notifyAdminsInApp({
    kind: "bot_abuse",
    title: `הבוט חסם משתמש: ${username}`,
    body: `${reason}. הודעה: "${sample.slice(0, 120)}"`,
    url: "/dashboard/admin?tab=users"
  }).catch(() => {});
}

export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const cfg = await getBotConfig();
  if (!botIsLive(cfg)) return NextResponse.json({ error: "הצ'אט-בוט אינו זמין כרגע." }, { status: 503 });

  // חסימת בוט אוטומטית פעילה? (זוהה בעבר ניסיון להסיט את השיחה)
  const blockedUntil = (profile as any).bot_blocked_until;
  if (blockedUntil && new Date(blockedUntil).getTime() > Date.now()) {
    const mins = Math.max(1, Math.ceil((new Date(blockedUntil).getTime() - Date.now()) / 60000));
    return NextResponse.json(
      { error: `הבוט נעול עבורך לעוד כ-${mins} דקות עקב ניסיון להסיט את השיחה. אפשר לנסות שוב מאוחר יותר.`, blocked: true },
      { status: 403 }
    );
  }

  const { conversationId, message, personaId } = await request.json().catch(() => ({}));
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return NextResponse.json({ error: "יש לכתוב הודעה" }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ error: "ההודעה ארוכה מדי" }, { status: 400 });

  const admin = createAdminSupabase();
  const staff = isStaff(profile);

  // זיהוי מוקדם (heuristic) של ניסיון jailbreak / חילוץ פרומפט / הסטה מכוונת.
  // צוות פטור (בדיקות). על flag: נעילת שעה + התראה למנהל, בלי לפנות ל-Gemini.
  if (!staff) {
    const manip = detectBotManipulation(text);
    if (manip.flagged) {
      await blockUserFromBot(user.id, profile.username, manip.reason, text);
      return NextResponse.json(
        {
          error: "זוהה ניסיון להסיט את השיחה מהנושא של עוגן פליי. הבוט נעול עבורך לשעה, והצוות עודכן.",
          blocked: true
        },
        { status: 403 }
      );
    }
  }

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
  let usedSmartModel = false;
  try {
    const [grounding, userCtx] = await Promise.all([buildBotGrounding(), buildBotUserContext(profile)]);
    const systemInstruction = [
      cfg.system_prompt?.trim() || DEFAULT_BOT_SYSTEM_PROMPT,
      "\n---\n## מידע רקע על האתר\n" + grounding,
      "\n---\n## המשתמש הנוכחי\n" + userCtx.text,
      personaSystemBlock(typeof personaId === "string" ? personaId : null),
      BOT_HARD_RULES
    ].join("\n");

    const ctx: ToolContext = {
      userId: user.id,
      profile,
      isStaff: staff,
      isDeveloper: profile.role === "developer" || profile.role === "admin",
      conversationId: convId
    };

    // ניתוב מודלים: מפתחים מקבלים את המודל החזק (אם הוגדר) - עזרה בתיאורים/ניסוח/הסקה.
    // אחרת: effectiveBotModel - המודל המועדף, או המודל החלופי אם יש עקיפה זמנית בתוקף.
    usedSmartModel = !!(ctx.isDeveloper && cfg.model_smart);
    const effectiveCfg = usedSmartModel
      ? { ...cfg, model: cfg.model_smart! }
      : { ...cfg, model: effectiveBotModel(cfg) };
    agent = await runBotAgent(effectiveCfg, systemInstruction, [...history, { role: "user", content: text }], ctx);
  } catch (err: any) {
    if (createdNewConv) await admin.from("bot_conversations").delete().eq("id", convId);
    return NextResponse.json(
      { error: "הבוט לא הצליח לענות כרגע.", detail: String(err?.message ?? err).slice(0, 250) },
      { status: 502 }
    );
  }

  // המודל עצמו זיהה ניסיון מכוון להסיט אותו והחזיר את הסנטינל -> חסימת שעה + התראה.
  if (!staff && agent.text.includes(ABUSE_BLOCK_SENTINEL)) {
    if (createdNewConv) await admin.from("bot_conversations").delete().eq("id", convId);
    await blockUserFromBot(user.id, profile.username, "המודל זיהה ניסיון מניפולציה מכוון", text);
    return NextResponse.json(
      {
        error: "זוהה ניסיון להסיט את השיחה מהנושא של עוגן פליי. הבוט נעול עבורך לשעה, והצוות עודכן.",
        blocked: true
      },
      { status: 403 }
    );
  }

  // --- ניהול העקיפה הזמנית של המודל (רק במסלול הרגיל) ---
  // אם המודל המועדף עבד -> מנקים כל עקיפה (הוא חזר לעצמו).
  // אם המודל המועדף עדיין נכשל והשתמשנו במודל אחר -> מאריכים עקיפה זמנית ל-MODEL_FALLBACK_MINUTES,
  //   כך שאחריה הבוט ינסה שוב אוטומטית את המודל המועדף לבדוק אם תוקן.
  if (!usedSmartModel && agent.modelUsed) {
    try {
      if (agent.modelUsed === cfg.model) {
        if (cfg.model_fallback || cfg.model_fallback_until) {
          await admin
            .from("bot_config")
            .update({ model_fallback: null, model_fallback_until: null, updated_at: new Date().toISOString() })
            .eq("id", true);
        }
      } else {
        await admin
          .from("bot_config")
          .update({
            model_fallback: agent.modelUsed,
            model_fallback_until: new Date(Date.now() + MODEL_FALLBACK_MINUTES * 60_000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", true);
      }
    } catch {
      // מיגרציה 0045 עוד לא רצה - לא קריטי
    }
  }

  // --- לוג קריאות כלים (לא קריטי - נכשל בשקט אם מיגרציה 0036 עוד לא רצה) ---
  if (agent.toolLog.length) {
    try {
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
    } catch {
      // ignore
    }
  }

  // --- שמירת ההודעות ---
  const meta = {
    appCards: agent.appCards,
    followUps: agent.followUps,
    proposedAction: agent.proposedAction,
    clientAction: agent.clientAction
  };
  await admin.from("bot_messages").insert({ conversation_id: convId, role: "user", content: text });
  let botMsg: { id: string } | null = null;
  {
    const withMeta = await admin
      .from("bot_messages")
      .insert({ conversation_id: convId, role: "assistant", content: agent.text, meta })
      .select("id")
      .single();
    if (withMeta.error) {
      // אין עמודת meta (מיגרציה 0036 לא רצה) - שומרים בלי, כדי שהשיחה לא תישבר
      const noMeta = await admin
        .from("bot_messages")
        .insert({ conversation_id: convId, role: "assistant", content: agent.text })
        .select("id")
        .single();
      botMsg = noMeta.data;
    } else {
      botMsg = withMeta.data;
    }
  }
  await admin.from("bot_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);

  return NextResponse.json({
    conversationId: convId,
    messageId: botMsg?.id ?? null,
    reply: agent.text,
    appCards: agent.appCards,
    followUps: agent.followUps,
    proposedAction: agent.proposedAction,
    clientAction: agent.clientAction
  });
}
