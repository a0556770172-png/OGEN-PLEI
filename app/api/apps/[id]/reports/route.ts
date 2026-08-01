import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/push";

// GET: דיווחים מאושרים על האפליקציה - ציבורי (יוצג לכל המשתמשים בעמוד האפליקציה).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("app_reports")
    .select("id, reason, created_at, reviewed_at")
    .eq("app_id", params.id)
    .eq("status", "approved")
    .order("reviewed_at", { ascending: false });
  return NextResponse.json({ reports: data ?? [] });
}

// POST: משתמש מחובר מדווח על בעיה באפליקציה - נשמר כ"ממתין" עד שצוות פיקוח/מנהל יאשר אותו.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const { reason } = await request.json().catch(() => ({}));
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "יש לפרט את סיבת הדיווח" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: app } = await admin.from("apps").select("id, name").eq("id", params.id).single();
  if (!app) return NextResponse.json({ error: "האפליקציה לא נמצאה" }, { status: 404 });

  const { error } = await admin.from("app_reports").insert({
    app_id: params.id,
    reported_by: user.id,
    reason: reason.trim().slice(0, 500)
  });
  if (error) return NextResponse.json({ error: "שליחת הדיווח נכשלה" }, { status: 500 });

  const staff = isStaff(profile);
  if (!staff) {
    notifyAdmins({ title: "דיווח חדש על אפליקציה", body: `${profile.username} דיווח על "${app.name}"`, url: "/dashboard/admin" }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
