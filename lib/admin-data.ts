import { createAdminSupabase } from "./supabase/admin";
import type { AppRow, Profile, ProRequest, UserDeletionRequest, BanAppeal } from "@/types/database";

export async function getReviewQueueApps(): Promise<AppRow[]> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("apps")
    .select("*, developer:profiles!apps_developer_id_fkey(username, email)")
    .in("status", ["pending"])
    .order("created_at", { ascending: true });
  return (data as unknown as AppRow[]) ?? [];
}

export async function getAllAppsForAdmin(): Promise<AppRow[]> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("apps")
    .select("*, developer:profiles!apps_developer_id_fkey(username, email)")
    .order("created_at", { ascending: false });
  return (data as unknown as AppRow[]) ?? [];
}

export async function getAllProfiles(): Promise<Profile[]> {
  const admin = createAdminSupabase();
  const { data } = await admin.from("profiles").select("*").order("created_at", { ascending: false });
  return (data as Profile[]) ?? [];
}

export async function getPendingProRequests(): Promise<ProRequest[]> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("pro_requests")
    .select("*, developer:profiles!pro_requests_developer_id_fkey(username, email, points)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  return (data as unknown as ProRequest[]) ?? [];
}

export async function getPendingSuggestionsCount(): Promise<number> {
  const admin = createAdminSupabase();
  const { count } = await admin
    .from("app_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}

// טיקטים "פתוחים" שההודעה האחרונה בהם נשלחה ע"י המשתמש (כלומר עדיין ממתינים לתגובת צוות) -
// זה מדויק יותר מסתם "סטטוס פתוח", כי טיקט פתוח שהצוות כבר ענה בו אחרון לא דורש טיפול דחוף.
export async function getTicketsNeedingReplyCount(): Promise<number> {
  const admin = createAdminSupabase();
  const { data: openTickets } = await admin.from("tickets").select("id").eq("status", "open");
  const ids = (openTickets ?? []).map((t) => t.id);
  if (ids.length === 0) return 0;

  const { data: messages } = await admin
    .from("ticket_messages")
    .select("ticket_id, sender_role, created_at")
    .in("ticket_id", ids)
    .order("created_at", { ascending: false });

  const latestByTicket = new Map<string, string>();
  for (const m of messages ?? []) {
    if (!latestByTicket.has(m.ticket_id)) latestByTicket.set(m.ticket_id, m.sender_role);
  }
  return [...latestByTicket.values()].filter((role) => role === "user").length;
}

// בקשות מחיקת משתמש שהוגשו ע"י צוות פיקוח וממתינות לאישור/דחייה של מנהל בפועל בלבד.
export async function getPendingDeletionRequests(): Promise<UserDeletionRequest[]> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("user_deletion_requests")
    .select("*, target:profiles!user_deletion_requests_target_user_id_fkey(username, email, role), requester:profiles!user_deletion_requests_requested_by_fkey(username, email)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  return (data as unknown as UserDeletionRequest[]) ?? [];
}

// ועדות שנפתחו אוטומטית (בלי אישור מנהל, כי שני חברי צוות ביקשו תוך 24 שעות) ועדיין פתוחות -
// אלה "קופצות" למנהל כהתראה, כדי שיידע שמשהו דורש תשומת לב דחופה מהצוות.
export async function getOpenAutoApprovedCouncilCount(): Promise<number> {
  const admin = createAdminSupabase();
  const { count } = await admin
    .from("council_threads")
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .eq("auto_approved", true);
  return count ?? 0;
}

export async function getPendingDeletionRequestsCount(): Promise<number> {
  const admin = createAdminSupabase();
  const { count } = await admin
    .from("user_deletion_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}

// שלוש הפונקציות הבאות הן גרסאות "ספירה בלבד" (בלי לשלוף שורות מלאות) - נועדו לשימוש
// ב-endpoint קליל שנסרק לעיתים קרובות (כל דקה) ע"י תוסף הכרום/אפליקציית האנדרואיד של
// הצוות, כדי שלא נשלוף כל פעם כמויות מיותרות של דאטה רק כדי לספור.
export async function getPendingReviewCount(): Promise<number> {
  const admin = createAdminSupabase();
  const { count } = await admin
    .from("apps")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}

export async function getPendingProRequestsCount(): Promise<number> {
  const admin = createAdminSupabase();
  const { count } = await admin
    .from("pro_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}

export async function getPendingAppReportsCount(): Promise<number> {
  const admin = createAdminSupabase();
  const { count } = await admin
    .from("app_reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}

// כל ערעורי החסימה (כולל כאלה שכבר טופלו) - מוצג לצוות בטאב "ערעורי חסימה", ממוין כך
// שהכי עדכני (כולל הודעה חדשה שהמשתמש הוסיף אחרי תגובת צוות) עולה קודם.
export async function getBanAppeals(): Promise<BanAppeal[]> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("ban_appeals")
    .select("*, user:profiles!ban_appeals_user_id_fkey(*)")
    .order("updated_at", { ascending: false });
  return (data as unknown as BanAppeal[]) ?? [];
}

export async function getPendingBanAppealsCount(): Promise<number> {
  const admin = createAdminSupabase();
  const { count } = await admin
    .from("ban_appeals")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}
