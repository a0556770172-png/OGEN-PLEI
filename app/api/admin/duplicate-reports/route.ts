import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// לשונית "כפילויות" - דיווחי כפילות ממתינים (צוות פיקוח/מנהל בלבד).
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isStaff(result.profile)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data: reports, error } = await admin
    .from("duplicate_reports")
    .select("id, app_id, other_app_id, other_url, note, reported_by, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: `שגיאה בשליפת הדיווחים: ${error.message}` }, { status: 500 });

  const rows = reports ?? [];
  const appIds = [...new Set(rows.flatMap((r) => [r.app_id, r.other_app_id]).filter(Boolean))] as string[];
  const reporterIds = [...new Set(rows.map((r) => r.reported_by))];
  const [{ data: apps }, { data: reporters }] = await Promise.all([
    appIds.length
      ? admin.from("apps").select("id, name, version, status, source, downloads_count, created_at").in("id", appIds)
      : Promise.resolve({ data: [] as any[] }),
    reporterIds.length ? admin.from("profiles").select("id, username").in("id", reporterIds) : Promise.resolve({ data: [] as any[] })
  ]);
  const appMap = new Map((apps ?? []).map((a: any) => [a.id, a]));
  const reporterMap = new Map((reporters ?? []).map((p: any) => [p.id, p]));

  return NextResponse.json({
    reports: rows.map((r) => ({
      ...r,
      app: appMap.get(r.app_id) ?? null,
      otherApp: r.other_app_id ? appMap.get(r.other_app_id) ?? null : null,
      reporter: reporterMap.get(r.reported_by) ?? null
    }))
  });
}
