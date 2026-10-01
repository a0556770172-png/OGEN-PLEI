import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// מחיקת תגובה בבקשת קהילה - הכותב עצמו או צוות (מחיקת תגובה ראשית מוחקת גם את התשובות אליה).
export async function DELETE(_request: Request, { params }: { params: { commentId: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const admin = createAdminSupabase();
  const { data: comment } = await admin.from("community_request_comments").select("author_id").eq("id", params.commentId).maybeSingle();
  if (!comment) return NextResponse.json({ error: "התגובה לא נמצאה" }, { status: 404 });
  if (comment.author_id !== user.id && !isStaff(profile)) {
    return NextResponse.json({ error: "רק הכותב או צוות יכולים למחוק תגובה" }, { status: 403 });
  }

  await admin.from("community_request_comments").delete().eq("id", params.commentId);
  return NextResponse.json({ ok: true });
}
