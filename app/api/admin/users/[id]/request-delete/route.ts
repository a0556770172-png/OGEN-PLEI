import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// צוות פיקוח מגיש כאן בקשה למחיקת משתמש - זו לא מחיקה בפועל, רק בקשה שממתינה
// לאישור מנהל. אם המבקש הוא מנהל בפועל, אין טעם בבקשה - הוא יכול למחוק ישירות
// דרך ה-DELETE הרגיל, אז חוסמים כאן כדי לא ליצור בקשות מיותרות.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;

  if (!isStaff(profile)) {
    return NextResponse.json({ error: "רק צוות יכול לבקש מחיקת משתמש" }, { status: 403 });
  }
  if (profile.role === "admin") {
    return NextResponse.json({ error: "מנהל בפועל יכול למחוק ישירות, אין צורך בבקשה" }, { status: 400 });
  }
  if (params.id === profile.id) {
    return NextResponse.json({ error: "לא ניתן לבקש מחיקה של החשבון שלך" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;

  const admin = createAdminSupabase();

  const { data: target } = await admin.from("profiles").select("id, role").eq("id", params.id).single();
  if (!target) return NextResponse.json({ error: "המשתמש לא נמצא" }, { status: 404 });
  if (target.role === "admin") return NextResponse.json({ error: "לא ניתן לבקש מחיקת חשבון מנהל" }, { status: 400 });

  const { count: existingPending } = await admin
    .from("user_deletion_requests")
    .select("id", { count: "exact", head: true })
    .eq("target_user_id", params.id)
    .eq("status", "pending");
  if ((existingPending ?? 0) > 0) {
    return NextResponse.json({ error: "כבר יש בקשת מחיקה ממתינה למשתמש הזה" }, { status: 400 });
  }

  const { error } = await admin.from("user_deletion_requests").insert({
    target_user_id: params.id,
    requested_by: profile.id,
    reason
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
