import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// עדכון סטטוס בקשת הסלמה (טופל / נדחה) - צוות.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isStaff(result.profile)) return NextResponse.json({ error: "רק צוות" }, { status: 403 });

  const { status } = await request.json().catch(() => ({}));
  if (!["handled", "rejected", "open"].includes(status)) {
    return NextResponse.json({ error: "סטטוס לא תקין" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("password_reset_requests")
    .update({ status, handled_by: result.user.id, handled_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: `שגיאה: ${error.message}` }, { status: 500 });

  return NextResponse.json({ ok: true });
}
