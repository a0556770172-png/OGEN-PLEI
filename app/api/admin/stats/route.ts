import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DAYS = 30;

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// לוח סטטיסטיקה למנהל/פיקוח: כניסות לאתר, הורדות ומשתמשים חדשים לפי יום (30 הימים
// האחרונים), בנוסף לסה"כ מצטבר וטבלת האפליקציות המבוקשות ביותר.
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isStaff(result.profile)) {
    return NextResponse.json({ error: "רק צוות פיקוח או מנהל יכולים לגשת לסטטיסטיקה" }, { status: 403 });
  }

  const admin = createAdminSupabase();
  const since = new Date();
  since.setDate(since.getDate() - (DAYS - 1));
  const sinceKey = dateKey(since);

  const [
    { data: siteStats },
    { count: totalUsers },
    { count: totalApps },
    { data: downloadsSum },
    { data: dailyVisits },
    { data: downloadEvents },
    { data: newUsers },
    { data: topApps }
  ] = await Promise.all([
    admin.from("site_stats").select("total_visits").eq("id", 1).maybeSingle(),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("apps").select("id", { count: "exact", head: true }).eq("status", "approved"),
    admin.from("apps").select("downloads_count"),
    admin.from("daily_site_visits").select("stat_date, visits").gte("stat_date", sinceKey).order("stat_date", { ascending: true }),
    admin.from("download_events").select("created_at").gte("created_at", since.toISOString()),
    admin.from("profiles").select("created_at").gte("created_at", since.toISOString()),
    admin.from("apps").select("id, name, downloads_count").eq("status", "approved").order("downloads_count", { ascending: false }).limit(10)
  ]);

  const totalDownloads = (downloadsSum ?? []).reduce((sum, a: any) => sum + (a.downloads_count ?? 0), 0);

  // בונים מפה של כל יום בטווח (גם אם אין בו נתונים בכלל) כדי שהגרף לא "יקפוץ" בין ימים חסרים.
  const dayMap: Record<string, { visits: number; downloads: number; newUsers: number }> = {};
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    dayMap[dateKey(d)] = { visits: 0, downloads: 0, newUsers: 0 };
  }
  for (const row of dailyVisits ?? []) {
    if (dayMap[row.stat_date]) dayMap[row.stat_date].visits = row.visits;
  }
  for (const row of downloadEvents ?? []) {
    const k = (row.created_at as string).slice(0, 10);
    if (dayMap[k]) dayMap[k].downloads += 1;
  }
  for (const row of newUsers ?? []) {
    const k = (row.created_at as string).slice(0, 10);
    if (dayMap[k]) dayMap[k].newUsers += 1;
  }

  const daily = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  return NextResponse.json({
    totals: {
      visits: siteStats?.total_visits ?? 0,
      users: totalUsers ?? 0,
      apps: totalApps ?? 0,
      downloads: totalDownloads
    },
    daily,
    topApps: topApps ?? []
  });
}
