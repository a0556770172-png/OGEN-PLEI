import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  if (!isStaff(profile)) {
    return NextResponse.json({ error: "רק צוות ניהול/פיקוח יכול לבצע פעולה זו" }, { status: 403 });
  }

  const { action, note } = await request.json();
  const admin = createAdminSupabase();

  const validActions: Record<string, string> = {
    approve: "approved",
    reject: "rejected",
    archive: "archived",
    restore: "pending"
  };
  const newStatus = validActions[action];
  if (!newStatus) return NextResponse.json({ error: "פעולה לא חוקית" }, { status: 400 });

  const { data: app } = await admin.from("apps").select("*").eq("id", params.id).single();
  if (!app) return NextResponse.json({ error: "האפליקציה לא נמצאה" }, { status: 404 });

  await admin
    .from("apps")
    .update({
      status: newStatus,
      review_note: note ?? null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", params.id);

  return NextResponse.json({ ok: true });
}
