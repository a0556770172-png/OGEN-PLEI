import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// עריכת פוסט (הבעלים) או פעולות פיקוח (הסתרה / נעיצה).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;
  const staff = isStaff(profile);

  const body = await request.json().catch(() => ({}));
  const admin = createAdminSupabase();
  const { data: post } = await admin.from("forum_posts").select("*").eq("id", params.id).maybeSingle();
  if (!post) return NextResponse.json({ error: "הפוסט לא נמצא" }, { status: 404 });

  const patch: Record<string, any> = {};

  if (typeof body.body === "string") {
    if (post.user_id !== user.id) return NextResponse.json({ error: "אפשר לערוך רק פוסט שלך" }, { status: 403 });
    const t = body.body.trim();
    if (t.length < 2 || t.length > 5000) return NextResponse.json({ error: "אורך טקסט לא תקין" }, { status: 400 });
    patch.body = t;
    patch.updated_at = new Date().toISOString();
    if (post.parent_id === null && typeof body.title === "string") {
      patch.title = body.title.trim().slice(0, 140) || null;
    }
  }

  if (typeof body.hidden === "boolean") {
    if (!staff) return NextResponse.json({ error: "רק צוות" }, { status: 403 });
    patch.hidden = body.hidden;
  }
  if (typeof body.pinned === "boolean") {
    if (!staff) return NextResponse.json({ error: "רק צוות" }, { status: 403 });
    patch.pinned = body.pinned;
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "אין מה לעדכן" }, { status: 400 });

  const { error } = await admin.from("forum_posts").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: `שגיאה: ${error.message}` }, { status: 500 });

  if (staff && typeof body.hidden === "boolean") {
    await logAudit({
      actorId: user.id,
      action: body.hidden ? "hide_forum_post" : "unhide_forum_post",
      targetType: "forum_post",
      targetId: params.id,
      targetLabel: post.title || post.body.slice(0, 60)
    });
  }
  if (staff && typeof body.pinned === "boolean") {
    await logAudit({
      actorId: user.id,
      action: body.pinned ? "pin_forum_post" : "unpin_forum_post",
      targetType: "forum_post",
      targetId: params.id,
      targetLabel: post.title || post.body.slice(0, 60)
    });
  }

  return NextResponse.json({ ok: true });
}

// מחיקת פוסט - הבעלים או צוות. מחיקה מוחקת בקסקדה גם תגובות ולייקים.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;
  const staff = isStaff(profile);

  const admin = createAdminSupabase();
  const { data: post } = await admin.from("forum_posts").select("id, user_id, title, body").eq("id", params.id).maybeSingle();
  if (!post) return NextResponse.json({ error: "הפוסט לא נמצא" }, { status: 404 });
  if (post.user_id !== user.id && !staff) {
    return NextResponse.json({ error: "אפשר למחוק רק פוסט שלך" }, { status: 403 });
  }

  await admin.from("forum_posts").delete().eq("id", params.id);

  if (staff && post.user_id !== user.id) {
    await logAudit({
      actorId: user.id,
      action: "delete_forum_post",
      targetType: "forum_post",
      targetId: params.id,
      targetLabel: post.title || post.body.slice(0, 60)
    });
  }

  return NextResponse.json({ ok: true });
}
