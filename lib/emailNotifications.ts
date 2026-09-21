import { createAdminSupabase } from "./supabase/admin";

const FROM = "עוגן פליי <news@mail.ogenplay.com>";
const RESEND_BATCH_SIZE = 100;
// תקרת ביטחון להתראות בתוך דייג'סט בודד - כדי שמייל לא יתנפח בלי גבול אם משתמש
// הדליק את המתג אחרי המתנה ארוכה מאוד.
const MAX_ITEMS_PER_DIGEST = 20;

function israelHour(date: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", hour: "2-digit", hour12: false }).format(date));
}

function israelDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(date); // YYYY-MM-DD
}

type Settings = {
  email_notifications_enabled: boolean;
  email_notifications_daily_cap: number;
  email_notifications_window_start: number;
  email_notifications_window_end: number;
};

export async function getEmailNotificationSettings(): Promise<Settings> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("site_settings")
    .select("email_notifications_enabled, email_notifications_daily_cap, email_notifications_window_start, email_notifications_window_end")
    .eq("id", true)
    .single();
  return (
    data ?? {
      email_notifications_enabled: true,
      email_notifications_daily_cap: 180,
      email_notifications_window_start: 7,
      email_notifications_window_end: 23
    }
  );
}

function digestHtml(username: string, items: { title: string; body: string; url: string | null }[]) {
  const rows = items
    .map(
      (n) => `
        <tr><td style="padding:14px 18px;border-bottom:1px solid #2a2e38;">
          <p style="margin:0 0 4px;font-size:15px;font-weight:bold;color:#e6e8ec;">${n.title}</p>
          ${n.body ? `<p style="margin:0 0 8px;font-size:13px;color:#a8adba;">${n.body}</p>` : ""}
          ${n.url ? `<a href="https://ogenplay.com${n.url}" style="font-size:13px;color:#4f9dff;text-decoration:none;">לצפייה באתר ←</a>` : ""}
        </td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="margin:0;padding:0;background:#0f1115;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1115;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#171a21;border-radius:16px;overflow:hidden;border:1px solid #2a2e38;">
        <tr><td style="height:6px;background:linear-gradient(90deg,#d4af37,#4f7cff,#d4af37);"></td></tr>
        <tr><td style="padding:24px 24px 8px;color:#e6e8ec;text-align:right;">
          <p style="font-size:17px;margin:0;">היי ${username}, יש לך עדכונים חדשים 🔔</p>
        </td></tr>
        <tr><td>
          <table role="presentation" width="100%" style="border-collapse:collapse;">${rows}</table>
        </td></tr>
        <tr><td style="padding:18px 24px;text-align:right;">
          <a href="https://ogenplay.com/notifications" style="font-size:13px;color:#4f9dff;text-decoration:none;">לכל ההתראות באתר ←</a>
          <p style="margin:16px 0 0;font-size:11px;color:#6b7280;">מקבלים את המייל הזה כי הדלקתם "התראות במייל" בפרופיל. אפשר לכבות בכל רגע מהפרופיל.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export type EmailDigestRunResult =
  | { ok: true; sentEmails: number; skippedReason?: string; remainingToday: number }
  | { ok: false; error: string };

// הליבה: נקראת גם מה-cron (ראו app/api/cron/email-notifications) וגם מכפתור "שלח עכשיו"
// בניהול (ראו app/api/admin/email-notifications/run). מרכזת התראות ממתינות לכל משתמש
// למייל דייג'סט אחד, כדי שכל מייל שנשלח יעלה יחידה אחת בלבד מהמכסה היומית.
export async function runEmailDigestBatch(): Promise<EmailDigestRunResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY לא מוגדר בשרת" };

  const settings = await getEmailNotificationSettings();
  if (!settings.email_notifications_enabled) {
    return { ok: true, sentEmails: 0, skippedReason: "כבוי בהגדרות הניהול", remainingToday: 0 };
  }

  const now = new Date();
  const hour = israelHour(now);
  if (hour < settings.email_notifications_window_start || hour >= settings.email_notifications_window_end) {
    return { ok: true, sentEmails: 0, skippedReason: "מחוץ לחלון השעות שהוגדר", remainingToday: 0 };
  }

  const admin = createAdminSupabase();
  const todayKey = israelDateKey(now);
  const dayStartUtc = new Date(`${todayKey}T00:00:00+02:00`); // קירוב סביר ל"תחילת יום" ישראל; לא צריך דיוק DST מושלם כאן
  const { count: sentToday } = await admin
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("email_status", "sent")
    .gte("email_sent_at", dayStartUtc.toISOString());

  const remaining = settings.email_notifications_daily_cap - (sentToday ?? 0);
  if (remaining <= 0) {
    return { ok: true, sentEmails: 0, skippedReason: "המכסה היומית נוצלה", remainingToday: 0 };
  }

  // רק התראות ממתינות של משתמשים שהדליקו את המתג בפרופיל ויש להם מייל.
  const { data: pending } = await admin
    .from("user_notifications")
    .select("id, user_id, kind, title, body, url, created_at, user:profiles!user_notifications_user_id_fkey(email, username, email_notifications_enabled)")
    .eq("email_status", "pending")
    .order("created_at", { ascending: true })
    .limit(2000);

  const eligible = (pending ?? []).filter((n: any) => n.user?.email_notifications_enabled && n.user?.email);
  if (eligible.length === 0) {
    return { ok: true, sentEmails: 0, skippedReason: "אין התראות ממתינות למשתמשים עם מייל פעיל", remainingToday: remaining };
  }

  // קיבוץ לפי משתמש, בסדר לפי ההתראה הממתינה הכי ישנה שלו - מי שממתין הכי הרבה זמן נשלח לו ראשון.
  const byUser = new Map<string, { email: string; username: string; items: any[] }>();
  for (const n of eligible as any[]) {
    const u = byUser.get(n.user_id);
    if (u) u.items.push(n);
    else byUser.set(n.user_id, { email: n.user.email, username: n.user.username || "חבר/ה", items: [n] });
  }
  const usersOrdered = [...byUser.entries()]; // כבר בסדר עלייה כי eligible ממוין לפי created_at

  const selected = usersOrdered.slice(0, remaining);
  let sentEmails = 0;
  const sentNotificationIds: string[] = [];

  for (let i = 0; i < selected.length; i += RESEND_BATCH_SIZE) {
    const chunk = selected.slice(i, i + RESEND_BATCH_SIZE);
    const shownByUser = chunk.map(([, u]) => u.items.slice(0, MAX_ITEMS_PER_DIGEST));
    const payload = chunk.map(([, u], idx) => {
      const shown = shownByUser[idx];
      return {
        from: FROM,
        to: [u.email],
        subject: u.items.length === 1 ? u.items[0].title : `${u.items.length} התראות חדשות בעוגן פליי`,
        html: digestHtml(u.username, shown.map((n: any) => ({ title: n.title, body: n.body, url: n.url })))
      };
    });

    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) break; // עוצרים - מי שלא נשלח לו נשאר בתור, ינסה שוב בריצה הבאה

    // רק ההתראות שבאמת הופיעו במייל מסומנות כ"נשלח" - עודף מעבר לתקרה נשאר בתור לדייג'סט הבא.
    shownByUser.forEach((shown) => sentNotificationIds.push(...shown.map((n: any) => n.id)));
    sentEmails += chunk.length;

    if (i + RESEND_BATCH_SIZE < selected.length) await new Promise((r) => setTimeout(r, 600));
  }

  if (sentNotificationIds.length > 0) {
    await admin
      .from("user_notifications")
      .update({ email_status: "sent", email_sent_at: new Date().toISOString() })
      .in("id", sentNotificationIds);
  }

  return { ok: true, sentEmails, remainingToday: remaining - sentEmails };
}
