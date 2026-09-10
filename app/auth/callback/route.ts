import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { grantReferralIfPending, extractClientIp } from "@/lib/referral";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const isRecovery = searchParams.get("flow") === "recovery";

  if (code) {
    const supabase = createServerSupabase();
    await supabase.auth.exchangeCodeForSession(code);

    // איפוס סיסמה: הקוד יצר סשן זמני. מפנים לעמוד קביעת סיסמה חדשה (לא נותנים תגמול הפניה).
    if (isRecovery) {
      return NextResponse.redirect(`${origin}/reset-password`);
    }

    // המייל אומת בדיוק עכשיו - זה הרגע לתת תגמול הפניה (אם המשתמש נרשם דרך קישור של חבר).
    // אידמפוטנטי; נכשל בשקט כדי לא לחסום את זרימת ההתחברות.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await grantReferralIfPending(user.id, extractClientIp(request.headers));
    } catch {
      // ignore
    }
  }

  if (isRecovery) return NextResponse.redirect(`${origin}/reset-password`);
  return NextResponse.redirect(`${origin}/login?confirmed=1`);
}
