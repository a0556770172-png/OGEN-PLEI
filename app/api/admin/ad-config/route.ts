import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getAdConfig } from "@/lib/adConfig";

// ראו הסבר ב-app/api/ads/config/route.ts - בלי זה Next.js עלול לשמור תשובה ישנה במטמון.
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.profile.role !== "admin") return NextResponse.json({ error: "רק מנהל בפועל" }, { status: 403 });

  const cfg = await getAdConfig();
  return NextResponse.json(cfg);
}

export async function PATCH(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.profile.role !== "admin") return NextResponse.json({ error: "רק מנהל בפועל" }, { status: 403 });

  const { interstitialEnabled, floatingEnabled, linkUrl, skipAfterSeconds, staffDailyLimit, imageKey } = await request
    .json()
    .catch(() => ({}));

  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (typeof interstitialEnabled === "boolean") patch.interstitial_enabled = interstitialEnabled;
  if (typeof floatingEnabled === "boolean") patch.floating_enabled = floatingEnabled;
  if (typeof linkUrl === "string" && linkUrl.trim()) patch.link_url = linkUrl.trim().slice(0, 2000);
  if (Number.isFinite(skipAfterSeconds)) patch.skip_after_seconds = Math.max(0, Math.min(60, Math.round(skipAfterSeconds)));
  if (Number.isFinite(staffDailyLimit)) patch.staff_daily_limit = Math.max(0, Math.min(50, Math.round(staffDailyLimit)));
  if (typeof imageKey === "string" && imageKey.trim()) patch.image_key = imageKey.trim();

  const admin = createAdminSupabase();
  const { error } = await admin.from("site_ad_config").update(patch).eq("id", true);
  if (error) return NextResponse.json({ error: `שגיאה בשמירה: ${error.message}` }, { status: 500 });

  const cfg = await getAdConfig();
  return NextResponse.json(cfg);
}
