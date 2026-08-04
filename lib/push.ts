import webpush from "web-push";
import { createAdminSupabase } from "./supabase/admin";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
  if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// שולח התראת דפדפן אמיתית (Web Push) לכל המכשירים הרשומים של משתמש נתון. עובד גם כשהמשתמש
// לא נמצא באתר כרגע (זה בדיוק ההבדל בין זה לבין "התראה" רגילה שרק מוצגת בתוך האתר עצמו).
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  ensureConfigured();
  if (!configured) return; // אם מפתחות ה-VAPID לא הוגדרו עדיין בסביבה - מדלגים בשקט
  const admin = createAdminSupabase();
  const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", userId);
  if (!subs || subs.length === 0) return;

  await Promise.all(
    subs.map(async (sub: any) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          JSON.stringify(payload)
        );
      } catch (err: any) {
        // מנוי שפג תוקפו (הדפדפן בוטל/הותקן מחדש) - מוחקים אותו בשקט כדי לא לנסות שוב לשווא
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );
}

// שולח לכל בעלי חשבון מנהל (role = 'admin') - משמש להתראות כלליות שרק המנהל צריך לדעת עליהן
// (בקשת מחיקה חדשה, בקשת PRO חדשה, הצעת אפליקציה חדשה, ועדה שנפתחה אוטומטית וכו').
export async function notifyAdmins(payload: PushPayload): Promise<void> {
  ensureConfigured();
  if (!configured) return;
  const admin = createAdminSupabase();
  const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
  if (!admins) return;
  await Promise.all(admins.map((a: any) => sendPushToUser(a.id, payload)));
}

// שולח לכל משתמש רשום באתר - שימוש נדיר ומכוון בלבד, כמו עדכון חוקי אתר שדורש תשומת לב
// מיידית מכולם (ראו app/api/admin/site-rules/route.ts, action "publish"). לא מיועד
// לשימוש שגרתי - זו לא אמורה להיות התראה "על כל דבר".
export async function notifyAllUsers(payload: PushPayload): Promise<void> {
  ensureConfigured();
  if (!configured) return;
  const admin = createAdminSupabase();
  const { data: users } = await admin.from("profiles").select("id").eq("banned", false);
  if (!users) return;
  // בבאצ'ים כדי לא להציף את שרת ה-Push בבת אחת אם יש הרבה משתמשים.
  const BATCH_SIZE = 25;
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((u: any) => sendPushToUser(u.id, payload)));
  }
}
