import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { extractClientIp } from "@/lib/referral";
import { verifyAnswer } from "@/lib/securityAnswer";
import { notifyAdminsInApp } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FAILS_PER_HOUR = 5;

// שלב 2: המשתמש עונה על שאלת האבטחה + סיסמה חדשה. תשובה נכונה => הסיסמה מוחלפת.
export async function POST(request: Request) {
  const { email, answer, password } = await request.json().catch(() => ({}));
  const clean = typeof email === "string" ? email.trim().toLowerCase() : "";
  const ans = typeof answer === "string" ? answer.trim() : "";
  const pw = typeof password === "string" ? password : "";

  if (!EMAIL_RE.test(clean)) return NextResponse.json({ error: "כתובת מייל לא תקינה" }, { status: 400 });
  if (ans.length < 1) return NextResponse.json({ error: "יש להזין תשובה" }, { status: 400 });
  if (pw.length < 6 || pw.length > 72) {
    return NextResponse.json({ error: "הסיסמה החדשה חייבת להיות באורך 6 תווים לפחות" }, { status: 400 });
  }

  const ip = extractClientIp(request.headers);
  const admin = createAdminSupabase();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  let fails = 0;
  try {
    const { count } = await admin
      .from("password_reset_requests")
      .select("id", { count: "exact", head: true })
      .eq("kind", "question_attempt")
      .eq("email", clean)
      .gte("created_at", hourAgo);
    fails = count ?? 0;
  } catch {
    // ignore
  }
  if (fails >= MAX_FAILS_PER_HOUR) {
    return NextResponse.json(
      { error: "יותר מדי ניסיונות שגויים. נסה שוב בעוד שעה, או פנה לצוות.", locked: true },
      { status: 429 }
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, username, security_answer_hash")
    .ilike("email", clean)
    .maybeSingle();

  const ok = !!profile && verifyAnswer(ans, profile.security_answer_hash);

  if (!ok) {
    try {
      await admin.from("password_reset_requests").insert({ kind: "question_attempt", email: clean, ip });
    } catch {
      // ignore
    }
    const remaining = Math.max(0, MAX_FAILS_PER_HOUR - (fails + 1));
    if (remaining === 0) {
      notifyAdminsInApp({
        kind: "password_reset",
        title: "ניסיונות איפוס סיסמה שגויים",
        body: `${clean} - ${MAX_FAILS_PER_HOUR} תשובות שגויות לשאלת האבטחה. החשבון נעול לשעה.`,
        url: "/dashboard/admin?tab=passwordResets"
      }).catch(() => {});
    }
    return NextResponse.json(
      { error: remaining > 0 ? `תשובה שגויה. נותרו ${remaining} ניסיונות.` : "תשובה שגויה. החשבון נעול לשעה." },
      { status: 401 }
    );
  }

  const { error } = await admin.auth.admin.updateUserById(profile!.id, { password: pw });
  if (error) return NextResponse.json({ error: `שגיאה בעדכון הסיסמה: ${error.message}` }, { status: 500 });

  // ניקוי ניסיונות שגויים אחרי הצלחה
  try {
    await admin.from("password_reset_requests").delete().eq("kind", "question_attempt").eq("email", clean);
  } catch {
    // ignore
  }
  logAudit({
    actorId: profile!.id,
    action: "reset_password_by_question",
    targetType: "user",
    targetId: profile!.id,
    targetLabel: profile!.username
  }).catch(() => {});

  return NextResponse.json({ ok: true, message: "הסיסמה עודכנה! אפשר להתחבר עם הסיסמה החדשה." });
}
