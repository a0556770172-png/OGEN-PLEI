import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { countUsableKeys } from "@/lib/botKeys";

// הגדרות הצ'אט-בוט - מנהל בפועל בלבד. מפתח ה-API לעולם לא מוחזר ללקוח (רק hasKey).
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.profile.role !== "admin") return NextResponse.json({ error: "רק מנהל בפועל" }, { status: 403 });

  const admin = createAdminSupabase();
  // select("*") - עמיד לכך שמיגרציה עוד לא רצה (עמודות חדשות פשוט undefined).
  const { data } = await admin.from("bot_config").select("*").eq("id", true).maybeSingle();
  const keyCount = await countUsableKeys().catch(() => (data?.gemini_api_key ? 1 : 0));

  return NextResponse.json({
    enabled: data?.enabled ?? false,
    model: data?.model ?? "gemini-2.5-flash",
    modelSmart: data?.model_smart ?? "",
    systemPrompt: data?.system_prompt ?? "",
    dailyLimit: data?.daily_limit ?? 30,
    proactiveEnabled: data?.proactive_enabled ?? true,
    maxToolRounds: data?.max_tool_rounds ?? 5,
    hasKey: keyCount > 0,
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
  if (typeof body.modelSmart === "string") patch.model_smart = body.modelSmart.trim() || null;
  if (typeof body.systemPrompt === "string") patch.system_prompt = body.systemPrompt.trim() || null;
  if (typeof body.proactiveEnabled === "boolean") patch.proactive_enabled = body.proactiveEnabled;
  if (Number.isFinite(body.maxToolRounds)) {
    const n = Math.round(body.maxToolRounds);
    if (n < 1 || n > 8) return NextResponse.json({ error: "סבבי כלים בין 1 ל-8" }, { status: 400 });
    patch.max_tool_rounds = n;
  }
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

  // upsert (ולא update) כדי שגם אם שורת bot_config חסרה מסיבה כלשהי - היא תיווצר.
  let { error } = await admin.from("bot_config").upsert({ id: true, ...patch });

  // אם מיגרציה 0036 עוד לא רצה, עמודות חדשות עלולות להכשיל את השמירה - מנסים שוב בלעדיהן,
  // כדי שלפחות מפתח ה-API וההגדרות הבסיסיות ישמרו.
  if (error && /column .* does not exist|model_smart|proactive_enabled|max_tool_rounds/i.test(error.message || "")) {
    const { model_smart, proactive_enabled, max_tool_rounds, ...safe } = patch as any;
    const retry = await admin.from("bot_config").upsert({ id: true, ...safe });
    error = retry.error;
  }

  if (error) return NextResponse.json({ error: `שגיאה בשמירת ההגדרות: ${error.message}` }, { status: 500 });

  return NextResponse.json({ ok: true });
}
