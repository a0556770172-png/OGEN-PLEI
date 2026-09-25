import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getBotConfig, botIsLive } from "@/lib/bot";
import { getUserAppUpdates } from "@/lib/updates";
import { REFERRAL } from "@/lib/constants";
import { LIKE_UNLOCK_THRESHOLD, COMMENT_UNLOCK_THRESHOLD } from "@/lib/engagement-eligibility";
import { isEnglishRequest } from "@/lib/i18n/serverLang";

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

  // משתמש שבחר באתר באנגלית (עוגיית ogen-lang) מקבל את אותה הודעה באנגלית.
  const en = isEnglishRequest();

  if (updatesCount > 0) {
    opener = en
      ? `Hi ${name}! 👋 ${updatesCount === 1 ? "One app you downloaded has" : `${updatesCount} apps you downloaded have`} received a new version. Want me to show you which?`
      : `היי ${name}! 👋 ${updatesCount === 1 ? "אפליקציה אחת שהורדת קיבלה" : `${updatesCount} אפליקציות שהורדת קיבלו`} גרסה חדשה. רוצה שאראה לך אילו?`;
    followUps = en
      ? ["What got updated?", "Recommend more apps for me", pointsToPro ? "How much do I need for PRO?" : "How much reputation do I have?"]
      : ["מה קיבל עדכון?", "המלץ לי על עוד אפליקציות", pointsToPro ? `כמה חסר לי ל-PRO?` : "כמה מוניטין יש לי?"];
  } else if (newAppsCount >= 3) {
    opener = en
      ? `Hey ${name}, since you were last here ${newAppsCount} new apps have been added${favCats.length ? " right in the categories you like" : ""}. Want to see the best ones?`
      : `אחי ${name}, מאז שהיית פה נכנסו ${newAppsCount} אפליקציות חדשות${favCats.length ? " בדיוק בקטגוריות שאתה אוהב" : ""}. יאללה, רוצה לראות את הטובות?`;
    followUps = en
      ? ["What's new?", "Recommend some apps for me", "What's most downloaded this week?"]
      : ["מה חדש?", "המלץ לי על אפליקציות", "מה הכי מורד השבוע?"];
  } else if (!staff && !profile.is_pro && pointsToPro > 0 && pointsToPro <= 60) {
    opener = en
      ? `${name}, you're really close! ${points} reputation, and ${pointsToPro} more puts you in PRO automatically. The fastest way: ${Math.ceil(pointsToPro / REFERRAL.referrerPoints)} friend invites (${REFERRAL.referrerPoints} each). Shall we see how to wrap it up?`
      : `${name}, אתה ממש קרוב! ${points} מוניטין, ועוד ${pointsToPro} ואתה ב-PRO אוטומטית. הכי מהיר: ${Math.ceil(pointsToPro / REFERRAL.referrerPoints)} הזמנות חברים (${REFERRAL.referrerPoints} כל אחת). בוא נראה איך סוגרים את זה?`;
    followUps = en
      ? ["What's my referral link?", "How do I upload an app?", "What does PRO give me?"]
      : ["מה קישור ההפניה שלי?", "איך מעלים אפליקציה?", "מה נותן PRO?"];
  } else if (!isDeveloper) {
    opener = en
      ? `Hi ${name}! You have ${points} reputation. Want to earn fast? Signing up as a developer takes 30 seconds and lets you upload apps — each approved one = 5 reputation, plus 2 for every download. Worth it, right?`
      : `היי ${name}! יש לך ${points} מוניטין. רוצה לצבור מהר? הרשמה כמפתח לוקחת 30 שניות ופותחת לך להעלות אפליקציות — כל אחת שמאושרת = 5 מוניטין, ועוד 2 על כל הורדה. שווה, לא?`;
    followUps = en
      ? ["How do I sign up as a developer?", "What's the difference between a developer and a user?", "Find me an app"]
      : ["איך נרשמים כמפתח?", "מה ההבדל בין מפתח למשתמש?", "מצא לי אפליקציה"];
  } else if ((referred ?? 0) === 0) {
    opener = en
      ? `Hey ${name}, there's an easy way to earn reputation that you're not using at all — your referral link. Every friend who signs up through it = ${REFERRAL.referrerPoints} reputation + upload credit, and they get ${REFERRAL.joinerPoints}. Want me to prepare a ready-made WhatsApp message for you?`
      : `אחי ${name}, יש לך דרך קלה למוניטין שאתה בכלל לא מנצל — קישור ההפניה שלך. כל חבר שנרשם דרכו = ${REFERRAL.referrerPoints} מוניטין + קרדיט העלאה, והוא מקבל ${REFERRAL.joinerPoints}. רוצה שאכין לך הודעה מוכנה לוואטסאפ?`;
    followUps = en
      ? ["Prepare a share message for me", "What's my referral link?", "How much reputation have I earned?"]
      : ["הכן לי הודעת שיתוף", "מה קישור ההפניה שלי?", "כמה מוניטין צברתי?"];
  } else if (isDeveloper && !profile.is_pro && uploaded < COMMENT_UNLOCK_THRESHOLD) {
    opener = en
      ? `${name}, you've uploaded ${uploaded} approved apps — nice! ${COMMENT_UNLOCK_THRESHOLD - uploaded} more and you unlock reviews. Actually, there are open community requests you can fulfill to earn more — want to see them?`
      : `${name}, העלית ${uploaded} אפליקציות שאושרו — יפה! עוד ${COMMENT_UNLOCK_THRESHOLD - uploaded} ואתה פותח תגובות. תכל'ס, יש בקשות קהילה פתוחות שאתה יכול למלא ולצבור — רוצה לראות?`;
    followUps = en
      ? ["Show me community requests", "What should I upload?", "Help me write an app description"]
      : ["הראה לי בקשות קהילה", "מה כדאי לי להעלות?", "עזור לי לנסח תיאור לאפליקציה"];
  } else if ((downloads ?? 0) > 0) {
    opener = en
      ? `Hi ${name}! Want me to find you new apps in the categories you like, or check whether something you downloaded got an update?`
      : `היי ${name}! רוצה שאמצא לך אפליקציות חדשות בקטגוריות שאתה אוהב, או שאבדוק אם משהו שהורדת קיבל עדכון?`;
    followUps = en
      ? ["Recommend some apps for me", "What got updated?", "Find me an offline app"]
      : ["המלץ לי על אפליקציות", "מה קיבל עדכון?", "מצא לי אפליקציה אופליין"];
  } else {
    opener = en
      ? `Hey ${name}, I can find you an app based on what you need, explain how to earn reputation, or show you what's new. What would you like?`
      : `וואלה ${name}, אני יכול למצוא לך אפליקציה לפי מה שאתה צריך, להסביר איך צוברים מוניטין, או להראות מה חדש. מה בא לך?`;
    followUps = en
      ? ["Find me an app", "How do I earn reputation?", "What's most downloaded on the site?"]
      : ["מצא לי אפליקציה", "איך צוברים מוניטין?", "מה הכי מורד באתר?"];
  }

  // מעדכנים את חותמת הזמן (best-effort) כדי ש"מה חדש מאז" יעבוד בפעם הבאה.
  try {
    await admin.from("profiles").update({ bot_opener_at: new Date().toISOString() }).eq("id", user.id);
  } catch {
    // ignore
  }

  return NextResponse.json({ opener, followUps, showAuto: true });
}
