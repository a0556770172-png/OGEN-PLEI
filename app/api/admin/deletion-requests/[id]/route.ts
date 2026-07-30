import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { deleteUserCompletely } from "@/lib/user-deletion";

// אישור/דחייה של בקשת מחיקת משתמש שהוגשה ע"י צוות פיקוח - מנהל בפועל בלבד.
// אישור מבצע בפועל את המחיקה הבלתי הפיכה; דחייה רק סוגרת את הבקשה בלי לגעת במשתמש.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  if (profile.role !== "admin") {
    return NextResponse.json({ error: "רק מנהל בפועל יכול לאשר או לדחות בקשת מחיקה" }, { status: 403 });
  }

  const { action } = await request.json().catch(() => ({}));
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "פעולה לא חוקית" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: reqRow } = await admin.from("user_deletion_requests").select("*").eq("id", params.id).single();
  if (!reqRow) return NextResponse.json({ error: "הבקשה לא נמצאה" }, { status: 404 });
  if (reqRow.status !== "pending") {
    return NextResponse.json({ error: "הבקשה כבר טופלה" }, { status: 400 });
  }

  if (action === "reject") {
    await admin
      .from("user_deletion_requests")
      .update({ status: "rejected", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq("id", params.id);
    return NextResponse.json({ ok: true });
  }

  // action === "approve"
  const outcome = await deleteUserCompletely(reqRow.target_user_id);
  if ("error" in outcome) return NextResponse.json({ error: outcome.error }, { status: outcome.status });

  await admin
    .from("user_deletion_requests")
    .update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", params.id);

  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
