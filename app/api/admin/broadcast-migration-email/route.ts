import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// קמפיין חד-פעמי: הודעה לכל המשתמשים הרשומים על המעבר מ-Vercel לדומיין העצמאי
// ogenplay.com. הכפתור בניהול ניתן ללחיצה חוזרת בבטחה - כל שליחה מדלגת (דרך
// broadcast_email_log) על מי שכבר קיבל בהצלחה, כך שאם ספק המייל (Resend) עוצר
// באמצע (מגבלת קצב/מכסה יומית בתוכנית החינמית) אפשר פשוט ללחוץ שוב מאוחר יותר.
const CAMPAIGN = "site-migration-2026";
const FROM = "עוגן פליי <news@mail.ogenplay.com>";
const SUBJECT = "עוגן פליי עבר לבית חדש 🚀";
const RESEND_BATCH_SIZE = 100;

function emailHtml(username: string) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="margin:0;padding:0;background:#0f1115;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1115;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#171a21;border-radius:16px;overflow:hidden;border:1px solid #2a2e38;">
        <tr><td style="height:6px;background:linear-gradient(90deg,#d4af37,#4f7cff,#d4af37);"></td></tr>
        <tr><td style="padding:32px 28px;color:#e6e8ec;text-align:right;line-height:1.7;">
          <p style="font-size:18px;margin:0 0 16px;">היי ${username}! 👋</p>
          <p style="font-size:16px;margin:0 0 16px;">יש לנו חדשות משמחות — <strong>עוגן פליי התחדש ועבר לבית חדש, עצמאי ומשודרג! 🚀</strong></p>
          <p style="font-size:16px;margin:0 0 8px;">מהיום תוכלו למצוא אותנו בכתובת החדשה:</p>
          <p style="margin:0 0 20px;"><a href="https://ogenplay.com" style="font-size:20px;font-weight:bold;color:#4f9dff;text-decoration:none;">🌐 ogenplay.com</a></p>
          <p style="font-size:16px;margin:0 0 16px;">ומה הכי טוב? <strong>מבחינתכם כמעט שום דבר לא השתנה.</strong><br/>החשבון שלכם נשאר בדיוק כפי שהוא — אותו משתמש, אותה סיסמה, אותן אפליקציות וכל מה שאתם מכירים.</p>
          <p style="font-size:16px;margin:0 0 24px;">פשוט נכנסים מהיום דרך <strong>ogenplay.com</strong> וממשיכים כרגיל. 😉</p>
          <table role="presentation" width="100%" style="background:#221c10;border-right:4px solid #d4af37;border-radius:8px;margin:0 0 24px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 8px;font-weight:bold;color:#d4af37;">⚠️ חשוב לדעת</p>
              <p style="margin:0 0 10px;font-size:14px;">אם בעבר שיתפתם <strong>קישור ישיר להורדת אחת האפליקציות</strong> — הקישור הישן כבר לא יעבוד.</p>
              <p style="margin:0;font-size:14px;">כדי שהקישור החדש יעבוד, היכנסו לאתר החדש, מצאו את האפליקציה שלכם ושתפו <strong>מחדש את קישור ההורדה המעודכן</strong>.</p>
            </td></tr>
          </table>
          <p style="font-size:14px;margin:0 0 24px;color:#a8adba;">שומרים את הכתובת החדשה:<br/><a href="https://ogenplay.com" style="color:#4f9dff;">👉 ogenplay.com</a></p>
          <p style="font-size:16px;margin:0;">מחכים לכם בבית החדש! 🏠🚀</p>
          <p style="font-size:14px;margin:24px 0 0;color:#a8adba;">צוות עוגן פליי</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function requireAdmin() {
  const result = await requireProfile();
  if ("error" in result) return { error: NextResponse.json({ error: result.error }, { status: result.status }) };
  if (result.profile.role !== "admin") {
    return { error: NextResponse.json({ error: "רק מנהל יכול לבצע פעולה זו" }, { status: 403 }) };
  }
  return { profile: result.profile };
}

async function getStatus(admin: ReturnType<typeof createAdminSupabase>) {
  const { count: total } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .not("email", "is", null);

  const { data: sentRows } = await admin
    .from("broadcast_email_log")
    .select("sent_at")
    .eq("campaign", CAMPAIGN)
    .order("sent_at", { ascending: false });

  const sent = sentRows?.length ?? 0;
  const lastSentAt = sentRows?.[0]?.sent_at ?? null;

  return { total: total ?? 0, sent, remaining: Math.max((total ?? 0) - sent, 0), lastSentAt };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const admin = createAdminSupabase();
  return NextResponse.json(await getStatus(admin));
}

export async function POST() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY לא מוגדר בשרת" }, { status: 500 });
  }

  const admin = createAdminSupabase();

  const { data: alreadySent } = await admin
    .from("broadcast_email_log")
    .select("user_id")
    .eq("campaign", CAMPAIGN);
  const alreadySentIds = new Set((alreadySent ?? []).map((r) => r.user_id as string));

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, email, username")
    .not("email", "is", null);

  if (profilesError) {
    return NextResponse.json({ error: "שגיאה בשליפת רשימת המשתמשים" }, { status: 500 });
  }

  const recipients = (profiles ?? []).filter((p) => p.email && !alreadySentIds.has(p.id));

  let sentCount = 0;
  let stoppedEarly = false;
  let stopReason: string | null = null;

  for (let i = 0; i < recipients.length; i += RESEND_BATCH_SIZE) {
    const chunk = recipients.slice(i, i + RESEND_BATCH_SIZE);
    const payload = chunk.map((p) => ({
      from: FROM,
      to: [p.email as string],
      subject: SUBJECT,
      html: emailHtml(p.username || "חבר/ה")
    }));

    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      stoppedEarly = true;
      stopReason = `${res.status}: ${body.slice(0, 300)}`;
      break;
    }

    await admin.from("broadcast_email_log").insert(
      chunk.map((p) => ({ campaign: CAMPAIGN, user_id: p.id }))
    );
    sentCount += chunk.length;

    // מרווח קצר בין באצ'ים כדי לא להיתקל במגבלת קצב של Resend
    if (i + RESEND_BATCH_SIZE < recipients.length) {
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  const status = await getStatus(admin);
  return NextResponse.json({ ok: true, sentNow: sentCount, stoppedEarly, stopReason, ...status });
}
