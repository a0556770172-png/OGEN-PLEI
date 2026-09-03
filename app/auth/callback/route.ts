import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { grantReferralIfPending, extractClientIp } from "@/lib/referral";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createServerSupabase();
    await supabase.auth.exchangeCodeForSession(code);

    // המייל אומת בדיוק עכשיו - זה הרגע לתת תגמול הפניה (אם המשתמש נרשם דרך קישור של חבר).
    // אידמפוטנטי; נכשל בשקט כדי לא לחסום את זרימת ההתחברות.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await grantReferralIfPending(user.id, extractClientIp(request.headers));
    } catch {
      // ignore
    }
  }

  return NextResponse.redirect(`${origin}/login?confirmed=1`);
}
