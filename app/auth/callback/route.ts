import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { grantReferralIfPending, extractClientIp, linkReferralFromCookie } from "@/lib/referral";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // חשוב: לא משתמשים ב-origin של new URL(request.url) - מאחורי nginx זה לפעמים
  // מחזיר http://localhost:3000 (כתובת ה-Next.js הפנימית) במקום הדומיין האמיתי,
  // גם כשה-Host header שנשלח מ-nginx תקין. בונים origin ידנית מה-headers במקום.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;
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
    let user: any = null;
    try {
      ({ data: { user } } = await supabase.auth.getUser());
      // הרשמה חדשה עם Google: בהרשמה רגילה קוד ההפניה נשלח עם פרטי ההרשמה והטריגר
      // handle_new_user מקשר את referred_by. דרך Google אי אפשר לשלוח אותו, ולכן משתמש
      // שהגיע מקישור של חבר נרשם בלי קישור - והמפנה לא קיבל כלום. כאן קוראים את הקוד
      // מהעוגייה ogen_ref (ראו lib/referralClient.ts) ומקשרים לפני מתן התגמול.
      if (user && isOAuth && Date.now() - new Date(user.created_at).getTime() < 10 * 60 * 1000) {
        await linkReferralFromCookie(user.id, request.headers.get("cookie"));
      }
      if (user) await grantReferralIfPending(user.id, extractClientIp(request.headers));
    } catch {
      // ignore
    }

    // התחברות/הרשמה עם Google (בניגוד לאימות מייל רגיל) - יש כבר סשן פעיל בדיוק עכשיו,
    // אז מנווטים ישר פנימה במקום להראות שוב את מסך ההתחברות (אין למשתמש כזה סיסמה בכלל).
    // תמיד לדף הבית, בדיוק כמו בהתחברות רגילה - ראו app/login/page.tsx.
    // חריג: משתמש שנרשם עכשיו לראשונה עם Google מקבל קודם מסך לבחירת שם משתמש
    // (אחרת נשאר לו השם שנוצר אוטומטית מהמייל) - ראו app/welcome/username/page.tsx.
    if (isOAuth) {
      const justCreated = user && Date.now() - new Date(user.created_at).getTime() < 10 * 60 * 1000;
      if (justCreated && !user.user_metadata?.username_chosen) {
        return NextResponse.redirect(`${origin}/welcome/username`);
      }
      return NextResponse.redirect(`${origin}/`);
    }
  }

  if (isRecovery) return NextResponse.redirect(`${origin}/reset-password`);
  return NextResponse.redirect(`${origin}/login?confirmed=1`);
}
