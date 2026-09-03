import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

function mask(key: string): string {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

// רשימת מפתחות ה-Gemini במאגר. המפתח עצמו אף פעם לא מוחזר - רק מסכה + סטטוס.
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.profile.role !== "admin") return NextResponse.json({ error: "רק מנהל בפועל" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("bot_api_keys")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    // הטבלה עוד לא קיימת (מיגרציה 0038)
    return NextResponse.json({ keys: [], tableMissing: true });
  }

  const now = Date.now();
  return NextResponse.json({
    keys: (data ?? []).map((k: any) => ({
      id: k.id,
      label: k.label,
      masked: mask(k.api_key),
      enabled: k.enabled,
      inCooldown: !!k.cooldown_until && new Date(k.cooldown_until).getTime() > now,
      cooldownUntil: k.cooldown_until,
      lastError: k.last_error,
      lastErrorAt: k.last_error_at,
      lastOkAt: k.last_ok_at,
      okCount: k.ok_count,
      failCount: k.fail_count,
      sortOrder: k.sort_order
    }))
  });
}

// הוספת מפתח חדש למאגר.
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.profile.role !== "admin") return NextResponse.json({ error: "רק מנהל בפועל" }, { status: 403 });

  const { apiKey, label } = await request.json().catch(() => ({}));
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!key || key.length < 20) return NextResponse.json({ error: "מפתח לא תקין" }, { status: 400 });

  const admin = createAdminSupabase();

  const { data: existing } = await admin.from("bot_api_keys").select("id, api_key, sort_order");
  if ((existing ?? []).some((k: any) => k.api_key === key)) {
    return NextResponse.json({ error: "המפתח הזה כבר במאגר" }, { status: 400 });
  }
  const maxOrder = Math.max(0, ...(existing ?? []).map((k: any) => k.sort_order ?? 0));

  const { error } = await admin.from("bot_api_keys").insert({
    api_key: key,
    label: typeof label === "string" ? label.trim().slice(0, 60) : "",
    sort_order: maxOrder + 1
  });
  if (error) return NextResponse.json({ error: `שגיאה בהוספה: ${error.message}` }, { status: 500 });

  // מיגרציה חד-פעמית: אם היה מפתח בודד ישן ב-bot_config - מעבירים אותו למאגר ומנקים.
  try {
    const { data: cfg } = await admin.from("bot_config").select("gemini_api_key").eq("id", true).maybeSingle();
    const legacy = (cfg as any)?.gemini_api_key;
    if (legacy && legacy !== key && !(existing ?? []).some((k: any) => k.api_key === legacy)) {
      await admin.from("bot_api_keys").insert({ api_key: legacy, label: "מפתח ישן (הועבר)", sort_order: maxOrder + 2 });
      await admin.from("bot_config").update({ gemini_api_key: null }).eq("id", true);
    } else if (legacy === key) {
      await admin.from("bot_config").update({ gemini_api_key: null }).eq("id", true);
    }
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true });
}
