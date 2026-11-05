import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminSupabase>;

// ספירת הודעות שלא נקראו לכל השיחות בשאילתה אחת (פונקציית SQL - מיגרציה 0073). אם הפונקציה
// עוד לא קיימת, נופלים חזרה לספירה נפרדת לכל שיחה כמו קודם.
async function unreadMap(
  admin: Admin,
  kind: "ticket" | "council",
  userId: string,
  ids: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!ids.length) return map;

  const { data, error } = await admin.rpc(kind === "ticket" ? "ticket_unread_counts" : "council_unread_counts", {
    p_user: userId,
    p_ids: ids
  });
  if (!error) {
    for (const row of (data ?? []) as { conv_id: string; unread: number }[]) map.set(row.conv_id, Number(row.unread));
    return map;
  }

  // גיבוי (לפני המיגרציה)
  const readsTable = kind === "ticket" ? "ticket_reads" : "council_thread_reads";
  const readsKey = kind === "ticket" ? "ticket_id" : "thread_id";
  const msgsTable = kind === "ticket" ? "ticket_messages" : "council_messages";
  const { data: reads } = await admin.from(readsTable).select(`${readsKey}, last_read_at`).eq("user_id", userId);
  const readMap = new Map((reads ?? []).map((r: any) => [r[readsKey], r.last_read_at]));
  await Promise.all(
    ids.map(async (id) => {
      const since = readMap.get(id) ?? "1970-01-01T00:00:00Z";
      const { count } = await admin
        .from(msgsTable)
        .select("id", { count: "exact", head: true })
        .eq(readsKey, id)
        .gt("created_at", since)
        .neq("sender_id", userId)
        .is("deleted_at", null);
      if (count && count > 0) map.set(id, count);
    })
  );
  return map;
}

// מחזיר את מספר ההודעות שלא נקראו לכל שיחה (הודעות/ועדה) בנפרד, כדי שאפשר יהיה להראות
// בדיוק מאיזו שיחה יש הודעות חדשות - ולא רק מספר כולל אחד בלי הקשר.
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const admin = createAdminSupabase();
  const staff = isStaff(profile);

  let ticketsQuery = admin.from("tickets").select("id, subject, assigned_staff_id, user_id");
  if (staff) {
    if (profile.role !== "admin") {
      ticketsQuery = ticketsQuery.or(`assigned_staff_id.is.null,assigned_staff_id.eq.${user.id}`);
    }
  } else {
    ticketsQuery = ticketsQuery.eq("user_id", user.id);
  }
  const { data: tickets } = await ticketsQuery;

  const conversations: Array<{ type: "ticket" | "council"; id: string; title: string; unreadCount: number }> = [];

  const ticketUnread = await unreadMap(admin, "ticket", user.id, (tickets ?? []).map((t: any) => t.id));
  for (const t of (tickets ?? []) as any[]) {
    const n = ticketUnread.get(t.id);
    if (n && n > 0) conversations.push({ type: "ticket", id: t.id, title: t.subject, unreadCount: n });
  }

  if (staff) {
    const { data: threads } = await admin.from("council_threads").select("id, title");
    const councilUnread = await unreadMap(admin, "council", user.id, (threads ?? []).map((t: any) => t.id));
    for (const t of (threads ?? []) as any[]) {
      const n = councilUnread.get(t.id);
      if (n && n > 0) conversations.push({ type: "council", id: t.id, title: t.title, unreadCount: n });
    }
  }

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  return NextResponse.json({ totalUnread, conversations });
}
