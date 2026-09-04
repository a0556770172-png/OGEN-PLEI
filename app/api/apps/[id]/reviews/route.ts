import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { canComment, COMMENT_UNLOCK_THRESHOLD } from "@/lib/engagement-eligibility";
import { logAudit } from "@/lib/audit";

// GET: כל הביקורות (כוכבים + תגובה) על אפליקציה - ציבורי.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const admin = createAdminSupabase();
  const { data: reviews } = await admin
    .from("app_reviews")
    .select("id, user_id, rating, comment, created_at, updated_at")
    .eq("app_id", params.id)
    .order("created_at", { ascending: false });

  const rows = reviews ?? [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: users } = userIds.length
    ? await admin.from("profiles").select("id, username").in("id", userIds)
    : { data: [] as any[] };
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  const enriched = rows.map((r) => ({ ...r, user: userMap.get(r.user_id) ?? null }));
  const avgRating = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0;

  return NextResponse.json({ reviews: enriched, avgRating, count: rows.length });
}

// POST: יצירה/עדכון של הביקורת של המשתמש המחובר על האפליקציה הזו (כוכבים תמיד פתוח לכולם -
// תגובת טקסט דורשת סף של COMMENT_UNLOCK_THRESHOLD אפליקציות שהועלו על ידי המדרג).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const { rating, comment } = await request.json().catch(() => ({}));
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ error: "יש לבחור דירוג בין 1 ל-5 כוכבים" }, { status: 400 });
  }

  const trimmedComment = typeof comment === "string" ? comment.trim() : "";
  if (trimmedComment) {
    const allowed = await canComment(user.id);
    if (!allowed) {
      return NextResponse.json(
        { error: `כתיבת תגובה נפתחת אוטומטית אחרי ${COMMENT_UNLOCK_THRESHOLD} אפליקציות/תוכנות שהעליתם. אפשר עדיין לדרג בכוכבים בלי תגובה.` },
        { status: 403 }
      );
    }
  }

  const admin = createAdminSupabase();
  const { data: app } = await admin.from("apps").select("id").eq("id", params.id).single();
  if (!app) return NextResponse.json({ error: "האפליקציה לא נמצאה" }, { status: 404 });

  const { error } = await admin.from("app_reviews").upsert(
    { app_id: params.id, user_id: user.id, rating: ratingNum, comment: trimmedComment || null, updated_at: new Date().toISOString() },
    { onConflict: "app_id,user_id" }
  );
  if (error) return NextResponse.json({ error: `שגיאה בשמירת הביקורת: ${error.message}` }, { status: 500 });

  revalidatePath(`/apps/${params.id}`);
  return NextResponse.json({ ok: true });
}

// DELETE: מחיקת הביקורת של המשתמש המחובר על האפליקציה הזו. צוות (מנהל/פיקוח) יכול למחוק
// גם ביקורת של משתמש אחר ע"י שליחת { targetUserId } בגוף הבקשה - לצורך שליטה בתגובות.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const body = await request.json().catch(() => ({}));
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : null;
  const admin = createAdminSupabase();

  if (targetUserId && targetUserId !== user.id) {
    if (!isStaff(profile)) return NextResponse.json({ error: "רק צוות יכול למחוק תגובות של אחרים" }, { status: 403 });
    const { data: victim } = await admin.from("profiles").select("username").eq("id", targetUserId).maybeSingle();
    await admin.from("app_reviews").delete().eq("app_id", params.id).eq("user_id", targetUserId);
    await logAudit({
      actorId: user.id,
      action: "delete_app_review",
      targetType: "app",
      targetId: params.id,
      targetLabel: victim?.username ?? null
    });
    revalidatePath(`/apps/${params.id}`);
    return NextResponse.json({ ok: true });
  }

  await admin.from("app_reviews").delete().eq("app_id", params.id).eq("user_id", user.id);

  revalidatePath(`/apps/${params.id}`);
  return NextResponse.json({ ok: true });
}
