import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// רשימת כל הדיווחים הממתינים לטיפול - צוות פיקוח/מנהל בלבד.
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;
  if (!isStaff(profile)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data } = await admin
    .from("app_reports")
    .select("*, app:apps(id, name), reporter:profiles!app_reports_reported_by_fkey(username)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return NextResponse.json({ reports: data ?? [] });
}
