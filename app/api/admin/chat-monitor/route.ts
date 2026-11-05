import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// ניהול צ'אטים - מנהל בפועל בלבד. צפייה בלבד בשיחות הפרטיות בין משתמשים (dm_threads / dm_messages),
// לצורך אכיפת חוקי האתר. כל פתיחת שיחה נרשמת ביומן "מעקב פיקוח".
//   GET                -> רשימת שיחות אחרונות (אפשר ?user=<חלק משם משתמש>)
//   GET ?q=<טקסט>      -> חיפוש טקסט בכל ההודעות
//   GET ?thread=<id>   -> כל ההודעות בשיחה
export async function GET(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;
  if (profile.role !== "admin") return NextResponse.json({ error: "רק מנהל בפועל יכול לגשת לניהול צ'אטים" }, { status: 403 });

  const admin = createAdminSupabase();
  const sp = new URL(request.url).searchParams;
  const threadId = sp.get("thread");
  const q = sp.get("q")?.trim();
  const userFilter = sp.get("user")?.trim();

  async function namesFor(ids: string[]): Promise<Record<string, string>> {
    const unique = Array.from(new Set(ids));
    if (!unique.length) return {};
    const { data } = await admin.from("profiles").select("id, username").in("id", unique);
    return Object.fromEntries((data ?? []).map((p: any) => [p.id, p.username]));
  }

  // --- שיחה אחת ---
  if (threadId) {
    const { data: thread } = await admin.from("dm_threads").select("id, user_a, user_b, created_at").eq("id", threadId).single();
    if (!thread) return NextResponse.json({ error: "השיחה לא נמצאה" }, { status: 404 });
    const { data: messages } = await admin
      .from("dm_messages")
      .select("id, sender_id, body, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(1000);
    const names = await namesFor([thread.user_a, thread.user_b]);
    await logAudit({
      actorId: user.id,
      action: "view_dm_thread",
      targetType: "dm_thread",
      targetId: thread.id,
      targetLabel: `${names[thread.user_a] ?? "?"} ↔ ${names[thread.user_b] ?? "?"}`,
      undoable: false
    });
    return NextResponse.json({
      thread: { id: thread.id, a: names[thread.user_a] ?? "?", b: names[thread.user_b] ?? "?", createdAt: thread.created_at },
      messages: (messages ?? []).map((m: any) => ({ id: m.id, sender: names[m.sender_id] ?? "?", senderId: m.sender_id, body: m.body, createdAt: m.created_at }))
    });
  }

  // --- חיפוש טקסט ---
  if (q) {
    const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: hits } = await admin
      .from("dm_messages")
      .select("id, thread_id, sender_id, body, created_at")
      .ilike("body", `%${escaped}%`)
      .order("created_at", { ascending: false })
      .limit(100);
    const threadIds = Array.from(new Set((hits ?? []).map((h: any) => h.thread_id)));
    const { data: threads } = threadIds.length
      ? await admin.from("dm_threads").select("id, user_a, user_b").in("id", threadIds)
      : { data: [] as any[] };
    const tmap = new Map((threads ?? []).map((t: any) => [t.id, t]));
    const names = await namesFor([...(threads ?? []).flatMap((t: any) => [t.user_a, t.user_b]), ...(hits ?? []).map((h: any) => h.sender_id)]);
    return NextResponse.json({
      hits: (hits ?? []).map((h: any) => {
        const t = tmap.get(h.thread_id);
        return {
          id: h.id,
          threadId: h.thread_id,
          a: t ? names[t.user_a] ?? "?" : "?",
          b: t ? names[t.user_b] ?? "?" : "?",
          sender: names[h.sender_id] ?? "?",
          body: h.body,
          createdAt: h.created_at
        };
      })
    });
  }

  // --- רשימת שיחות אחרונות ---
  let allowedIds: string[] | null = null;
  if (userFilter) {
    const escaped = userFilter.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: matched } = await admin.from("profiles").select("id").ilike("username", `%${escaped}%`).limit(50);
    allowedIds = (matched ?? []).map((m: any) => m.id);
    if (!allowedIds.length) return NextResponse.json({ threads: [] });
  }

  let tq = admin.from("dm_threads").select("id, user_a, user_b, created_at").order("created_at", { ascending: false }).limit(300);
  if (allowedIds) tq = tq.or(`user_a.in.(${allowedIds.join(",")}),user_b.in.(${allowedIds.join(",")})`);
  const { data: threads } = await tq;
  const list = threads ?? [];

  const ids = list.map((t: any) => t.id);
  const { data: recent } = ids.length
    ? await admin
        .from("dm_messages")
        .select("thread_id, body, created_at")
        .in("thread_id", ids)
        .order("created_at", { ascending: false })
        .limit(2000)
    : { data: [] as any[] };
  const last = new Map<string, { body: string; createdAt: string }>();
  const counts = new Map<string, number>();
  for (const m of recent ?? []) {
    counts.set(m.thread_id, (counts.get(m.thread_id) ?? 0) + 1);
    if (!last.has(m.thread_id)) last.set(m.thread_id, { body: m.body, createdAt: m.created_at });
  }

  const names = await namesFor(list.flatMap((t: any) => [t.user_a, t.user_b]));
  const out = list
    .map((t: any) => ({
      id: t.id,
      a: names[t.user_a] ?? "?",
      b: names[t.user_b] ?? "?",
      lastBody: last.get(t.id)?.body ?? null,
      lastAt: last.get(t.id)?.createdAt ?? t.created_at,
      messages: counts.get(t.id) ?? 0
    }))
    .sort((x: any, y: any) => (x.lastAt < y.lastAt ? 1 : -1));
  return NextResponse.json({ threads: out });
}
