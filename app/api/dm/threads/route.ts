import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// רשימת השיחות (צ'אטים בין משתמשים) של המשתמש המחובר, עם שם הצד השני ותאריך ההודעה
// האחרונה, ממוין מהחדש לישן.
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const admin = createAdminSupabase();
  const { data: threads } = await admin
    .from("dm_threads")
    .select("id, user_a, user_b, created_at")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .order("created_at", { ascending: false });

  const rows = threads ?? [];
  const otherIds = rows.map((t) => (t.user_a === user.id ? t.user_b : t.user_a));
  const { data: profiles } = otherIds.length
    ? await admin.from("profiles").select("id, username, avatar_key").in("id", otherIds)
    : { data: [] as any[] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const { data: reads } = await admin
    .from("dm_thread_reads")
    .select("thread_id, last_read_at")
    .eq("user_id", user.id);
  const readMap = new Map((reads ?? []).map((r) => [r.thread_id, r.last_read_at]));

  const result2 = await Promise.all(
    rows.map(async (t) => {
      const otherId = t.user_a === user.id ? t.user_b : t.user_a;
      const other = profileMap.get(otherId);
      const { data: lastMsg } = await admin
        .from("dm_messages")
        .select("body, created_at, sender_id")
        .eq("thread_id", t.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastReadAt = readMap.get(t.id);
      let unread = 0;
      if (lastMsg) {
        const { count } = await admin
          .from("dm_messages")
          .select("id", { count: "exact", head: true })
          .eq("thread_id", t.id)
          .neq("sender_id", user.id)
          .gt("created_at", lastReadAt ?? "1970-01-01");
        unread = count ?? 0;
      }
      return {
        id: t.id,
        otherUserId: otherId,
        otherUsername: other?.username ?? "משתמש",
        lastMessage: lastMsg?.body ?? null,
        lastMessageAt: lastMsg?.created_at ?? t.created_at,
        unreadCount: unread
      };
    })
  );

  result2.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  return NextResponse.json({ threads: result2 });
}
