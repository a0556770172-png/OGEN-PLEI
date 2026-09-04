import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { moderateReviewText } from "@/lib/reviewModeration";

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

  // סינון AI - רק אם יש טקסט. fail-open: אם הסינון לא זמין, מפרסמים כרגיל.
  let autoHidden = false;
  let moderationReason: string | null = null;
  if (c) {
    const verdict = await moderateReviewText(r, c);
    if (verdict.flag) {
      autoHidden = true;
      moderationReason = verdict.reason || "סומן ע\"י סינון אוטומטי";
    }
  }

  const admin = createAdminSupabase();
  const row: Record<string, any> = {
    user_id: user.id,
    rating: r,
    comment: c || null,
    updated_at: new Date().toISOString()
  };
  // מעדכנים את מצב ההסתרה רק כשיש טקסט שנבדק (עדכון דירוג בלבד לא נוגע בסטטוס הסינון).
  if (c) {
    row.hidden = autoHidden;
    row.auto_hidden = autoHidden;
    row.moderation_reason = moderationReason;
  }
  const { error } = await admin.from("site_reviews").upsert(row, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: `שגיאה בשמירת הביקורת: ${error.message}` }, { status: 500 });

  return NextResponse.json({
    ok: true,
    held: autoHidden,
    message: autoHidden
      ? "הביקורת נשמרה אך לא פורסמה - היא לא עברה את הסינון האוטומטי. אם לדעתך זו טעות, פנו לצוות."
      : undefined
  });
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
