import { createAdminSupabase } from "./supabase/admin";

// כמה זמן יש למתנדב לסמן "בוצעה" אחרי שלקח בקשה. אחרי זה הבקשה משתחררת וחוזרת להיות
// פתוחה לכל המשתמשים (בקשה שכבר סומנה וממתינה לאישור צוות - לא משתחררת, היא אצל הצוות).
export const CLAIM_TTL_DAYS = 7;
const CLAIM_TTL_MS = CLAIM_TTL_DAYS * 24 * 60 * 60 * 1000;

// שחרור "עצל": נקרא בכל טעינה של לוח הבקשות ולפני כל פעולה על בקשה, כך שאין צורך ב-cron
// נפרד - ברגע שמישהו מסתכל על הלוח, כל התנדבות שפג תוקפה כבר משוחררת. המתנדב מקבל התראה.
export async function releaseStaleClaims(): Promise<void> {
  const admin = createAdminSupabase();
  const cutoff = new Date(Date.now() - CLAIM_TTL_MS).toISOString();

  const { data: stale } = await admin
    .from("community_requests")
    .select("id, title, claimed_by")
    .eq("status", "claimed")
    .lt("claimed_at", cutoff);
  if (!stale || stale.length === 0) return;

  // התנאים חוזרים גם בעדכון עצמו, כדי לא לשחרר בקשה שבינתיים סומנה כבוצעה.
  const { data: released } = await admin
    .from("community_requests")
    .update({ status: "open", claimed_by: null, claimed_at: null, updated_at: new Date().toISOString() })
    .in("id", stale.map((r) => r.id))
    .eq("status", "claimed")
    .lt("claimed_at", cutoff)
    .select("id");
  const releasedIds = new Set((released ?? []).map((r) => r.id));

  const notices = stale
    .filter((r) => releasedIds.has(r.id) && r.claimed_by)
    .map((r) => ({
      user_id: r.claimed_by as string,
      kind: "community_claim_expired",
      title: `ההתנדבות שלך ל"${r.title}" שוחררה`,
      body: `עבר שבוע בלי סימון "בוצעה", והבקשה חזרה להיות פתוחה לכולם. אפשר להתנדב אליה שוב.`,
      url: "/community"
    }));
  if (notices.length > 0) await admin.from("user_notifications").insert(notices);
}
