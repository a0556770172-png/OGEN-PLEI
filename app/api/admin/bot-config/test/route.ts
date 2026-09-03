import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getBotConfig, callGeminiWithFallback, listGeminiModels } from "@/lib/bot";
import { getKeyCandidates } from "@/lib/botKeys";

// בדיקת חיבור ל-Gemini - בודק את כל המפתחות במאגר. מנהל בפועל בלבד.
export async function POST() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.profile.role !== "admin") return NextResponse.json({ error: "רק מנהל בפועל" }, { status: 403 });

  const cfg = await getBotConfig();
  const candidates = await getKeyCandidates();
  if (candidates.length === 0) {
    return NextResponse.json({ ok: false, error: "לא הוגדר אף מפתח Gemini API" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const results: { label: string; ok: boolean; detail: string; modelUsed?: string }[] = [];
  let availableModels: string[] = [];

  for (const c of candidates) {
    const label = c.id === "legacy" ? "מפתח ישן (bot_config)" : c.id.slice(0, 8);
    try {
      if (availableModels.length === 0) {
        availableModels = await listGeminiModels(c.key).catch(() => []);
      }
      const out = await callGeminiWithFallback(c.key, cfg.model, "אתה בוט בדיקה. ענה במילה אחת בעברית.", [
        { role: "user", content: "אמור: תקין" }
      ]);
      results.push({ label, ok: true, detail: `תקין (${out.modelUsed})`, modelUsed: out.modelUsed });
      // מפתח שעבד - מנקים לו קירור אם היה
      if (c.id !== "legacy") {
        await admin.from("bot_api_keys").update({ cooldown_until: null, last_ok_at: new Date().toISOString() }).eq("id", c.id);
      }
      // אם המודל המוגדר לא עבד אבל אחר כן - שומרים אותו
      if (out.modelUsed && out.modelUsed !== cfg.model) {
        await admin.from("bot_config").update({ model: out.modelUsed, updated_at: new Date().toISOString() }).eq("id", true);
      }
    } catch (err: any) {
      results.push({ label, ok: false, detail: String(err?.message ?? err).slice(0, 250) });
    }
  }

  const anyOk = results.some((r) => r.ok);
  return NextResponse.json({
    ok: anyOk,
    results,
    availableModels,
    error: anyOk ? undefined : results.map((r) => `${r.label}: ${r.detail}`).join(" | ")
  });
}
