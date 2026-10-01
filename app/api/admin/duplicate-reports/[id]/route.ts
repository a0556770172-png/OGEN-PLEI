import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// טיפול בדיווח כפילות: "resolve" (טופל - למשל אחת האפליקציות הוסרה/אוחדה) או "reject" (לא כפילות).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;
  if (!isStaff(profile)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { action } = await request.json().catch(() => ({}));
  if (action !== "resolve" && action !== "reject") {
    return NextResponse.json({ error: "פעולה לא חוקית" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: report } = await admin.from("duplicate_reports").select("id, app_id").eq("id", params.id).maybeSingle();
  if (!report) return NextResponse.json({ error: "הדיווח לא נמצא" }, { status: 404 });
  const { data: app } = await admin.from("apps").select("name").eq("id", report.app_id).maybeSingle();

  const { error } = await admin
    .from("duplicate_reports")
    .update({ status: action === "resolve" ? "resolved" : "rejected", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: `שגיאה בעדכון הדיווח: ${error.message}` }, { status: 500 });

  await logAudit({
    actorId: user.id,
    action: action === "resolve" ? "resolve_duplicate_report" : "reject_duplicate_report",
    targetType: "duplicate_report",
    targetId: params.id,
    targetLabel: app?.name ?? null,
    undoable: false
  });

  return NextResponse.json({ ok: true });
}
