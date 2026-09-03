import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// הגדרות הצ'אט-בוט - מנהל בפועל בלבד. מפתח ה-API לעולם לא מוחזר ללקוח (רק hasKey).
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.profile.role !== "admin") return NextResponse.json({ error: "רק מנהל בפועל" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data } = await admin
    .from("bot_config")
    .select("enabled, model, system_prompt, daily_limit, gemini_api_key, updated_at")
    .eq("id", true)
    .single();

  return NextResponse.json({
    enabled: data?.enabled ?? false,
    model: data?.model ?? "gemini-2.5-flash",
    systemPrompt: data?.system_prompt ?? "",
    dailyLimit: data?.daily_limit ?? 30,
    hasKey: !!data?.gemini_api_key,
    updatedAt: data?.updated_at ?? null
  });
}

export async function PATCH(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.profile.role !== "admin") return NextResponse.json({ error: "רק מנהל בפועל" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };

  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.model === "string" && body.model.trim()) patch.model = body.model.trim();
  if (typeof body.systemPrompt === "string") patch.system_prompt = body.systemPrompt.trim() || null;
  if (Number.isFinite(body.dailyLimit)) {
    const n = Math.round(body.dailyLimit);
    if (n < 1 || n > 1000) return NextResponse.json({ error: "מגבלה יומית חייבת להיות בין 1 ל-1000" }, { status: 400 });
    patch.daily_limit = n;
  }
  // מפתח API: מעדכנים רק אם נשלח מחרוזת לא-ריקה. שליחת "" מפורשת מנקה אותו (כיבוי הבוט).
  if (typeof body.geminiApiKey === "string") {
    patch.gemini_api_key = body.geminiApiKey.trim() || null;
  }

  const admin = createAdminSupabase();
  const { error } = await admin.from("bot_config").update(patch).eq("id", true);
  if (error) return NextResponse.json({ error: "שגיאה בשמירת ההגדרות" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
