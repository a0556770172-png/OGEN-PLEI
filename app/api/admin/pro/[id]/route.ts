import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;
  if (profile.role !== "admin") return NextResponse.json({ error: "רק מנהל יכול לאשר שדרוג PRO" }, { status: 403 });

  const { action, adminMessage } = await request.json();
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "פעולה לא חוקית" }, { status: 400 });
  }
  const admin = createAdminSupabase();

  const { data: reqRow } = await admin.from("pro_requests").select("*").eq("id", params.id).single();
  if (!reqRow) return NextResponse.json({ error: "בקשה לא נמצאה" }, { status: 404 });

  const status = action === "approve" ? "approved" : "rejected";
  await admin
    .from("pro_requests")
    .update({
      status,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      admin_message: typeof adminMessage === "string" && adminMessage.trim() ? adminMessage.trim() : null
    })
    .eq("id", params.id);
  await admin.from("profiles").update({
    pro_status: status,
    is_pro: action === "approve" ? true : false
  }).eq("id", reqRow.developer_id);

  const { data: dev } = await admin.from("profiles").select("username, pro_status, is_pro").eq("id", reqRow.developer_id).single();
  await logAudit({
    actorId: user.id,
    action: action === "approve" ? "approve_pro" : "reject_pro",
    targetType: "pro_request",
    targetId: params.id,
    targetLabel: dev?.username ?? null,
    meta: { developerId: reqRow.developer_id },
    undoable: true
  });

  return NextResponse.json({ ok: true });
}
