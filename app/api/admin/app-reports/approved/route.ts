import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// רשימת דיווחים שכבר אושרו (גלויים לציבור בעמוד האפליקציה) - כדי שצוות הפיקוח/מנהל
// יוכל למחוק אותם או להחזיר אותם למצב פרטי (revert) אם התברר שהם לא היו צריכים להתפרסם.
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;
  if (!isStaff(profile)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data: reports, error } = await admin
    .from("app_reports")
    .select("id, app_id, reported_by, reason, reviewed_at")
    .eq("status", "approved")
    .order("reviewed_at", { ascending: false });

  if (error) return NextResponse.json({ error: `שגיאה בשליפת הדיווחים: ${error.message}` }, { status: 500 });

  const rows = reports ?? [];
  const appIds = [...new Set(rows.map((r) => r.app_id))];
  const reporterIds = [...new Set(rows.map((r) => r.reported_by))];

  const [{ data: apps }, { data: reporters }] = await Promise.all([
    appIds.length ? admin.from("apps").select("id, name").in("id", appIds) : Promise.resolve({ data: [] as any[] }),
    reporterIds.length ? admin.from("profiles").select("id, username").in("id", reporterIds) : Promise.resolve({ data: [] as any[] })
  ]);
  const appMap = new Map((apps ?? []).map((a) => [a.id, a]));
  const reporterMap = new Map((reporters ?? []).map((p) => [p.id, p]));

  const enriched = rows.map((r) => ({
    ...r,
    app: appMap.get(r.app_id) ?? null,
    reporter: reporterMap.get(r.reported_by) ?? null
  }));

  return NextResponse.json({ reports: enriched });
}
