import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { extractClientIp } from "@/lib/referral";
import { notifyAdminsInApp } from "@/lib/notifications";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// בקשת הסלמה לצוות - כשקישור המייל לא מגיע / המשתמש לא זוכר את המייל. הבוט אוסף פרטי
// זהות, אך *לא שופט* - מנהל אנושי בודק מול ה-DB ומאפס ידנית.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  const username = typeof body.username === "string" ? body.username.trim().slice(0, 80) : "";
  const details = typeof body.details === "string" ? body.details.trim().slice(0, 2000) : "";

  if (!email && !username) {
    return NextResponse.json({ error: "צריך לפחות כתובת מייל או שם משתמש" }, { status: 400 });
  }
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "כתובת מייל לא תקינה" }, { status: 400 });
  }

  const ip = extractClientIp(request.headers);
  const admin = createAdminSupabase();

  // הגבלה: עד 3 בקשות הסלמה לשעה מאותו IP
  try {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    if (ip) {
      const { count } = await admin
        .from("password_reset_requests")
        .select("id", { count: "exact", head: true })
        .eq("kind", "escalation")
        .eq("ip", ip)
        .gte("created_at", hourAgo);
      if ((count ?? 0) >= 3) {
        return NextResponse.json({ error: "כבר נשלחו כמה בקשות. המתן ונסה שוב מאוחר יותר." }, { status: 429 });
      }
    }
  } catch {
    // ignore
  }

  const { error } = await admin.from("password_reset_requests").insert({
    kind: "escalation",
    email: email || "(לא סופק)",
    claimed_username: username || null,
    details: details || null,
    ip
  });
  if (error) return NextResponse.json({ error: "שגיאה בשליחת הבקשה" }, { status: 500 });

  notifyAdminsInApp({
    kind: "password_reset",
    title: "בקשת איפוס סיסמה ידנית",
    body: `${username || email || "משתמש"} מבקש עזרה באיפוס סיסמה`,
    url: "/dashboard/admin?tab=passwordResets"
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    message: "הבקשה נשלחה לצוות. נבדוק את הפרטים ונחזור אליך בהקדם (דרך המייל שציינת או פרופיל מתמחים טופ)."
  });
}
