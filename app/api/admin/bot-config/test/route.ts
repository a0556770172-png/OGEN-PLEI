import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getBotConfig, callGeminiWithFallback, listGeminiModels } from "@/lib/bot";

// בדיקת חיבור ל-Gemini - מנהל בפועל בלבד. מנסה לרשום את המודלים הזמינים למפתח,
// ואז שולח שאלת בדיקה קצרה. שומר את המודל שהצליח.
export async function POST() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.profile.role !== "admin") return NextResponse.json({ error: "רק מנהל בפועל" }, { status: 403 });

  const cfg = await getBotConfig();
  if (!cfg.gemini_api_key) {
    return NextResponse.json({ ok: false, error: "לא הוגדר מפתח API" }, { status: 400 });
  }

  let availableModels: string[] = [];
  try {
    availableModels = await listGeminiModels(cfg.gemini_api_key);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err).slice(0, 300) }, { status: 200 });
  }

  try {
    const out = await callGeminiWithFallback(cfg, "אתה בוט בדיקה. ענה במילה אחת בעברית.", [
      { role: "user", content: "אמור: תקין" }
    ]);
    if (out.modelUsed && out.modelUsed !== cfg.model) {
      const admin = createAdminSupabase();
      await admin.from("bot_config").update({ model: out.modelUsed, updated_at: new Date().toISOString() }).eq("id", true);
    }
    return NextResponse.json({
      ok: true,
      modelUsed: out.modelUsed,
      reply: out.text,
      availableModels
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err).slice(0, 300), availableModels },
      { status: 200 }
    );
  }
}
