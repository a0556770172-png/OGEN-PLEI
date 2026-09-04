import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// הוספה/עדכון של ביקורת המשתמש על האתר. ביקורת אחת לכל משתמש (upsert).
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const { rating, comment } = await request.json().catch(() => ({}));
  const r = Math.round(Number(rating));
  if (!Number.isFinite(r) || r < 1 || r > 5) {
    return NextResponse.json({ error: "יש לבחור דירוג בין 1 ל-5 כוכבים" }, { status: 400 });
  }
  const c = typeof comment === "string" ? comment.trim().slice(0, 1500) : "";

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("site_reviews")
    .upsert(
      { user_id: user.id, rating: r, comment: c || null, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (error) return NextResponse.json({ error: `שגיאה בשמירת הביקורת: ${error.message}` }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// מחיקת הביקורת של המשתמש עצמו.
export async function DELETE() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const admin = createAdminSupabase();
  await admin.from("site_reviews").delete().eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
