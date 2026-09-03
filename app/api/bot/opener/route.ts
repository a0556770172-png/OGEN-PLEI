import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getBotConfig, botIsLive } from "@/lib/bot";
import { getUserAppUpdates } from "@/lib/updates";
import { REFERRAL } from "@/lib/constants";
import { LIKE_UNLOCK_THRESHOLD, COMMENT_UNLOCK_THRESHOLD } from "@/lib/engagement-eligibility";

// הודעת פתיחה יזומה - נבנית בשרת ללא קריאה ל-Gemini (זול). מטרה: לגרום למשתמש לחזור
// לפעולה בכל כניסה. showAuto=true אומר לצ'אט-ווידג'ט לקפוץ מעצמו (פעם ביום).
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ opener: null });
  const { user, profile } = result;

  const cfg = await getBotConfig();
  if (!botIsLive(cfg) || !cfg.proactive_enabled) return NextResponse.json({ opener: null });

  const admin = createAdminSupabase();
  const staff = isStaff(profile);
  const isDeveloper = profile.role === "developer" || profile.role === "admin";
  const points = profile.points ?? 0;
  const name = profile.username;

  // מתי הוצגה הודעת פתיחה לאחרונה (לחישוב "מה חדש מאז") - עמיד למצב שמיגרציה 0037 עוד לא רצה.
  let lastOpenerAt: string | null = null;
  try {
    const { data } = await admin.from("profiles").select("bot_opener_at").eq("id", user.id).maybeSingle();
    lastOpenerAt = (data as any)?.bot_opener_at ?? null;
  } catch {
    // ignore
  }
  const since = lastOpenerAt || new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [{ count: activeApps }, { count: approvedApps }, { count: referred }, { count: downloads }, { data: recentDl }] =
    await Promise.all([
      admin.from("apps").select("id", { count: "exact", head: true }).eq("developer_id", user.id).neq("status", "archived"),
      admin.from("apps").select("id", { count: "exact", head: true }).eq("developer_id", user.id).eq("status", "approved"),
      admin.from("referral_events").select("id", { count: "exact", head: true }).eq("referrer_id", user.id).eq("status", "rewarded"),
      admin.from("download_events").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      admin.from("download_events").select("apps(category)").eq("user_id", user.id).limit(40)
    ]);

  const favCats = [...new Set((recentDl ?? []).map((d: any) => d.apps?.category).filter(Boolean))];
  const uploaded = approvedApps ?? 0;

  // כמה אפליקציות חדשות עלו מאז הביקור הקודם (בקטגוריות שהמשתמש אוהב, אם יש)
  let newAppsCount = 0;
  {
    let q = admin.from("apps").select("id", { count: "exact", head: true }).eq("status", "approved").gt("created_at", since);
    if (favCats.length) q = q.in("category", favCats);
    const { count } = await q;
    newAppsCount = count ?? 0;
  }

  // כמה אפליקציות שהמשתמש הוריד קיבלו עדכון
  let updatesCount = 0;
  try {
    updatesCount = (await getUserAppUpdates(user.id)).size;
  } catch {
    // ignore
  }

  // ---- בחירת ההודעה: חגיגה > מה חדש > דחיפה לפי מצב ----
  let opener: string;
  let followUps: string[];

  const dlToday = 0; // (מתן מוניטין מוגבל ל-10 הורדות ביום; נשמור פשוט)
  const pointsToPro = profile.is_pro || staff ? 0 : Math.max(0, 300 - points);

  if (updatesCount > 0) {
    opener = `היי ${name}! 👋 ${updatesCount === 1 ? "אפליקציה אחת שהורדת קיבלה" : `${updatesCount} אפליקציות שהורדת קיבלו`} גרסה חדשה. רוצה שאראה לך אילו?`;
    followUps = ["מה קיבל עדכון?", "המלץ לי על עוד אפליקציות", pointsToPro ? `כמה חסר לי ל-PRO?` : "כמה מוניטין יש לי?"];
  } else if (newAppsCount >= 3) {
    opener = `אחי ${name}, מאז שהיית פה נכנסו ${newAppsCount} אפליקציות חדשות${favCats.length ? " בדיוק בקטגוריות שאתה אוהב" : ""}. יאללה, רוצה לראות את הטובות?`;
    followUps = ["מה חדש?", "המלץ לי על אפליקציות", "מה הכי מורד השבוע?"];
  } else if (!staff && !profile.is_pro && pointsToPro > 0 && pointsToPro <= 60) {
    opener = `${name}, אתה ממש קרוב! ${points} מוניטין, ועוד ${pointsToPro} ואתה ב-PRO אוטומטית. הכי מהיר: ${Math.ceil(pointsToPro / REFERRAL.referrerPoints)} הזמנות חברים (${REFERRAL.referrerPoints} כל אחת). בוא נראה איך סוגרים את זה?`;
    followUps = ["מה קישור ההפניה שלי?", "איך מעלים אפליקציה?", "מה נותן PRO?"];
  } else if (!isDeveloper) {
    opener = `היי ${name}! יש לך ${points} מוניטין. רוצה לצבור מהר? הרשמה כמפתח לוקחת 30 שניות ופותחת לך להעלות אפליקציות — כל אחת שמאושרת = 5 מוניטין, ועוד 2 על כל הורדה. שווה, לא?`;
    followUps = ["איך נרשמים כמפתח?", "מה ההבדל בין מפתח למשתמש?", "מצא לי אפליקציה"];
  } else if ((referred ?? 0) === 0) {
    opener = `אחי ${name}, יש לך דרך קלה למוניטין שאתה בכלל לא מנצל — קישור ההפניה שלך. כל חבר שנרשם דרכו = ${REFERRAL.referrerPoints} מוניטין + קרדיט העלאה, והוא מקבל ${REFERRAL.joinerPoints}. רוצה שאכין לך הודעה מוכנה לוואטסאפ?`;
    followUps = ["הכן לי הודעת שיתוף", "מה קישור ההפניה שלי?", "כמה מוניטין צברתי?"];
  } else if (isDeveloper && !profile.is_pro && uploaded < COMMENT_UNLOCK_THRESHOLD) {
    opener = `${name}, העלית ${uploaded} אפליקציות שאושרו — יפה! עוד ${COMMENT_UNLOCK_THRESHOLD - uploaded} ואתה פותח תגובות. תכל'ס, יש בקשות קהילה פתוחות שאתה יכול למלא ולצבור — רוצה לראות?`;
    followUps = ["הראה לי בקשות קהילה", "מה כדאי לי להעלות?", "עזור לי לנסח תיאור לאפליקציה"];
  } else if ((downloads ?? 0) > 0) {
    opener = `היי ${name}! רוצה שאמצא לך אפליקציות חדשות בקטגוריות שאתה אוהב, או שאבדוק אם משהו שהורדת קיבל עדכון?`;
    followUps = ["המלץ לי על אפליקציות", "מה קיבל עדכון?", "מצא לי אפליקציה אופליין"];
  } else {
    opener = `וואלה ${name}, אני יכול למצוא לך אפליקציה לפי מה שאתה צריך, להסביר איך צוברים מוניטין, או להראות מה חדש. מה בא לך?`;
    followUps = ["מצא לי אפליקציה", "איך צוברים מוניטין?", "מה הכי מורד באתר?"];
  }

  // מעדכנים את חותמת הזמן (best-effort) כדי ש"מה חדש מאז" יעבוד בפעם הבאה.
  try {
    await admin.from("profiles").update({ bot_opener_at: new Date().toISOString() }).eq("id", user.id);
  } catch {
    // ignore
  }

  return NextResponse.json({ opener, followUps, showAuto: true });
}
