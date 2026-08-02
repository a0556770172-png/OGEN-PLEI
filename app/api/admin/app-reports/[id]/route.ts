import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// אישור/דחייה של דיווח - צוות פיקוח/מנהל. אישור הופך אותו לגלוי לכל המשתמשים בעמוד
// האפליקציה (ראו GET הציבורי ב-app/api/apps/[id]/reports/route.ts).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;
  if (!isStaff(profile)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { action } = await request.json().catch(() => ({}));
  // "revert" - מחזיר דיווח שכבר אושר (גלוי לציבור) בחזרה למצב "ממתין" (פרטי, לא מוצג
  // יותר בעמוד האפליקציה) - בלי למחוק אותו, כך שאפשר לאשר אותו שוב בעתיד אם צריך.
  const validActions = ["approve", "reject", "revert"];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: "פעולה לא חוקית" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  // תוקן: היה כאן select עם relation מקוננת (app:apps(name)) בלי בדיקת error - אם הצירוף
  // נכשל, report היה יוצא null וכל בקשת אישור/דחייה הייתה מקבלת "הדיווח לא נמצא" בטעות,
  // גם כשהדיווח קיים בפועל. עכשיו שתי שליפות נפרדות פשוטות.
  const { data: report, error: fetchError } = await admin.from("app_reports").select("*").eq("id", params.id).single();
  if (fetchError || !report) return NextResponse.json({ error: "הדיווח לא נמצא" }, { status: 404 });

  const { data: app } = await admin.from("apps").select("id, name").eq("id", report.app_id).maybeSingle();

  const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "pending";
  const { error: updateError } = await admin
    .from("app_reports")
    .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", params.id);
  if (updateError) return NextResponse.json({ error: `שגיאה בעדכון הדיווח: ${updateError.message}` }, { status: 500 });

  if (action === "approve" || action === "reject") {
    await logAudit({
      actorId: user.id,
      action: action === "approve" ? "approve_app_report" : "reject_app_report",
      targetType: "app_report",
      targetId: params.id,
      targetLabel: app?.name ?? null,
      undoable: false
    });
  }

  if (app?.id) revalidatePath(`/apps/${app.id}`);

  return NextResponse.json({ ok: true });
}

// מחיקה מוחלטת של דיווח (כל סטטוס) - צוות פיקוח/מנהל. לא ניתנת לביטול.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;
  if (!isStaff(profile)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data: report } = await admin.from("app_reports").select("app_id").eq("id", params.id).maybeSingle();

  const { error } = await admin.from("app_reports").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: `שגיאה במחיקת הדיווח: ${error.message}` }, { status: 500 });

  if (report?.app_id) revalidatePath(`/apps/${report.app_id}`);

  return NextResponse.json({ ok: true });
}
