import { createAdminSupabase } from "./supabase/admin";
import { callGeminiWithFallback, type BotConfig } from "./bot";
import { getKeyCandidates, markKeyQuota, markKeyBroken, markKeyOk } from "./botKeys";
import { notifyAdminsInApp } from "./notifications";

// הסתרה אוטומטית של הבוט כשהוא לא מצליח לענות, והחזרה אוטומטית כשהוא מתאושש.
//
// - כל פעם שהבוט נכשל כי כל המפתחות/המודלים נכשלו - fail_streak עולה. אחרי FAIL_LIMIT
//   כישלונות ברצף הבוט מוסתר (auto_hidden) לכל המשתמשים כאילו אינו קיים, והמנהל מקבל התראה.
// - תשובה מוצלחת מאפסת את הרצף.
// - כל עוד הבוט מוסתר, השרת בודק ברקע כל CHECK_EVERY_MIN דקות אם אחד המפתחות/המודלים חזר
//   לעבוד (בקשת "בדיקה" זעירה לגוגל). אם כן - הבוט חוזר מיד, והמנהל מקבל התראה.
//   הבדיקה מופעלת מבקשות רגילות של האתר (כל טעינת עמוד בודקת את מצב הבוט), ולכן אין צורך
//   ב-cron נפרד בשרת: כל עוד יש מבקרים באתר - הבדיקה רצה כל כמה דקות.
//
// הכול עמיד להרצה לפני מיגרציה 0064: אם העמודות עוד לא קיימות, העדכונים פשוט נכשלים בשקט.

export const FAIL_LIMIT = 2;
export const CHECK_EVERY_MIN = 4;

export async function recordBotFailure(cfg: BotConfig, detail: string): Promise<void> {
  const admin = createAdminSupabase();
  const streak = (cfg.fail_streak ?? 0) + 1;
  const hideNow = streak >= FAIL_LIMIT && !cfg.auto_hidden;
  const patch: Record<string, unknown> = { fail_streak: streak };
  if (hideNow) {
    patch.auto_hidden = true;
    patch.auto_hidden_at = new Date().toISOString();
    patch.health_checked_at = new Date().toISOString();
  }
  const { error } = await admin.from("bot_config").update(patch).eq("id", true);
  if (error || !hideNow) return;

  await notifyAdminsInApp({
    kind: "bot_down",
    title: "הבוט הוסתר אוטומטית",
    body: `הבוט נכשל ${streak} פעמים ברצף (כל המפתחות/המודלים לא עובדים) ולכן הוסתר מכל המשתמשים. השרת בודק כל ${CHECK_EVERY_MIN} דקות ויחזיר אותו לבד כשאחד מהם יעבוד. פירוט: ${detail.slice(0, 160)}`,
    url: "/dashboard/admin?tab=bot"
  }).catch(() => {});
}

export async function recordBotSuccess(cfg: BotConfig): Promise<void> {
  if (!cfg.fail_streak && !cfg.auto_hidden) return; // המקרה הרגיל - בלי כתיבה מיותרת
  await restoreBot(cfg.auto_hidden, "הבוט ענה בהצלחה");
}

async function restoreBot(wasHidden: boolean | undefined, reason: string) {
  const admin = createAdminSupabase();
  const { error } = await admin
    .from("bot_config")
    .update({ fail_streak: 0, auto_hidden: false, auto_hidden_at: null })
    .eq("id", true);
  if (error || !wasHidden) return;
  await notifyAdminsInApp({
    kind: "bot_restored",
    title: "הבוט חזר לפעול אוטומטית",
    body: `${reason} - הבוט מוצג שוב לכל המשתמשים.`,
    url: "/dashboard/admin?tab=bot"
  }).catch(() => {});
}

// נקרא מבקשות רגילות (מצב הבוט). אם הבוט מוסתר ועבר מספיק זמן מהבדיקה הקודמת - "תופס"
// את הבדיקה (עדכון מותנה, כדי שרק בקשה אחת תריץ אותה גם כשהרבה מבקרים נכנסים יחד)
// ומריץ אותה ברקע בלי לעכב את התשובה.
export async function maybeRunHealthCheck(cfg: BotConfig): Promise<void> {
  if (!cfg.auto_hidden || !cfg.enabled) return;
  const threshold = new Date(Date.now() - CHECK_EVERY_MIN * 60 * 1000).toISOString();
  if (cfg.health_checked_at && cfg.health_checked_at > threshold) return;

  const admin = createAdminSupabase();
  let q = admin.from("bot_config").update({ health_checked_at: new Date().toISOString() }).eq("id", true).eq("auto_hidden", true);
  q = cfg.health_checked_at ? q.lt("health_checked_at", threshold) : q.is("health_checked_at", null);
  const { data: claimed } = await q.select("id");
  if (!claimed || claimed.length === 0) return; // בקשה אחרת כבר מריצה את הבדיקה

  void runHealthProbe(cfg).catch(() => {});
}

// בדיקה אמיתית מול גוגל: עוברים על המפתחות, ובכל מפתח על המודלים (עם אותו מנגנון
// fallback של הבוט). ההצלחה הראשונה - מחזירה את הבוט.
export async function runHealthProbe(cfg: BotConfig): Promise<boolean> {
  const candidates = await getKeyCandidates();
  for (const cand of candidates) {
    try {
      await callGeminiWithFallback(cand.key, cfg.model, "ענה במילה אחת: OK", [{ role: "user", content: "בדיקת תקינות" }]);
      await markKeyOk(cand.id);
      await restoreBot(true, "בדיקת רקע מצאה מפתח ומודל שעובדים");
      return true;
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (err?.keyQuota) await markKeyQuota(cand.id, msg);
      else if (err?.keyBroken) await markKeyBroken(cand.id, msg);
    }
  }
  return false;
}
