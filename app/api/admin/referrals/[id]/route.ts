import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { addPoints } from "@/lib/points";
import { logAudit } from "@/lib/audit";
import { REFERRAL } from "@/lib/constants";

// ניהול אירוע הפניה בודד - מנהל בפועל בלבד.
//   action "release" - שחרור ידני של הפניה שנחסמה (capped / blocked_ip): נותן את התגמול המלא.
//   action "revoke"  - ביטול ידני של תגמול שכבר ניתן (rewarded): מחזיר את המוניטין והקרדיט.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;

  if (profile.role !== "admin") {
    return NextResponse.json({ error: "רק מנהל בפועל יכול לנהל הפניות" }, { status: 403 });
  }

  const { action } = await request.json().catch(() => ({}));
  const admin = createAdminSupabase();

  const { data: event } = await admin.from("referral_events").select("*").eq("id", params.id).single();
  if (!event) return NextResponse.json({ error: "אירוע ההפניה לא נמצא" }, { status: 404 });

  const now = new Date().toISOString();

  if (action === "release") {
    if (event.status === "rewarded") {
      return NextResponse.json({ error: "ההפניה הזו כבר תוגמלה" }, { status: 400 });
    }

    // בונוס למצטרף - רק אם עוד לא קיבל אותו.
    const { data: joiner } = await admin
      .from("profiles")
      .select("referral_join_bonus_at")
      .eq("id", event.referred_user_id)
      .single();
    const giveJoinerBonus = !joiner?.referral_join_bonus_at;

    if (giveJoinerBonus) {
      await admin.from("points_log").insert({ profile_id: event.referred_user_id, delta: REFERRAL.joinerPoints, reason: "referral_join" });
      await addPoints(event.referred_user_id, REFERRAL.joinerPoints);
      await admin.from("profiles").update({ referral_join_bonus_at: now }).eq("id", event.referred_user_id);
    }

    await admin.from("points_log").insert({ profile_id: event.referrer_id, delta: REFERRAL.referrerPoints, reason: "referral" });
    await addPoints(event.referrer_id, REFERRAL.referrerPoints);

    const { data: referrer } = await admin
      .from("profiles")
      .select("referral_size_override_credits")
      .eq("id", event.referrer_id)
      .single();
    await admin
      .from("profiles")
      .update({ referral_size_override_credits: (referrer?.referral_size_override_credits ?? 0) + 1 })
      .eq("id", event.referrer_id);

    await admin
      .from("referral_events")
      .update({
        status: "rewarded",
        referrer_points_awarded: REFERRAL.referrerPoints,
        joiner_points_awarded: giveJoinerBonus ? REFERRAL.joinerPoints : event.joiner_points_awarded,
        size_credit_awarded: true,
        resolved_by: profile.id,
        resolved_at: now
      })
      .eq("id", params.id);

    await logAudit({
      actorId: profile.id,
      action: "release_referral",
      targetType: "referral_event",
      targetId: params.id,
      meta: { referrerId: event.referrer_id, referredUserId: event.referred_user_id, from: event.status },
      undoable: false
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "revoke") {
    if (event.status !== "rewarded") {
      return NextResponse.json({ error: "אפשר לבטל רק הפניה שתוגמלה" }, { status: 400 });
    }

    if (event.referrer_points_awarded > 0) {
      await admin.from("points_log").insert({ profile_id: event.referrer_id, delta: -event.referrer_points_awarded, reason: "referral_revoked" });
      await addPoints(event.referrer_id, -event.referrer_points_awarded);
    }
    if (event.joiner_points_awarded > 0) {
      await admin.from("points_log").insert({ profile_id: event.referred_user_id, delta: -event.joiner_points_awarded, reason: "referral_revoked" });
      await addPoints(event.referred_user_id, -event.joiner_points_awarded);
    }
    if (event.size_credit_awarded) {
      const { data: referrer } = await admin
        .from("profiles")
        .select("referral_size_override_credits")
        .eq("id", event.referrer_id)
        .single();
      const cur = referrer?.referral_size_override_credits ?? 0;
      if (cur > 0) {
        await admin.from("profiles").update({ referral_size_override_credits: cur - 1 }).eq("id", event.referrer_id);
      }
    }

    await admin
      .from("referral_events")
      .update({ status: "revoked", resolved_by: profile.id, resolved_at: now })
      .eq("id", params.id);

    await logAudit({
      actorId: profile.id,
      action: "revoke_referral",
      targetType: "referral_event",
      targetId: params.id,
      meta: { referrerId: event.referrer_id, referredUserId: event.referred_user_id },
      undoable: false
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "פעולה לא חוקית" }, { status: 400 });
}
