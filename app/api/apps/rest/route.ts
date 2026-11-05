import { NextResponse } from "next/server";
import { getApprovedAppsLite, getIconUrl, slimForCard } from "@/lib/apps-data";

export const dynamic = "force-dynamic";

// שאר הכרטיסים של עמוד הבית (אחרי ה-INITIAL_CARDS הראשונים שנשלחים בדף עצמו). זהה לכל הגולשים,
// ולכן אפשר לשמור אותו כמה שניות (גם ב-nginx).
export async function GET(request: Request) {
  const skip = Math.max(0, parseInt(new URL(request.url).searchParams.get("skip") ?? "0", 10) || 0);
  const apps = await getApprovedAppsLite();
  const items = await Promise.all(
    apps.slice(skip).map(async (app) => ({ app: slimForCard(app), iconUrl: await getIconUrl(app.icon_key) }))
  );
  return NextResponse.json({ items }, { headers: { "Cache-Control": "public, max-age=15" } });
}
