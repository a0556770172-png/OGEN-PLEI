import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { extractClientIp } from "@/lib/referral";
import { SITE_URL } from "@/lib/siteUrl";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PER_EMAIL_HOUR = 3;
const PER_IP_HOUR = 8;

// שליחת קישור איפוס סיסמה למייל. מגן מפני אנומרציה: תמיד מחזיר הצלחה, בין אם המייל
// קיים ובין אם לא. הגבלת קצב לפי מייל ו-IP.
export async function POST(request: Request) {
  const { email } = await request.json().catch(() => ({}));
  const clean = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(clean)) {
    return NextResponse.json({ error: "כתובת מייל לא תקינה" }, { status: 400 });
  }

  const ip = extractClientIp(request.headers);
  const admin = createAdminSupabase();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  try {
    const [{ count: byEmail }, { count: byIp }] = await Promise.all([
      admin
        .from("password_reset_requests")
        .select("id", { count: "exact", head: true })
        .eq("kind", "email_sent")
        .eq("email", clean)
        .gte("created_at", hourAgo),
      ip
        ? admin
            .from("password_reset_requests")
            .select("id", { count: "exact", head: true })
            .eq("kind", "email_sent")
            .eq("ip", ip)
            .gte("created_at", hourAgo)
        : Promise.resolve({ count: 0 } as any)
    ]);
    if ((byEmail ?? 0) >= PER_EMAIL_HOUR || (byIp ?? 0) >= PER_IP_HOUR) {
      return NextResponse.json(
        { error: "נשלחו כבר כמה קישורי איפוס. המתן כשעה ונסה שוב, או בדוק בתיבת המייל (גם בספאם)." },
        { status: 429 }
      );
    }
  } catch {
    // מיגרציה 0051 עוד לא רצה - ממשיכים בלי הגבלת קצב מקומית (Supabase מגביל בעצמו)
  }

  const supabase = createServerSupabase();
  await supabase.auth.resetPasswordForEmail(clean, {
    redirectTo: `${SITE_URL}/auth/callback?flow=recovery`
  });

  try {
    await admin.from("password_reset_requests").insert({ kind: "email_sent", email: clean, ip });
  } catch {
    // ignore
  }

  return NextResponse.json({
    ok: true,
    message: "אם קיים חשבון עם הכתובת הזו, נשלח אליו קישור לאיפוס הסיסמה. בדוק את תיבת המייל (וגם את תיקיית הספאם)."
  });
}
