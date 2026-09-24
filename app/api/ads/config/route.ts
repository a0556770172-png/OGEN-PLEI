import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isStaff } from "@/lib/auth-helpers";
import { getAdConfig } from "@/lib/adConfig";

// תצורת הפרסומת הציבורית - נקרא ע"י כל משתמש (מחובר או לא) כדי להציג את פרסומת ההורדה
// והבאדג' הצף. מחזיר גם isStaff כדי שהלקוח ידע איזה חוק הגבלה (יומי לצוות / תמיד לרגילים) להפעיל.
export async function GET() {
  const cfg = await getAdConfig();

  let staff = false;
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const admin = createAdminSupabase();
    const { data: profile } = await admin.from("profiles").select("role, is_moderator").eq("id", user.id).maybeSingle();
    if (profile) staff = isStaff(profile);
  }

  return NextResponse.json({
    interstitialEnabled: cfg.interstitialEnabled,
    floatingEnabled: cfg.floatingEnabled,
    imageUrl: cfg.imageUrl,
    linkUrl: cfg.linkUrl,
    skipAfterSeconds: cfg.skipAfterSeconds,
    staffDailyLimit: cfg.staffDailyLimit,
    isStaff: staff
  });
}
