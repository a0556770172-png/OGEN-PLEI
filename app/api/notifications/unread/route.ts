import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

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

  const { data: ticketReads } = await admin.from("ticket_reads").select("ticket_id, last_read_at").eq("user_id", user.id);
  const readMap = new Map((ticketReads ?? []).map((r: any) => [r.ticket_id, r.last_read_at]));

  const conversations: Array<{ type: "ticket" | "council"; id: string; title: string; unreadCount: number }> = [];

  await Promise.all(
    (tickets ?? []).map(async (t: any) => {
      const since = readMap.get(t.id) ?? "1970-01-01T00:00:00Z";
      const { count } = await admin
        .from("ticket_messages")
        .select("id", { count: "exact", head: true })
        .eq("ticket_id", t.id)
        .gt("created_at", since)
        .neq("sender_id", user.id)
        .is("deleted_at", null);
      if (count && count > 0) conversations.push({ type: "ticket", id: t.id, title: t.subject, unreadCount: count });
    })
  );

  if (staff) {
    const { data: threads } = await admin.from("council_threads").select("id, title");
    const { data: threadReads } = await admin.from("council_thread_reads").select("thread_id, last_read_at").eq("user_id", user.id);
    const threadReadMap = new Map((threadReads ?? []).map((r: any) => [r.thread_id, r.last_read_at]));

    await Promise.all(
      (threads ?? []).map(async (t: any) => {
        const since = threadReadMap.get(t.id) ?? "1970-01-01T00:00:00Z";
        const { count } = await admin
          .from("council_messages")
          .select("id", { count: "exact", head: true })
          .eq("thread_id", t.id)
          .gt("created_at", since)
          .neq("sender_id", user.id)
          .is("deleted_at", null);
        if (count && count > 0) conversations.push({ type: "council", id: t.id, title: t.title, unreadCount: count });
      })
    );
  }

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  return NextResponse.json({ totalUnread, conversations });
}
