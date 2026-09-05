import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { addPoints } from "@/lib/points";
import { FORUM_LIKE_POINTS } from "@/lib/forum";

// לייק / ביטול לייק על פוסט בפורום (toggle).
// לייק ראשון אי-פעם של משתמש על פוסט ראשי מזכה את הכותב ב-FORUM_LIKE_POINTS מוניטין -
// פעם אחת בלבד (forum_like_points_awarded), כדי למנוע farming ע"י לייק/ביטול/לייק.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const admin = createAdminSupabase();
  const { data: post } = await admin
    .from("forum_posts")
    .select("id, user_id, parent_id, hidden")
    .eq("id", params.id)
    .maybeSingle();
  if (!post || post.hidden) return NextResponse.json({ error: "הפוסט לא נמצא" }, { status: 404 });
  if (post.user_id === user.id) {
    return NextResponse.json({ error: "אי אפשר לתת לייק לפוסט של עצמך" }, { status: 400 });
  }

  const { data: existing } = await admin
    .from("forum_post_likes")
    .select("id")
    .eq("post_id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await admin.from("forum_post_likes").delete().eq("id", existing.id);
    return NextResponse.json({ ok: true, liked: false });
  }

  await admin.from("forum_post_likes").insert({ post_id: params.id, user_id: user.id });

  if (!post.parent_id) {
    const { error: guardErr } = await admin
      .from("forum_like_points_awarded")
      .insert({ post_id: params.id, liker_id: user.id });
    if (!guardErr) {
      await addPoints(post.user_id, FORUM_LIKE_POINTS);
      await admin
        .from("points_log")
        .insert({ profile_id: post.user_id, delta: FORUM_LIKE_POINTS, reason: "forum_post_liked" });
    }
  }

  return NextResponse.json({ ok: true, liked: true });
}
