import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { addPoints } from "@/lib/points";

const SUGGESTION_POINTS = 5;

// אישור/דחייה של הצעת אפליקציה - צוות (מנהל/פיקוח) בלבד.
// אישור מזכה את המציע ב-5 נק' (פעם אחת בלבד, גם אם מישהו ילחץ פעמיים בטעות),
// ואם הצבירה הכוללת שלו מגיעה ל-300, הוא משודרג אוטומטית ל-PRO (ראו lib/points.ts).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  if (!isStaff(profile)) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { status } = await request.json().catch(() => ({}));
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json({ error: "סטטוס לא חוקי" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: suggestion } = await admin.from("app_suggestions").select("*").eq("id", params.id).single();
  if (!suggestion) return NextResponse.json({ error: "ההצעה לא נמצאה" }, { status: 404 });

  await admin
    .from("app_suggestions")
    .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", suggestion.id);

  if (status === "approved" && !suggestion.points_awarded) {
    await admin.from("app_suggestions").update({ points_awarded: true }).eq("id", suggestion.id);
    await admin.from("points_log").insert({
      profile_id: suggestion.suggested_by,
      delta: SUGGESTION_POINTS,
      reason: "app_suggestion_approved"
    });
    await addPoints(suggestion.suggested_by, SUGGESTION_POINTS);
  }

  return NextResponse.json({ ok: true });
}
