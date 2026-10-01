import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { notifyUsers } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// תגובות בבקשת קהילה. GET ציבורי, POST למשתמש מחובר. אפשר להגיב לבקשה עצמה, או לענות
// לתגובה של משתמש אחר (parentId). תשובה לתשובה נשמרת תחת התגובה הראשית של אותו שרשור
// (רמה אחת של תשובות), אבל ההתראה נשלחת למי שעליו ענו בפועל.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const admin = createAdminSupabase();
  const { data: comments, error } = await admin
    .from("community_request_comments")
    .select("id, request_id, author_id, parent_id, body, created_at")
    .eq("request_id", params.id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = comments ?? [];
  const ids = [...new Set(rows.map((c) => c.author_id))];
  const { data: users } = ids.length
    ? await admin.from("profiles").select("id, username").in("id", ids)
    : { data: [] as { id: string; username: string }[] };
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  return NextResponse.json({ comments: rows.map((c) => ({ ...c, author: userMap.get(c.author_id) ?? null })) });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const { body, parentId } = await request.json().catch(() => ({}));
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) return NextResponse.json({ error: "יש לכתוב תגובה" }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ error: "התגובה ארוכה מדי (עד 1000 תווים)" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: req } = await admin.from("community_requests").select("id, title, requested_by, claimed_by").eq("id", params.id).maybeSingle();
  if (!req) return NextResponse.json({ error: "הבקשה לא נמצאה" }, { status: 404 });

  let threadRootId: string | null = null;
  let repliedToAuthor: string | null = null;
  if (typeof parentId === "string" && parentId) {
    const { data: parent } = await admin
      .from("community_request_comments")
      .select("id, request_id, parent_id, author_id")
      .eq("id", parentId)
      .maybeSingle();
    if (!parent || parent.request_id !== req.id) return NextResponse.json({ error: "התגובה שעליה עונים לא נמצאה" }, { status: 404 });
    threadRootId = parent.parent_id ?? parent.id;
    repliedToAuthor = parent.author_id;
  }

  const { data: inserted, error } = await admin
    .from("community_request_comments")
    .insert({ request_id: req.id, author_id: user.id, parent_id: threadRootId, body: text })
    .select("id")
    .single();
  if (error || !inserted) return NextResponse.json({ error: `שגיאה בשמירת התגובה: ${error?.message ?? ""}` }, { status: 500 });

  // התראות בפעמון: למי שעליו ענו, ולמבקש ולמתנדב (אם הם לא הכותבים עצמם).
  const snippet = text.slice(0, 100);
  const sends: Promise<void>[] = [];
  if (repliedToAuthor && repliedToAuthor !== user.id) {
    sends.push(
      notifyUsers([repliedToAuthor], {
        kind: "community_comment_reply",
        title: `${profile.username} ענה/תה לתגובה שלך בבקשה "${req.title}"`,
        body: snippet,
        url: "/community"
      })
    );
  }
  const others = [req.requested_by, req.claimed_by].filter((id): id is string => !!id && id !== user.id && id !== repliedToAuthor);
  if (others.length) {
    sends.push(
      notifyUsers(others, {
        kind: "community_comment",
        title: `${profile.username} הגיב/ה בבקשה "${req.title}"`,
        body: snippet,
        url: "/community"
      })
    );
  }
  await Promise.all(sends.map((p) => p.catch(() => {})));

  return NextResponse.json({ ok: true, id: inserted.id });
}
