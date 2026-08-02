import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { addPoints } from "@/lib/points";
import { canLike, LIKE_UNLOCK_THRESHOLD } from "@/lib/engagement-eligibility";

// GET: מספר הלייקים על האפליקציה, והאם המשתמש המחובר (אם יש) כבר סימן לייק.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const admin = createAdminSupabase();
  const { count } = await admin.from("app_likes").select("id", { count: "exact", head: true }).eq("app_id", params.id);

  const result = await requireProfile();
  let liked = false;
  if (!("error" in result)) {
    const { count: mine } = await admin
      .from("app_likes")
      .select("id", { count: "exact", head: true })
      .eq("app_id", params.id)
      .eq("user_id", result.user.id);
    liked = (mine ?? 0) > 0;
  }

  return NextResponse.json({ count: count ?? 0, liked });
}

// POST: מחליף מצב לייק (טוגל) - לייק ראשון דורש סף של LIKE_UNLOCK_THRESHOLD אפליקציות
// שהמשתמש עצמו העלה. כל לייק מוסיף/מוריד נקודה אחת למפתח האפליקציה (לא לעצמו - אין
// אפשרות לתת לייק לאפליקציה של עצמך).
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const admin = createAdminSupabase();
  const { data: app } = await admin.from("apps").select("id, developer_id").eq("id", params.id).single();
  if (!app) return NextResponse.json({ error: "האפליקציה לא נמצאה" }, { status: 404 });
  if (app.developer_id === user.id) {
    return NextResponse.json({ error: "לא ניתן לתת לייק לאפליקציה שלך" }, { status: 400 });
  }

  const { data: existing } = await admin
    .from("app_likes")
    .select("id")
    .eq("app_id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await admin.from("app_likes").delete().eq("id", existing.id);
    await addPoints(app.developer_id, -1);
    revalidatePath(`/apps/${params.id}`);
    return NextResponse.json({ ok: true, liked: false });
  }

  const allowed = await canLike(user.id);
  if (!allowed) {
    return NextResponse.json(
      { error: `לייק נפתח אוטומטית אחרי ${LIKE_UNLOCK_THRESHOLD} אפליקציות/תוכנות שהעליתם.` },
      { status: 403 }
    );
  }

  const { error } = await admin.from("app_likes").insert({ app_id: params.id, user_id: user.id });
  if (error) return NextResponse.json({ error: `שגיאה בשמירת הלייק: ${error.message}` }, { status: 500 });
  await addPoints(app.developer_id, 1);

  revalidatePath(`/apps/${params.id}`);
  return NextResponse.json({ ok: true, liked: true });
}
