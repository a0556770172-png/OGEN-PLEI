import { createAdminSupabase } from "./supabase/admin";
import { addPoints } from "./points";
import { sendPushToUser } from "./push";
import { REFERRAL } from "./constants";
import type { ReferralStatus, ReferralStats } from "@/types/database";

// שולף את כתובת ה-IP של הלקוח מכותרות הבקשה (Vercel מציב x-forwarded-for).
export function extractClientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim() || null;
  return headers.get("x-real-ip");
}

// ============================================================
// מתן התגמול על הפניה - נקרא אחרי אימות מייל (app/auth/callback) וגם כגיבוי
// מ-heartbeat (למקרה שאימות מייל כבוי באתר). אידמפוטנטי לחלוטין: אם אין הפניה
// ממתינה, או שכבר עובדה, הפונקציה חוזרת מיד בלי לעשות כלום.
// ============================================================
export async function grantReferralIfPending(userId: string, signupIp: string | null): Promise<void> {
  const admin = createAdminSupabase();

  const { data: me } = await admin
    .from("profiles")
    .select("id, referred_by, referral_rewarded_at, referral_join_bonus_at")
    .eq("id", userId)
    .single();

  // המקרה הנפוץ ביותר - אין מפנה, או כבר טופל: יציאה מיידית (שאילתה זולה אחת).
  if (!me || !me.referred_by || me.referral_rewarded_at) return;
  if (me.referred_by === userId) {
    await admin.from("profiles").update({ referral_rewarded_at: new Date().toISOString() }).eq("id", userId);
    return;
  }

  const { data: referrer } = await admin
    .from("profiles")
    .select("id, username, last_ip, banned, referral_size_override_credits")
    .eq("id", me.referred_by)
    .single();

  const now = new Date().toISOString();

  // המפנה נמחק/חסום - סוגרים את ההפניה בלי תגמול כדי לא לנסות שוב.
  if (!referrer || referrer.banned) {
    await admin.from("referral_events").insert({
      referrer_id: me.referred_by,
      referred_user_id: userId,
      signup_ip: signupIp,
      status: "blocked_ip",
      referrer_points_awarded: 0,
      joiner_points_awarded: 0,
      size_credit_awarded: false
    });
    await admin.from("profiles").update({ referral_rewarded_at: now }).eq("id", userId);
    return;
  }

  // --- הגנה 1: אותו IP של המפנה ---
  const sameIp = !!signupIp && !!referrer.last_ip && signupIp === referrer.last_ip;

  // --- הגנה 2: תקרה של 5 הפניות מתוגמלות ב-24 שעות מתגלגלות ---
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentRewarded } = await admin
    .from("referral_events")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referrer.id)
    .eq("status", "rewarded")
    .gte("created_at", since);
  const capped = (recentRewarded ?? 0) >= REFERRAL.dailyRewardCap;

  let status: ReferralStatus = "rewarded";
  if (sameIp) status = "blocked_ip";
  else if (capped) status = "capped";

  const referrerPts = status === "rewarded" ? REFERRAL.referrerPoints : 0;
  const joinerPts = status === "rewarded" ? REFERRAL.joinerPoints : 0;
  const sizeCredit = status === "rewarded";

  // ה-unique על referred_user_id מגן מפני עיבוד כפול במרוץ (למשל callback + heartbeat יחד).
  const { error: evErr } = await admin.from("referral_events").insert({
    referrer_id: referrer.id,
    referred_user_id: userId,
    signup_ip: signupIp,
    status,
    referrer_points_awarded: referrerPts,
    joiner_points_awarded: joinerPts,
    size_credit_awarded: sizeCredit
  });
  if (evErr) return; // כנראה הפרת unique - כבר עובד ע"י קריאה מקבילה

  const joinerPatch: Record<string, string> = { referral_rewarded_at: now };
  if (joinerPts > 0 && !me.referral_join_bonus_at) joinerPatch.referral_join_bonus_at = now;
  await admin.from("profiles").update(joinerPatch).eq("id", userId);

  if (joinerPts > 0) {
    await admin.from("points_log").insert({ profile_id: userId, delta: joinerPts, reason: "referral_join" });
    await addPoints(userId, joinerPts);
  }
  if (referrerPts > 0) {
    await admin.from("points_log").insert({ profile_id: referrer.id, delta: referrerPts, reason: "referral" });
    await addPoints(referrer.id, referrerPts);
  }
  if (sizeCredit) {
    await admin
      .from("profiles")
      .update({ referral_size_override_credits: (referrer.referral_size_override_credits ?? 0) + 1 })
      .eq("id", referrer.id);
  }

  if (status === "rewarded") {
    sendPushToUser(referrer.id, {
      title: "חבר שהזמנת הצטרף! 🎉",
      body: `קיבלת ${referrerPts} מוניטין + קרדיט להעלאת קובץ עד ${REFERRAL.sizeOverrideMb}MB`,
      url: "/profile"
    }).catch(() => {});
  }
}

// נתוני ההפניות של משתמש - לכרטיס "הזמן חברים" בעמוד הפרופיל.
export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const admin = createAdminSupabase();

  const { data: events } = await admin
    .from("referral_events")
    .select("status, referrer_points_awarded, created_at, referred:profiles!referral_events_referred_user_id_fkey(username)")
    .eq("referrer_id", userId)
    .order("created_at", { ascending: false });

  const { data: me } = await admin
    .from("profiles")
    .select("referral_size_override_credits")
    .eq("id", userId)
    .single();

  const list = (events ?? []) as any[];
  const rewarded = list.filter((e) => e.status === "rewarded");

  return {
    totalJoined: list.length,
    rewardedCount: rewarded.length,
    pointsEarned: rewarded.reduce((s, e) => s + (e.referrer_points_awarded || 0), 0),
    sizeCredits: me?.referral_size_override_credits ?? 0,
    recent: list.slice(0, 12).map((e) => ({
      username: e.referred?.username ?? null,
      status: e.status as ReferralStatus,
      points: e.referrer_points_awarded || 0,
      created_at: e.created_at
    }))
  };
}
