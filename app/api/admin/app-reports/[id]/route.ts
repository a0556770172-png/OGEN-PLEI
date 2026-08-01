import { NextResponse } from "next/server";
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
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "פעולה לא חוקית" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: report } = await admin.from("app_reports").select("*, app:apps(name)").eq("id", params.id).single();
  if (!report) return NextResponse.json({ error: "הדיווח לא נמצא" }, { status: 404 });

  const status = action === "approve" ? "approved" : "rejected";
  await admin.from("app_reports").update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", params.id);

  await logAudit({
    actorId: user.id,
    action: action === "approve" ? "approve_app_report" : "reject_app_report",
    targetType: "app_report",
    targetId: params.id,
    targetLabel: (report as any).app?.name ?? null,
    undoable: false
  });

  return NextResponse.json({ ok: true });
}
