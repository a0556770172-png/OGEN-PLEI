import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;
  if (profile.role !== "admin") return NextResponse.json({ error: "רק מנהל יכול לאשר שדרוג PRO" }, { status: 403 });

  const { action, adminMessage } = await request.json();
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

  return NextResponse.json({ ok: true });
}
