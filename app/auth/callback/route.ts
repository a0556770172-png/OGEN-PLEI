import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { grantReferralIfPending, extractClientIp } from "@/lib/referral";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const isRecovery = searchParams.get("flow") === "recovery";
  const isOAuth = searchParams.get("flow") === "oauth";

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

    // התחברות/הרשמה עם Google (בניגוד לאימות מייל רגיל) - יש כבר סשן פעיל בדיוק עכשיו,
    // אז מנווטים ישר פנימה לפי תפקיד במקום להראות שוב את מסך ההתחברות (אין למשתמש כזה
    // סיסמה בכלל). אותו מיפוי כמו ב-app/login/page.tsx.
    if (isOAuth) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, is_moderator")
            .eq("id", user.id)
            .single();
          const dest =
            profile?.role === "admin" ? "/dashboard/admin"
            : profile?.is_moderator ? "/dashboard/moderator"
            : profile?.role === "developer" ? "/profile"
            : "/";
          return NextResponse.redirect(`${origin}${dest}`);
        }
      } catch {
        // אם משהו נכשל, נופלים בבטחה לדף הבית למטה
      }
      return NextResponse.redirect(`${origin}/`);
    }
  }

  if (isRecovery) return NextResponse.redirect(`${origin}/reset-password`);
  return NextResponse.redirect(`${origin}/login?confirmed=1`);
}
