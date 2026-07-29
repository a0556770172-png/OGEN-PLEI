import { createAdminSupabase } from "./supabase/admin";
import type { AppRow, Profile, ProRequest } from "@/types/database";

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
