import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  if (profile.role !== "developer") {
    return NextResponse.json({ error: "רק חשבון מפתח יכול לבקש שדרוג" }, { status: 403 });
  }
  if (profile.is_pro) {
    return NextResponse.json({ error: "כבר יש לך חשבון PRO" }, { status: 400 });
  }
  if (profile.pro_status === "requested") {
    return NextResponse.json({ error: "כבר קיימת בקשה ממתינה" }, { status: 400 });
  }

  const { message } = await request.json().catch(() => ({ message: "" }));
  const admin = createAdminSupabase();

  await admin.from("pro_requests").insert({ developer_id: user.id, message: message || null, status: "pending" });
  await admin.from("profiles").update({ pro_status: "requested" }).eq("id", user.id);

  return NextResponse.json({ ok: true });
}
