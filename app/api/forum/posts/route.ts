import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { notifyForNewForumThread, notifyForForumReply, notifyForumMentions } from "@/lib/notifications";

const MAX_BODY = 5000;
const MAX_TITLE = 140;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 4; // עד 4 פוסטים/תגובות בדקה למשתמש

// יצירת פוסט חדש בפורום (parentId ריק) או תגובה לפוסט קיים.
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  if ((profile as any).forum_banned) {
    return NextResponse.json(
      { error: "אין לך כרגע אפשרות לכתוב בפורום. אם לדעתך זו טעות, פנו לצוות דרך עמוד התמיכה." },
      { status: 403 }
    );
  }

  const { title, body, parentId, replyToId, mentionIds } = await request.json().catch(() => ({}));
  const cleanBody = typeof body === "string" ? body.trim() : "";
  if (cleanBody.length < 2) return NextResponse.json({ error: "צריך לכתוב משהו" }, { status: 400 });
  if (cleanBody.length > MAX_BODY) return NextResponse.json({ error: "הטקסט ארוך מדי" }, { status: 400 });

  const admin = createAdminSupabase();

  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await admin
    .from("forum_posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_MAX) {
    return NextResponse.json({ error: "רגע, יותר מדי הודעות בזמן קצר. נסו שוב עוד דקה." }, { status: 429 });
  }

  let parent: string | null = null;
  let replyTo: string | null = null;
  let cleanTitle: string | null = null;
  if (typeof parentId === "string" && parentId) {
    const { data: p } = await admin
      .from("forum_posts")
      .select("id, parent_id, hidden")
      .eq("id", parentId)
      .maybeSingle();
    if (!p || p.parent_id || p.hidden) return NextResponse.json({ error: "הפוסט לא נמצא" }, { status: 404 });
    parent = p.id;
    // תגובה לתגובה מסוימת באותו דיון (ציטוט/"הגב"). אם מדובר בפוסט הראשי עצמו - זו תגובה רגילה.
    if (typeof replyToId === "string" && replyToId && replyToId !== p.id) {
      const { data: target } = await admin
        .from("forum_posts")
        .select("id, parent_id, hidden")
        .eq("id", replyToId)
        .maybeSingle();
      if (target && target.parent_id === p.id && !target.hidden) replyTo = target.id;
    }
  } else {
    cleanTitle = typeof title === "string" && title.trim() ? title.trim().slice(0, MAX_TITLE) : null;
  }

  const { data: created, error } = await admin
    .from("forum_posts")
    .insert({ user_id: user.id, parent_id: parent, reply_to_id: replyTo, title: cleanTitle, body: cleanBody })
    .select("id")
    .single();
  if (error || !created) return NextResponse.json({ error: "שגיאה בשמירה" }, { status: 500 });

  // הזכרות (@שם): רק מי שנבחר מהרשימה ושהשם שלו באמת מופיע בטקסט, עד 5, לא עצמך ולא חסומים
  try {
    if (Array.isArray(mentionIds) && mentionIds.length) {
      const ids = [...new Set(mentionIds.filter((x: unknown) => typeof x === "string"))].slice(0, 5).filter((id) => id !== user.id) as string[];
      if (ids.length) {
        const { data: mentioned } = await admin.from("profiles").select("id, username, banned").in("id", ids);
        const valid = (mentioned ?? []).filter((u) => !u.banned && cleanBody.includes(`@${u.username}`));
        if (valid.length) await admin.from("forum_mentions").insert(valid.map((u) => ({ post_id: created.id, user_id: u.id })));
      }
    }
  } catch {
    // ignore
  }

  // מעקב אוטומטי אחרי הדיון + התראות. best-effort - לא מפיל את הבקשה.
  const threadId = parent ?? created.id;
  try {
    await admin
      .from("notification_subscriptions")
      .upsert(
        { user_id: user.id, type: "forum_thread", target_id: threadId },
        { onConflict: "user_id,type,target_id" }
      );
  } catch {
    // ignore
  }
  try {
    if (parent) await notifyForForumReply(created.id);
    else await notifyForNewForumThread(created.id);
  } catch {
    // ignore
  }
  try {
    await notifyForumMentions(created.id);
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true, id: created.id });
}
