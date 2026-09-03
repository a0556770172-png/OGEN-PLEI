import { createAdminSupabase } from "./supabase/admin";
import { getApprovedApps } from "./apps-data";
import { getCategoriesServer } from "./categories";
import { getSiteSettingsServer } from "./settings";
import { DEFAULT_SITE_RULES_HTML } from "./siteRulesDefault";
import { LIMITS, MAX_SUGGESTION_MB, REFERRAL } from "./constants";

export interface BotConfig {
  enabled: boolean;
  gemini_api_key: string | null;
  model: string;
  system_prompt: string | null;
  daily_limit: number;
}

// קריאת הגדרות הבוט - שרת בלבד (מפתח ה-API אסור שיגיע ללקוח).
export async function getBotConfig(): Promise<BotConfig> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("bot_config")
    .select("enabled, gemini_api_key, model, system_prompt, daily_limit")
    .eq("id", true)
    .single();
  return {
    enabled: data?.enabled ?? false,
    gemini_api_key: data?.gemini_api_key ?? null,
    model: data?.model || "gemini-2.5-flash",
    system_prompt: data?.system_prompt ?? null,
    daily_limit: data?.daily_limit ?? 30
  };
}

// הבוט "חי" רק אם הופעל בניהול וגם הוגדר מפתח API.
export function botIsLive(cfg: BotConfig): boolean {
  return cfg.enabled && !!cfg.gemini_api_key;
}

export const DEFAULT_BOT_SYSTEM_PROMPT = `אתה "עוזר עוגן פליי" - עוזר חכם וידידותי של אתר "עוגן פליי", חנות/מאגר אפליקציות אנדרואיד ותוכנות מחשב מסוננות ומאושרות לציבור החרדי (בסטנדרט "נטפרי").

הנחיות:
- ענה תמיד בעברית, בטון נעים, ברור ותמציתי. עדיף תשובה קצרה וממוקדת.
- אתה עוזר עם: הסבר איך האתר עובד (חוקים, מוניטין, PRO, הפניות, מסלולי העלאה, תמיכה), עזרה בחיפוש אפליקציה/תוכנה מתוך המאגר לפי דרישות המשתמש (קטגוריה, פועל אופליין, גרסת אנדרואיד מינימלית, סוג קובץ APK/תוכנה, פופולריות), והכוונה כללית לשימוש באפליקציות שבמאגר.
- כשאתה ממליץ על אפליקציה מהמאגר, כתוב את שמה כקישור בפורמט מרקדאון: [שם האפליקציה](/apps/<id>) לפי ה-id שמופיע ברשימה שקיבלת. אל תמציא אפליקציות או id-ים שלא ברשימה.
- אם המידע אינו ברשימה שקיבלת, אמור בכנות שאינך יודע והפנה לפנייה לצוות דרך עמוד התמיכה (/support).
- אל תענה על שאלות שאינן קשורות לאתר, לאפליקציות שבו או לשימוש בהן. אם נשאלת משהו לא רלוונטי, לא צנוע, או לא הולם לקהל החרדי - סרב בנימוס והחזר את השיחה לנושא האתר.
- אינך נציג רשמי ואינך מוסמך לאשר/לדחות אפליקציות, לשנות הרשאות, או להבטיח שדרוגים - להחלטות כאלה הפנה לצוות.`;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// בונה את הקשר הידע שנשלח ל-Gemini בכל בקשה: עובדות על האתר, חוקי האתר, ורשימת
// האפליקציות המאושרות (קומפקטית) כדי שהבוט יוכל להמליץ ולחפש בתוכן.
export async function buildBotGrounding(): Promise<string> {
  const [apps, categories, settings] = await Promise.all([
    getApprovedApps(),
    getCategoriesServer(),
    getSiteSettingsServer()
  ]);

  const categoryLabel = new Map(categories.map((c) => [c.value, c.label]));
  const rulesText = stripHtml(settings.site_rules_html || DEFAULT_SITE_RULES_HTML).slice(0, 6000);

  const facts = [
    `מכסות מפתח רגיל: עד ${LIMITS.free.maxApps} אפליקציות/תוכנות, עד ${LIMITS.free.maxFileMb}MB לקובץ.`,
    `מכסות מפתח PRO: עד ${LIMITS.pro.maxApps} אפליקציות/תוכנות, עד ${LIMITS.pro.maxFileMb}MB לקובץ.`,
    `הצעת אפליקציה ציבורית: עד ${MAX_SUGGESTION_MB}MB לקובץ, לא נספרת במכסת המפתח.`,
    `מקורות מוניטין: +5 על אפליקציה פרטית שאושרה, +5 על הצעה ציבורית שאושרה, +2 על כל הורדה של אפליקציה שהעלית (עד 10 ליום).`,
    `שדרוג ל-PRO אוטומטי בהגעה ל-300 מוניטין (או בקשה ידנית מהצוות, או תרומה של 3$+).`,
    `מערכת הפניות: קישור אישי בפרופיל (/?ref=שם-המשתמש). על כל חבר שנרשם דרכו ומאמת מייל - המפנה מקבל ${REFERRAL.referrerPoints} מוניטין + קרדיט העלאה של ${REFERRAL.sizeOverrideMb}MB, והמצטרף מקבל ${REFERRAL.joinerPoints} מוניטין. עד ${REFERRAL.dailyRewardCap} הפניות מתוגמלות ביום.`,
    `כתיבת תגובות נפתחת אחרי 5 אפליקציות שאושרו; לייקים אחרי 15; צ'אט בין משתמשים אחרי 10. PRO וצוות - פתוח תמיד.`,
    `שני מסלולי העלאה: "פרטי" (מפתחים, תוכן עצמי, ניתן לעריכה) מול "הוספה למאגר / הצעה ציבורית" (כל משתמש, אפליקציה מוכרת קיימת, לא ניתן לעריכה אחרי אישור).`,
    `פנייה לצוות: עמוד התמיכה בכתובת /support.`,
    `קטגוריות באתר: ${categories.map((c) => c.label).join(", ")}.`
  ].join("\n");

  const catalog = apps
    .slice(0, 500)
    .map((a) => {
      const isApk = /\.(apk|apks|xapk)$/i.test(a.file_name || "") || /\.(apk|apks|xapk)$/i.test(a.file_key || "");
      const offline =
        a.offline_support === "offline" ? "אופליין" : a.offline_support === "online" ? "דורש אינטרנט" : "לא ידוע";
      const parts = [
        `id=${a.id}`,
        `שם="${a.name}"`,
        `סוג=${isApk ? "אפליקציית אנדרואיד" : "תוכנת מחשב"}`,
        `קטגוריה=${categoryLabel.get(a.category) ?? a.category}`,
        `גרסה=${a.version}`,
        a.min_android_version ? `אנדרואיד-מינ׳=${a.min_android_version}` : "",
        `אופליין=${offline}`,
        `הורדות=${a.downloads_count ?? 0}`,
        a.short_description ? `תיאור="${a.short_description.slice(0, 160)}"` : ""
      ].filter(Boolean);
      return parts.join(" | ");
    })
    .join("\n");

  return `## עובדות על עוגן פליי\n${facts}\n\n## חוקי האתר (תקציר)\n${rulesText}\n\n## מאגר האפליקציות והתוכנות המאושרות (${apps.length} פריטים)\n${catalog}`;
}

export interface GeminiTurn {
  role: "user" | "assistant";
  content: string;
}

// רשימת מודלים לנסות לפי סדר - אם המודל שהוגדר לא קיים/לא נתמך למפתח הזה, עוברים
// אוטומטית לבא בתור. השם שהצליח נשמר חזרה ל-bot_config כדי שהפעם הבאה תהיה ישירה.
const MODEL_FALLBACKS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash-001",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-pro-latest"
];

interface GeminiResult {
  text: string;
  modelUsed: string;
}

async function tryOneModel(apiKey: string, model: string, systemInstruction: string, turns: GeminiTurn[]) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: turns.map((t) => ({
      role: t.role === "assistant" ? "model" : "user",
      parts: [{ text: t.content }]
    })),
    generationConfig: { temperature: 0.4, maxOutputTokens: 1200 }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const raw = await res.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    // תשובה לא-JSON
  }

  if (!res.ok) {
    const errMsg = data?.error?.message || raw.slice(0, 300) || `HTTP ${res.status}`;
    // 404 / "not found" / "not supported" -> אפשר לנסות מודל אחר. שאר השגיאות (401/403/מכסה) -> אין טעם.
    const retryable = res.status === 404 || /not found|not supported|is not found|unknown name/i.test(errMsg);
    const e: any = new Error(`Gemini ${res.status} [${model}]: ${errMsg}`);
    e.retryable = retryable;
    e.status = res.status;
    throw e;
  }

  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    return { text: "", blocked: true };
  }
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("") ?? "";
  return { text: text.trim(), blocked: false };
}

// קריאה ל-Google Gemini עם fallback אוטומטי בין מודלים.
export async function callGeminiWithFallback(
  cfg: BotConfig,
  systemInstruction: string,
  turns: GeminiTurn[]
): Promise<GeminiResult> {
  const apiKey = cfg.gemini_api_key || "";
  const candidates = [cfg.model, ...MODEL_FALLBACKS.filter((m) => m !== cfg.model)];

  let lastErr: any = null;
  for (const model of candidates) {
    try {
      const r = await tryOneModel(apiKey, model, systemInstruction, turns);
      if (r.blocked) {
        return {
          text: "מצטער, לא אוכל לענות על השאלה הזו. אפשר לשאול אותי משהו על עוגן פליי או על האפליקציות שבמאגר.",
          modelUsed: model
        };
      }
      if (!r.text) {
        return {
          text: "לא הצלחתי לנסח תשובה כרגע. אפשר לנסות שוב, או לפנות לצוות דרך עמוד התמיכה.",
          modelUsed: model
        };
      }
      return { text: r.text, modelUsed: model };
    } catch (err: any) {
      lastErr = err;
      if (!err?.retryable) break; // 401/403/quota - אין טעם לנסות מודלים אחרים
    }
  }
  throw lastErr ?? new Error("Gemini: כל המודלים נכשלו");
}

// שמות מודלים שזמינים בפועל למפתח ה-API הזה (לכפתור הבדיקה בניהול).
export async function listGeminiModels(apiKey: string): Promise<string[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`רשימת המודלים נכשלה (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data?.models ?? [])
    .filter((m: any) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m: any) => String(m.name || "").replace(/^models\//, ""))
    .filter(Boolean);
}
