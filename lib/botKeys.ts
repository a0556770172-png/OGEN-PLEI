import { createAdminSupabase } from "./supabase/admin";

// ניהול מאגר מפתחי Gemini API + רוטציה אוטומטית. שרת בלבד.

export interface BotApiKey {
  id: string;
  label: string;
  api_key: string;
  enabled: boolean;
  cooldown_until: string | null;
  last_error: string | null;
  last_error_at: string | null;
  last_ok_at: string | null;
  ok_count: number;
  fail_count: number;
  sort_order: number;
  created_at: string;
}

// מפתח מזוהה - id="legacy" הוא ה-gemini_api_key הישן מ-bot_config (תאימות לאחור).
export interface KeyCandidate {
  id: string;
  key: string;
}

// המפתחות הזמינים כרגע לשימוש, לפי סדר: enabled, לא ב"קירור", לפי sort_order.
// אם המאגר ריק - נופלים חזרה ל-gemini_api_key הבודד מ-bot_config.
export async function getKeyCandidates(): Promise<KeyCandidate[]> {
  const admin = createAdminSupabase();
  const nowIso = new Date().toISOString();

  let pool: any[] = [];
  try {
    const { data } = await admin
      .from("bot_api_keys")
      .select("*")
      .eq("enabled", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    pool = data ?? [];
  } catch {
    // הטבלה עוד לא קיימת (מיגרציה 0038 לא רצה) - נופלים למפתח הבודד
  }

  const available = pool.filter((k) => !k.cooldown_until || k.cooldown_until <= nowIso);
  // אם כל המפתחות ב"קירור" - ננסה בכל זאת את זה עם הקירור הקצר ביותר (עדיף מכלום).
  const usable = available.length ? available : pool.slice().sort((a, b) => (a.cooldown_until ?? "") < (b.cooldown_until ?? "") ? -1 : 1).slice(0, 1);

  const candidates: KeyCandidate[] = usable.map((k) => ({ id: k.id, key: k.api_key }));

  // תאימות לאחור: המפתח הבודד הישן, כ-fallback אחרון (או יחיד אם המאגר ריק).
  try {
    const { data: cfg } = await admin.from("bot_config").select("gemini_api_key").eq("id", true).maybeSingle();
    const legacy = (cfg as any)?.gemini_api_key;
    if (legacy && !candidates.find((c) => c.key === legacy)) {
      candidates.push({ id: "legacy", key: legacy });
    }
  } catch {
    // ignore
  }

  return candidates;
}

// כמה מפתחות פעילים יש בסך הכל (למסך הניהול ולבדיקת "הבוט חי").
export async function countUsableKeys(): Promise<number> {
  const cands = await getKeyCandidates();
  return cands.length;
}

// מנתח retryDelay משגיאת 429 של Gemini (למשל "37s") -> שניות.
function parseRetrySeconds(errText: string): number | null {
  const m = errText.match(/"?retryDelay"?\s*:?\s*"?(\d+(?:\.\d+)?)s"?/i) || errText.match(/retry in (\d+)/i);
  return m ? Math.ceil(parseFloat(m[1])) : null;
}

// מסמן מפתח כ"נכשל בגלל מכסה/קצב" ומכניס אותו ל"קירור".
export async function markKeyQuota(keyId: string, errText: string): Promise<void> {
  if (keyId === "legacy") return; // המפתח הישן לא במאגר
  const retry = parseRetrySeconds(errText);
  // אם יש retryDelay קצר -> זו כנראה מגבלת דקה. אם אין / גדול -> כנראה מכסה יומית, קירור ארוך.
  const seconds = retry && retry < 300 ? retry + 15 : 60 * 60; // דקה+ או שעה
  const until = new Date(Date.now() + seconds * 1000).toISOString();
  const admin = createAdminSupabase();
  try {
    const { data: cur } = await admin.from("bot_api_keys").select("fail_count").eq("id", keyId).maybeSingle();
    await admin
      .from("bot_api_keys")
      .update({
        cooldown_until: until,
        last_error: errText.slice(0, 400),
        last_error_at: new Date().toISOString(),
        fail_count: ((cur as any)?.fail_count ?? 0) + 1
      })
      .eq("id", keyId);
  } catch {
    // ignore
  }
}

// שגיאה אחרת (401/403 מפתח לא תקין) - מכבים את המפתח לגמרי.
export async function markKeyBroken(keyId: string, errText: string): Promise<void> {
  if (keyId === "legacy") return;
  const admin = createAdminSupabase();
  try {
    const { data: cur } = await admin.from("bot_api_keys").select("fail_count").eq("id", keyId).maybeSingle();
    await admin
      .from("bot_api_keys")
      .update({
        enabled: false,
        last_error: errText.slice(0, 400),
        last_error_at: new Date().toISOString(),
        fail_count: ((cur as any)?.fail_count ?? 0) + 1
      })
      .eq("id", keyId);
  } catch {
    // ignore
  }
}

// המפתח עבד - מנקים קירור ומעדכנים סטטיסטיקה.
export async function markKeyOk(keyId: string): Promise<void> {
  if (keyId === "legacy") return;
  const admin = createAdminSupabase();
  try {
    const { data: cur } = await admin.from("bot_api_keys").select("ok_count").eq("id", keyId).maybeSingle();
    await admin
      .from("bot_api_keys")
      .update({ cooldown_until: null, last_ok_at: new Date().toISOString(), ok_count: ((cur as any)?.ok_count ?? 0) + 1 })
      .eq("id", keyId);
  } catch {
    // ignore
  }
}
