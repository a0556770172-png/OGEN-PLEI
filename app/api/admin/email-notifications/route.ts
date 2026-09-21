import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getEmailNotificationSettings } from "@/lib/emailNotifications";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const result = await requireProfile();
  if ("error" in result) return { error: NextResponse.json({ error: result.error }, { status: result.status }) };
  if (result.profile.role !== "admin") {
    return { error: NextResponse.json({ error: "רק מנהל יכול לגשת להגדרות אלו" }, { status: 403 }) };
  }
  return { profile: result.profile };
}

// מצב תור המייל: כמה נשלחו היום, כמה נותר במכסה, וכמה משתמשים/התראות ממתינים כרגע.
async function getStats() {
  const admin = createAdminSupabase();
  const settings = await getEmailNotificationSettings();

  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  const dayStartUtc = new Date(`${todayKey}T00:00:00+02:00`);

  const { count: sentToday } = await admin
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("email_status", "sent")
    .gte("email_sent_at", dayStartUtc.toISOString());

  const { data: pendingRows } = await admin
    .from("user_notifications")
    .select("user_id, user:profiles!user_notifications_user_id_fkey(email_notifications_enabled, email)")
    .eq("email_status", "pending")
    .limit(5000);

  const eligiblePending = (pendingRows ?? []).filter((r: any) => r.user?.email_notifications_enabled && r.user?.email);
  const pendingUsers = new Set(eligiblePending.map((r: any) => r.user_id)).size;

  return {
    ...settings,
    sentToday: sentToday ?? 0,
    remainingToday: Math.max(settings.email_notifications_daily_cap - (sentToday ?? 0), 0),
    pendingNotifications: eligiblePending.length,
    pendingUsers
  };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  return NextResponse.json(await getStats());
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (typeof body.enabled === "boolean") patch.email_notifications_enabled = body.enabled;
  if (Number.isInteger(body.dailyCap) && body.dailyCap >= 0) patch.email_notifications_daily_cap = body.dailyCap;
  if (Number.isInteger(body.windowStart) && body.windowStart >= 0 && body.windowStart <= 23) patch.email_notifications_window_start = body.windowStart;
  if (Number.isInteger(body.windowEnd) && body.windowEnd >= 1 && body.windowEnd <= 24) patch.email_notifications_window_end = body.windowEnd;

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: "אין שדות תקינים לעדכון" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { error } = await admin.from("site_settings").update(patch).eq("id", true);
  if (error) return NextResponse.json({ error: "שגיאה בעדכון ההגדרות" }, { status: 500 });

  return NextResponse.json(await getStats());
}
