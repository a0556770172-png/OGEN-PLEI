import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { extractClientIp } from "@/lib/referral";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FAILS_PER_HOUR = 5;

// שלב 1 באיפוס בשאלת אבטחה: המשתמש נותן מייל, ומקבל את שאלת האבטחה שלו (אם קיימת).
export async function POST(request: Request) {
  const { email } = await request.json().catch(() => ({}));
  const clean = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(clean)) return NextResponse.json({ error: "כתובת מייל לא תקינה" }, { status: 400 });

  const ip = extractClientIp(request.headers);
  const admin = createAdminSupabase();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // הגבלת סריקה: עד 20 בקשות שאלה לשעה מאותו IP
  try {
    if (ip) {
      const { count } = await admin
        .from("password_reset_requests")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip)
        .gte("created_at", hourAgo);
      if ((count ?? 0) >= 20) {
        return NextResponse.json({ error: "יותר מדי בקשות. נסה שוב מאוחר יותר." }, { status: 429 });
      }
    }
  } catch {
    // מיגרציה 0051/0052 עוד לא רצה
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, security_question, security_answer_hash")
    .ilike("email", clean)
    .maybeSingle();

  if (!profile || !profile.security_question || !profile.security_answer_hash) {
    return NextResponse.json({ hasQuestion: false });
  }

  // נעילה זמנית אחרי יותר מדי תשובות שגויות
  try {
    const { count } = await admin
      .from("password_reset_requests")
      .select("id", { count: "exact", head: true })
      .eq("kind", "question_attempt")
      .eq("email", clean)
      .gte("created_at", hourAgo);
    if ((count ?? 0) >= MAX_FAILS_PER_HOUR) {
      return NextResponse.json({ locked: true, error: "יותר מדי ניסיונות שגויים. נסה שוב בעוד שעה, או פנה לצוות." });
    }
  } catch {
    // ignore
  }

  return NextResponse.json({ hasQuestion: true, question: profile.security_question });
}
