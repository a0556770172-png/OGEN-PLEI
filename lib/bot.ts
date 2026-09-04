import { createAdminSupabase } from "./supabase/admin";
import { getCategoriesServer } from "./categories";
import { getSiteSettingsServer } from "./settings";
import { DEFAULT_SITE_RULES_HTML } from "./siteRulesDefault";
import { LIMITS, MAX_SUGGESTION_MB, REFERRAL } from "./constants";
import { toolDeclarations, executeTool, type ToolContext, type BotAppCard, type ProposedAction, type ClientAction } from "./botTools";
import { getKeyCandidates, countUsableKeys, markKeyQuota, markKeyBroken, markKeyOk, type KeyCandidate } from "./botKeys";

export interface BotConfig {
  enabled: boolean;
  gemini_api_key: string | null;
  keyCount: number;
  model: string;
  model_smart: string | null;
  system_prompt: string | null;
  daily_limit: number;
  proactive_enabled: boolean;
  max_tool_rounds: number;
}

// קריאת הגדרות הבוט - שרת בלבד (מפתח ה-API אסור שיגיע ללקוח).
// select("*") בכוונה: אם מיגרציה עוד לא רצה, עמודות חדשות פשוט חסרות ולא מפילות את כל השאילתה.
export async function getBotConfig(): Promise<BotConfig> {
  const admin = createAdminSupabase();
  const { data } = await admin.from("bot_config").select("*").eq("id", true).maybeSingle();
  const keyCount = await countUsableKeys().catch(() => (data?.gemini_api_key ? 1 : 0));
  return {
    enabled: data?.enabled ?? false,
    gemini_api_key: data?.gemini_api_key ?? null,
    keyCount,
    model: data?.model || "gemini-2.5-flash",
    model_smart: data?.model_smart ?? null,
    system_prompt: data?.system_prompt ?? null,
    daily_limit: data?.daily_limit ?? 30,
    proactive_enabled: data?.proactive_enabled ?? true,
    max_tool_rounds: data?.max_tool_rounds ?? 5
  };
}

// הבוט "חי" רק אם הופעל בניהול וגם יש לפחות מפתח API אחד זמין.
export function botIsLive(cfg: BotConfig): boolean {
  return cfg.enabled && cfg.keyCount > 0;
}

export const DEFAULT_BOT_SYSTEM_PROMPT = `אתה "עוזר עוגן פליי" - סוכן חכם וידידותי של אתר "עוגן פליי", מאגר/חנות אפליקציות אנדרואיד ותוכנות מחשב מסוננות ומאושרות לציבור החרדי (בסטנדרט "נטפרי").

## סגנון - ישראלי, חברי, בגובה העיניים
- דבר עברית מדוברת וישראלית טבעית, כמו חבר טוב שעוזר. לא רשמי ולא רובוטי.
- שלב סלנג ישראלי קליל וטבעי: "אחי", "אין בעיה", "יאללה", "סבבה", "תכל'ס", "וואלה", "על הכיף", "בקטנה", "רגע אחד", "בוא נראה". אל תגזים - שתי מילות סלנג בתשובה זה מספיק, שיישמע טבעי ולא מאולץ.
- תשובות קצרות וזורמות. משפטים קצרים. אל תמלל.
- אתה מכיר את מי שמולך (בלוק "המשתמש הנוכחי") - פנה אליו בשם, תגיב להתקדמות שלו ("וואלה יפה, כבר X מוניטין אחי").
- שמור על כבוד ונקיות דיבור שמתאימים לקהל חרדי - סלנג חברי כן, גסויות או ביטויים לא צנועים לא.

## כלים
- יש לך כלים לשליפת מידע אמיתי (חיפוש אפליקציות, פרטי אפליקציה, המלצות, מצב המשתמש, חוקים, קישור הפניה, התראות ועוד). השתמש בהם - אל תנחש ואל תמציא.
- **התראות:** get_my_notifications = מה חדש/מה פספס המשתמש. get_my_notification_subscriptions = למי הוא עוקב. manage_notification = רישום/ביטול מנוי (למפתח, לאפליקציה ספציפית לגרסה חדשה, לקטגוריה, או לכל חדש). אם משתמש אומר "תעדכן אותי כשיוצא עדכון ל-X" / "תרשם אותי להתראות מהמפתח Y" - פשוט תעשה את זה עם manage_notification.
- כשאתה ממליץ על אפליקציה, כתוב את שמה כקישור מרקדאון: [שם](/apps/<id>) לפי ה-id שהכלי החזיר. לעולם אל תמציא id.
- אם משתמש רוצה לפנות לצוות או להציע אפליקציה - השתמש ב-propose_support_ticket / propose_app_suggestion (המשתמש יאשר לפני שנשלח).

## פעולה ישירה - אתה יכול להזיז את המשתמש (חשוב מאוד!)
- **הורדה:** משתמש שמחפש אפליקציה ומצאת לו אותה - הצע לו להוריד עם offer_download. אם הוא כותב "כן"/"תוריד"/"תוריד לי" - קרא ל-offer_download עם auto=true והצ'אט יתחיל את ההורדה לבד.
- **העלאה:** מפתח שרוצה להעלות - שאל אותו קצר על שם האפליקציה, תיאור וקטגוריה, ואז קרא ל-start_upload עם הפרטים. הדף ייפתח לו עם השדות ממולאים. אם הוא מוכן - auto=true.
- **ניווט:** משתמש שרוצה להגיע למקום (תמיכה, בקשות קהילה, הרשמה כמפתח) - השתמש ב-go_to_page.
- אל תבקש אישור מיותר - אם הכוונה של המשתמש ברורה, פשוט תבצע (auto=true).

## דחיפה לפעולה (חשוב מאוד!)
- כל תשובה חייבת להסתיים בצעד הבא הרלוונטי + קישור/כפתור. לעולם אל תסיים תשובה בלי כיוון.
- **תמיד כמת את התגמול במספרים מדויקים.** לא "תרוויח מוניטין" אלא "עוד 2 הורדות היום = +4 מוניטין" או "3 הזמנות = +75, וזה מביא אותך ל-PRO".
- כשמתאים, השתמש ב-what_can_i_earn_today כדי לתת למשתמש רשימה קונקרטית של מה שהוא יכול להשיג עכשיו.
- עורר תחרותיות בעדינות: get_leaderboard כשהמשתמש שואל על התקדמות.
- שלב את הדחיפות מהבלוק "מה כדאי לדחוף אותו לעשות" - כשזה רלוונטי, לא בכוח.
- דוגמאות: מחפש אפליקציות ולא הזמין חברים → draft_referral_message + "כל חבר = 25 מוניטין". משתמש רגיל ששואל על העלאה → הצע start_upload / הרשמה כמפתח. מפתח קרוב ל-PRO → תגיד לו בדיוק כמה חסר ואיך הכי מהר.
- כשהמשתמש מצא אפליקציה שהוא רוצה → offer_download מיד. אל תסביר יותר מדי.

## מה גורם לרצות לחזור
- קצר, חם, אנרגטי, ישראלי. חבר אמיתי שמכיר את האתר ורוצה שהמשתמש יצליח בו - לא נציג שירות.
- תגיב להתקדמות ("יאללה אחי, עוד קצת ואתה ב-PRO"), חגוג הישגים, תן תחושה שיש עם מי לדבר.

## גבולות
- ענה רק על עוגן פליי, האפליקציות שבו, והשימוש בהן. סרב בנימוס לכל דבר אחר, לא צנוע, או לא הולם לקהל החרדי, והחזר לנושא.
- אינך מוסמך לאשר/לדחות אפליקציות, לחסום, או לשנות הרשאות. להחלטות כאלה הפנה לצוות.

## פורמט סיום
בשורה נפרדת אחרונה, כתוב בדיוק: הצעות המשך: שאלה 1 | שאלה 2 | שאלה 3
(שלוש שאלות המשך קצרות שהמשתמש עשוי לרצות לשאול. השורה הזו תוסתר מהמשתמש ותוצג ככפתורים.)`;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// בונה את הקשר הידע הקבוע שנשלח ל-Gemini: עובדות על האתר + חוקי האתר + רשימת הקטגוריות.
// את מאגר האפליקציות הסוכן שולף לבד דרך הכלי search_apps (RAG-via-tools) ולא בדחיפה.
export async function buildBotGrounding(): Promise<string> {
  const [categories, settings] = await Promise.all([getCategoriesServer(), getSiteSettingsServer()]);
  const rulesText = stripHtml(settings.site_rules_html || DEFAULT_SITE_RULES_HTML).slice(0, 6000);

  const facts = [
    `מכסות מפתח רגיל: עד ${LIMITS.free.maxApps} אפליקציות/תוכנות, עד ${LIMITS.free.maxFileMb}MB לקובץ.`,
    `מכסות מפתח PRO: עד ${LIMITS.pro.maxApps} אפליקציות/תוכנות, עד ${LIMITS.pro.maxFileMb}MB לקובץ.`,
    `הצעת אפליקציה ציבורית: עד ${MAX_SUGGESTION_MB}MB לקובץ, לא נספרת במכסת המפתח.`,
    `מקורות מוניטין: +5 על אפליקציה פרטית שאושרה, +5 על הצעה ציבורית שאושרה, +2 על כל הורדה של אפליקציה שהעלית (עד 10 ליום), +${REFERRAL.referrerPoints} על הפניה מוצלחת, +20 על מילוי בקשת קהילה (העלאה שממלאת בקשה מלוח /community).`,
    `שדרוג ל-PRO אוטומטי בהגעה ל-300 מוניטין (או בקשה ידנית מהצוות, או תרומה של 3$+).`,
    `מערכת הפניות: קישור אישי בפרופיל (/?ref=שם-המשתמש). המפנה מקבל ${REFERRAL.referrerPoints} מוניטין + קרדיט העלאה של ${REFERRAL.sizeOverrideMb}MB, והמצטרף ${REFERRAL.joinerPoints} מוניטין. עד ${REFERRAL.dailyRewardCap} הפניות מתוגמלות ביום.`,
    `כתיבת תגובות נפתחת אחרי 5 אפליקציות שאושרו; לייקים אחרי 15; צ'אט בין משתמשים אחרי 10. PRO וצוות - פתוח תמיד.`,
    `שני מסלולי העלאה: "פרטי" (מפתחים, תוכן עצמי, ניתן לעריכה, /profile) מול "הוספה למאגר / הצעה ציבורית" (כל משתמש, אפליקציה מוכרת קיימת, /suggest-app).`,
    `דפים: חנות /, בקשות קהילה /community, הסברים /about, חוקי האתר /site-rules, תמיכה /support, פרופיל /profile, הרשמה כמפתח /profile/become-developer.`,
    `קטגוריות (value → תווית): ${categories.map((c) => `${c.value}→${c.label}`).join(", ")}.`
  ].join("\n");

  return `## עובדות על עוגן פליי\n${facts}\n\n## חוקי האתר\n${rulesText}`;
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

// קריאה ל-Google Gemini עם fallback אוטומטי בין מודלים (מפתח בודד - לבדיקת מפתח).
export async function callGeminiWithFallback(
  apiKey: string,
  preferredModel: string,
  systemInstruction: string,
  turns: GeminiTurn[]
): Promise<GeminiResult> {
  const candidates = [preferredModel, ...MODEL_FALLBACKS.filter((m) => m !== preferredModel)];

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

// ============================================================
// לולאת הסוכן (Agent Loop) - function calling
// ============================================================

async function geminiGenerateRaw(apiKey: string, model: string, body: any): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
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
    // non-JSON
  }
  if (!res.ok) {
    const errMsg = data?.error?.message || raw.slice(0, 400) || `HTTP ${res.status}`;
    const e: any = new Error(`Gemini ${res.status} [${model}]: ${errMsg}`);
    // מודל לא קיים -> נסה מודל אחר (אותו מפתח)
    e.retryable = res.status === 404 || /not found|not supported|is not found|unknown name/i.test(errMsg);
    // מכסה / קצב -> החלף מפתח והכנס את הנוכחי לקירור
    e.keyQuota = res.status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit|too many requests/i.test(errMsg);
    // מפתח לא תקין / מושעה / חסום -> כבה את המפתח
    e.keyBroken =
      res.status === 401 ||
      /API_KEY_INVALID|API key not valid|suspended|has been suspended|PERMISSION_DENIED|consumer.*suspended/i.test(errMsg);
    throw e;
  }
  return data;
}

function splitFollowUps(text: string): { clean: string; followUps: string[] } {
  const idx = text.lastIndexOf("הצעות המשך:");
  if (idx === -1) return { clean: text.trim(), followUps: [] };
  const after = text.slice(idx + "הצעות המשך:".length);
  const followUps = after.split("|").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean).slice(0, 3);
  return { clean: text.slice(0, idx).trim(), followUps };
}

export interface BotAgentResult {
  text: string;
  followUps: string[];
  appCards: BotAppCard[];
  proposedAction: ProposedAction | null;
  clientAction: ClientAction | null;
  modelUsed: string;
  toolLog: { tool: string; args: any; ok: boolean; summary: string; ms: number }[];
}

export async function runBotAgent(
  cfg: BotConfig,
  systemInstruction: string,
  turns: GeminiTurn[],
  ctx: ToolContext
): Promise<BotAgentResult> {
  const decls = toolDeclarations(ctx);
  const contents: any[] = turns.map((t) => ({
    role: t.role === "assistant" ? "model" : "user",
    parts: [{ text: t.content }]
  }));

  const appCards: BotAppCard[] = [];
  let proposedAction: ProposedAction | null = null;
  let clientAction: ClientAction | null = null;
  const toolLog: BotAgentResult["toolLog"] = [];
  const modelCandidates = [cfg.model, ...MODEL_FALLBACKS.filter((m) => m !== cfg.model)];
  const maxRounds = Math.min(8, Math.max(1, cfg.max_tool_rounds || 5));

  // מאגר המפתחות (עם רוטציה). מפתח+מודל שעבדו - "נדבקים" לשאר הסבבים.
  let keyCandidates: KeyCandidate[] = await getKeyCandidates();
  if (keyCandidates.length === 0) throw new Error("לא הוגדר אף מפתח Gemini API");
  let workingKey: KeyCandidate | null = null;
  let workingModel: string | null = null;
  let modelUsed = cfg.model;

  // מנסה מפתח אחר מפתח ומודל אחר מודל, מסמן כשלונות, ומחזיר את הבקשה שהצליחה.
  async function generate(body: any): Promise<any> {
    const keys = workingKey ? [workingKey] : keyCandidates;
    const models = workingModel ? [workingModel] : modelCandidates;
    let lastErr: any = null;
    for (const k of keys) {
      for (const m of models) {
        try {
          const data = await geminiGenerateRaw(k.key, m, body);
          markKeyOk(k.id).catch(() => {});
          workingKey = k;
          workingModel = m;
          modelUsed = m;
          return data;
        } catch (e: any) {
          lastErr = e;
          if (e?.keyQuota) {
            markKeyQuota(k.id, String(e.message)).catch(() => {});
            break; // המפתח הזה נגמר - למפתח הבא
          }
          if (e?.keyBroken) {
            markKeyBroken(k.id, String(e.message)).catch(() => {});
            break;
          }
          if (e?.retryable) continue; // מודל לא קיים - למודל הבא (אותו מפתח)
          throw e; // שגיאה אחרת - עוצרים
        }
      }
      // אם המפתח הנוכחי "נדבק" ונכשל - מנקים אותו וממשיכים למאגר המלא
      if (workingKey && workingKey.id === k.id) {
        workingKey = null;
        workingModel = null;
      }
    }
    throw lastErr ?? new Error("Gemini: כל המפתחות והמודלים נכשלו");
  }

  for (let round = 0; round <= maxRounds; round++) {
    const body = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      tools: [{ functionDeclarations: decls }],
      generationConfig: { temperature: 0.45, maxOutputTokens: 1600 }
    };

    const data: any = await generate(body);

    if (data?.promptFeedback?.blockReason) {
      return {
        text: "מצטער, לא אוכל לענות על השאלה הזו. אפשר לשאול אותי על עוגן פליי או על האפליקציות שבמאגר.",
        followUps: [],
        appCards,
        proposedAction,
        clientAction,
        modelUsed,
        toolLog
      };
    }

    const modelContent = data?.candidates?.[0]?.content;
    const parts: any[] = modelContent?.parts ?? [];
    // חשוב: functionCall יכול לבוא עם thoughtSignature על ה-part (במודלים חדשים עם "חשיבה").
    // צריך לשמור את ה-part המלא, לא רק את ה-functionCall.
    const callParts = parts.filter((p) => p.functionCall);
    const calls = callParts.map((p) => p.functionCall);

    if (calls.length === 0 || round === maxRounds) {
      const text = parts.map((p) => p.text).filter(Boolean).join("").trim();
      const { clean, followUps } = splitFollowUps(text);
      return {
        text: clean || "לא הצלחתי לנסח תשובה כרגע. אפשר לנסות שוב, או לפנות לצוות דרך עמוד התמיכה (/support).",
        followUps,
        appCards,
        proposedAction,
        clientAction,
        modelUsed,
        toolLog
      };
    }

    // מהדהדים את תוכן המודל בדיוק כפי שהתקבל (כולל thoughtSignature על ה-parts).
    contents.push(modelContent ?? { role: "model", parts: callParts });

    const responseParts: any[] = [];
    for (const c of calls) {
      const t0 = Date.now();
      let outcome;
      try {
        outcome = await executeTool(c.name, c.args ?? {}, ctx);
      } catch (e: any) {
        outcome = { result: { error: String(e?.message ?? e).slice(0, 200) }, summary: `${c.name} threw` };
      }
      const ok = !(outcome.result && (outcome.result as any).error);
      toolLog.push({ tool: c.name, args: c.args ?? {}, ok, summary: outcome.summary, ms: Date.now() - t0 });
      if (outcome.appCards) {
        for (const card of outcome.appCards) if (!appCards.find((x) => x.id === card.id)) appCards.push(card);
      }
      if (outcome.proposedAction) proposedAction = outcome.proposedAction;
      if (outcome.clientAction) clientAction = outcome.clientAction;
      const fr: any = { name: c.name, response: { data: outcome.result } };
      if (c.id) fr.id = c.id; // מזהה לשיוך בקריאות מקבילות (API חדש)
      responseParts.push({ functionResponse: fr });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return { text: "לא הצלחתי לנסח תשובה כרגע.", followUps: [], appCards, proposedAction, clientAction, modelUsed, toolLog };
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
