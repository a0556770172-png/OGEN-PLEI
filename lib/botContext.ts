import { createAdminSupabase } from "./supabase/admin";
import { LIMITS, REFERRAL } from "./constants";
import { LIKE_UNLOCK_THRESHOLD, COMMENT_UNLOCK_THRESHOLD } from "./engagement-eligibility";
import { DM_UNLOCK_THRESHOLD } from "./dm-eligibility";
import type { Profile } from "@/types/database";

const PRO_THRESHOLD = 300;

export interface BotUserContext {
  isStaff: boolean;
  isDeveloper: boolean;
  text: string;
}

// בונה בלוק "מי המשתמש ומה חסר לו" שמוזרק להנחיית המערכת בכל בקשה - זה מה שמאפשר
// לסוכן לתת דחיפות מותאמות אישית ("עוד אפליקציה אחת ואתה ב-PRO").
export async function buildBotUserContext(profile: Profile): Promise<BotUserContext> {
  const admin = createAdminSupabase();
  const isStaff = profile.role === "admin" || !!profile.is_moderator;
  const isDeveloper = profile.role === "developer" || profile.role === "admin";

  const [{ count: activeApps }, { count: approvedApps }, { data: recentDownloads }, { count: referredCount }] =
    await Promise.all([
      admin.from("apps").select("id", { count: "exact", head: true }).eq("developer_id", profile.id).neq("status", "archived"),
      admin.from("apps").select("id", { count: "exact", head: true }).eq("developer_id", profile.id).eq("status", "approved"),
      admin
        .from("download_events")
        .select("app_id, apps(name, category)")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(6),
      admin.from("referral_events").select("id", { count: "exact", head: true }).eq("referrer_id", profile.id).eq("status", "rewarded")
    ]);

  const points = profile.points ?? 0;
  const uploaded = approvedApps ?? 0;
  const plan = profile.is_pro ? LIMITS.pro : LIMITS.free;

  const lines: string[] = [
    `שם משתמש: ${profile.username}`,
    `תפקיד: ${isStaff ? "צוות (מנהל/פיקוח)" : isDeveloper ? (profile.is_pro ? "מפתח PRO" : "מפתח רגיל") : "משתמש רגיל"}`,
    `מוניטין: ${points}`,
    `אפליקציות פעילות שהעלה: ${activeApps ?? 0} (מתוך ${plan.maxApps} מותרות)`
  ];

  // --- מנוע "מה חסר לו" ---
  const missing: string[] = [];
  if (!profile.is_pro && !isStaff) {
    const gap = PRO_THRESHOLD - points;
    if (gap > 0) missing.push(`חסרים ${gap} מוניטין לשדרוג אוטומטי ל-PRO (300). זה בערך ${Math.max(1, Math.ceil(gap / 5))} אפליקציות/הצעות שיאושרו, או ${Math.ceil(gap / REFERRAL.referrerPoints)} הפניות מוצלחות.`);
    else missing.push(`צבר ${points} מוניטין - כבר עבר את סף ה-PRO (300).`);
  }
  if (!isStaff && !profile.is_pro && !profile.can_comment_override && uploaded < COMMENT_UNLOCK_THRESHOLD) {
    missing.push(`עוד ${COMMENT_UNLOCK_THRESHOLD - uploaded} אפליקציות שיאושרו לפתיחת כתיבת תגובות.`);
  }
  if (!isStaff && !profile.is_pro && !profile.can_like_override && uploaded < LIKE_UNLOCK_THRESHOLD) {
    missing.push(`עוד ${LIKE_UNLOCK_THRESHOLD - uploaded} אפליקציות שיאושרו לפתיחת לייקים.`);
  }
  if (!isStaff && !profile.is_pro && uploaded < DM_UNLOCK_THRESHOLD) {
    missing.push(`עוד ${DM_UNLOCK_THRESHOLD - uploaded} אפליקציות/הצעות שיאושרו לפתיחת צ'אט בין משתמשים.`);
  }
  if (!isDeveloper) {
    missing.push(`המשתמש עדיין לא מפתח - אם הוא רוצה להעלות תוכן משלו, כדאי שישדרג לחשבון מפתח (/profile/become-developer).`);
  }
  missing.push(`הזמין עד כה ${referredCount ?? 0} חברים מוצלחים דרך קישור ההפניה (כל חבר = ${REFERRAL.referrerPoints} מוניטין).`);

  if (missing.length) lines.push(`\nמה כדאי לדחוף אותו לעשות (שלב בעדינות בתשובות רלוונטיות):\n- ${missing.join("\n- ")}`);

  // --- העדפות (מה הוא מוריד) ---
  const cats = new Map<string, number>();
  for (const d of (recentDownloads ?? []) as any[]) {
    const c = d.apps?.category;
    if (c) cats.set(c, (cats.get(c) ?? 0) + 1);
  }
  if (cats.size) {
    const top = [...cats.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
    lines.push(`קטגוריות שהמשתמש הוריד מהן לאחרונה: ${top.join(", ")}.`);
  }

  if (isDeveloper) {
    const { data: pending } = await admin
      .from("apps")
      .select("name, status, review_note")
      .eq("developer_id", profile.id)
      .in("status", ["pending", "rejected"])
      .limit(5);
    if (pending && pending.length) {
      lines.push(
        `אפליקציות של המשתמש שדורשות תשומת לב: ${pending
          .map((p) => `"${p.name}" (${p.status === "rejected" ? "נדחתה" + (p.review_note ? ": " + p.review_note : "") : "ממתינה לבדיקה"})`)
          .join("; ")}.`
      );
    }
  }

  return { isStaff, isDeveloper, text: lines.join("\n") };
}
