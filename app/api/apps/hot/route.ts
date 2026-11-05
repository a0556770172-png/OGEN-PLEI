import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getApprovedAppsLite } from "@/lib/apps-data";
import { memo } from "@/lib/memo";

export const dynamic = "force-dynamic";

const HOT_DAYS = 7;
const HOT_SIZE = 24;

// "החמים שלנו": האפליקציות והתוכנות עם הכי הרבה הורדות ב-7 הימים האחרונים. אם אין מספיק פעילות
// לאחרונה, משלימים עם הכי מורדות בכלל. התוצאה זהה לכל הגולשים ונשמרת דקה.
export async function GET() {
  const items = await memo("hot-apps", 60_000, async () => {
    const admin = createAdminSupabase();
    const { data } = await admin.rpc("hot_apps", { p_days: HOT_DAYS, p_limit: HOT_SIZE });
    const hot: { id: string; week: number }[] = ((data ?? []) as { app_id: string; recent: number }[]).map((r) => ({
      id: r.app_id,
      week: Number(r.recent)
    }));
    if (hot.length < HOT_SIZE) {
      const have = new Set(hot.map((h) => h.id));
      const apps = await getApprovedAppsLite();
      const fill = [...apps]
        .filter((a) => !have.has(a.id))
        .sort((a, b) => (b.downloads_count ?? 0) - (a.downloads_count ?? 0))
        .slice(0, HOT_SIZE - hot.length);
      for (const a of fill) hot.push({ id: a.id, week: 0 });
    }
    return hot;
  });
  return NextResponse.json({ items, days: HOT_DAYS }, { headers: { "Cache-Control": "public, max-age=60" } });
}
