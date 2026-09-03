import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { grantReferralIfPending, extractClientIp } from "@/lib/referral";

// מעדכן "ביקור אחרון" של המשתמש המחובר - נקרא מה-Navbar בכל טעינת עמוד/ניווט.
// לא קריטי אם זה נכשל בשקט (לא חוסם שום דבר במסך).
export async function POST(request: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false });

  const admin = createAdminSupabase();
  const ip = extractClientIp(request.headers);
  await admin
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString(), ...(ip ? { last_ip: ip } : {}) })
    .eq("id", user.id);

  // גיבוי למתן תגמול הפניה - למקרה שאימות מייל כבוי באתר והמשתמש לא עבר דרך /auth/callback.
  // אידמפוטנטי; שאילתה זולה אחת ויציאה מיידית כשאין הפניה ממתינה. מחכים לו (ולא "שוכחים"
  // אותו ברקע) כי ב-serverless עבודה לא-מסונכרנת אחרי שליחת התשובה עלולה להיקטע.
  try {
    await grantReferralIfPending(user.id, ip);
  } catch {
    // לא חוסם את התשובה של ה-heartbeat
  }

  return NextResponse.json({ ok: true });
}
