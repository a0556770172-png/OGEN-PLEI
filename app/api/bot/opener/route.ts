import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getBotConfig, botIsLive } from "@/lib/bot";
import { REFERRAL } from "@/lib/constants";

// הודעת פתיחה יזומה קצרה (ללא קריאה ל-Gemini - היוריסטיקה זולה) שהחלונית מציגה
// כשנפתחת שיחה חדשה. מטרה: לדחוף לפעולה. מכובה דרך bot_config.proactive_enabled.
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

  const [{ count: referred }, { count: downloads }] = await Promise.all([
    admin.from("referral_events").select("id", { count: "exact", head: true }).eq("referrer_id", user.id).eq("status", "rewarded"),
    admin.from("download_events").select("id", { count: "exact", head: true }).eq("user_id", user.id)
  ]);

  let opener: string;
  let followUps: string[];

  if (!staff && !profile.is_pro && points >= 240) {
    opener = `היי ${profile.username} 👋 יש לך ${points} מוניטין — עוד קצת ואתה מקבל PRO אוטומטית (ב-300). רוצה שאראה לך איך הכי מהר להשלים?`;
    followUps = ["איך משלימים ל-PRO?", "מה נותן PRO?", "כמה חסר לי בדיוק?"];
  } else if (!isDeveloper) {
    opener = `היי ${profile.username} 👋 רוצה לפרסם אפליקציות או תוכנות משלך? אפשר לשדרג לחשבון מפתח בכמה שניות — ואז כל אפליקציה שמאושרת שווה מוניטין.`;
    followUps = ["איך נרשמים כמפתח?", "מה ההבדל בין מפתח למשתמש רגיל?", "מצא לי אפליקציה"];
  } else if ((referred ?? 0) === 0) {
    opener = `היי ${profile.username} 👋 ידעת שיש לך קישור הזמנה אישי? כל חבר שנרשם דרכו שווה לך ${REFERRAL.referrerPoints} מוניטין + קרדיט העלאה, והוא מקבל ${REFERRAL.joinerPoints}.`;
    followUps = ["מה קישור ההפניה שלי?", "איך זה עובד?", "כמה מוניטין צברתי?"];
  } else if ((downloads ?? 0) > 0) {
    opener = `היי ${profile.username} 👋 רוצה שאמצא לך אפליקציות חדשות בקטגוריות שאתה אוהב, או שאבדוק אם משהו שהורדת קיבל עדכון?`;
    followUps = ["המלץ לי על אפליקציות", "מה קיבל עדכון?", "מצא לי אפליקציה אופליין"];
  } else {
    opener = `היי ${profile.username} 👋 אני יכול לעזור למצוא אפליקציה לפי דרישות, להסביר על מוניטין ו-PRO, או להראות מה חדש במאגר. מה בא לך?`;
    followUps = ["מצא לי אפליקציה", "איך צוברים מוניטין?", "מה הכי מורד באתר?"];
  }

  return NextResponse.json({ opener, followUps });
}
