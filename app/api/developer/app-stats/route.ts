import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// סטטיסטיקות מפורטות לאפליקציה אחת: הורדות לפי גרסה, לפי יום (30 יום), משתמשים ייחודיים,
// לייקים וביקורות, והיסטוריית גרסאות. רק הבעלים של האפליקציה (או צוות).
// ההורדות של המפתח עצמו (בדיקות) לא נספרות כאן.
export async function GET(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const appId = new URL(request.url).searchParams.get("appId");
  if (!appId) return NextResponse.json({ error: "חסר מזהה אפליקציה" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: app } = await admin
    .from("apps")
    .select("id, name, version, status, developer_id, downloads_count, created_at, published_at, last_updated_at")
    .eq("id", appId)
    .single();
  if (!app) return NextResponse.json({ error: "האפליקציה לא נמצאה" }, { status: 404 });
  if (app.developer_id !== user.id && !isStaff(profile)) {
    return NextResponse.json({ error: "אין הרשאה לאפליקציה הזו" }, { status: 403 });
  }

  const [{ data: stats, error: statsErr }, { count: likes }, { count: reviews }, { data: proposals }] = await Promise.all([
    admin.rpc("app_download_stats", { p_app_id: app.id, p_exclude_user: app.developer_id }),
    admin.from("app_likes").select("id", { count: "exact", head: true }).eq("app_id", app.id),
    admin.from("app_reviews").select("id", { count: "exact", head: true }).eq("app_id", app.id),
    admin
      .from("app_version_proposals")
      .select("version, reviewed_at")
      .eq("app_id", app.id)
      .eq("status", "approved")
      .order("reviewed_at", { ascending: true })
  ]);

  if (statsErr) {
    return NextResponse.json({ error: `שגיאה בשליפת הנתונים: ${statsErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    app: {
      id: app.id,
      name: app.name,
      version: app.version,
      downloadsCount: app.downloads_count,
      createdAt: app.created_at,
      publishedAt: app.published_at ?? null,
      lastUpdatedAt: app.last_updated_at ?? null
    },
    stats,
    likes: likes ?? 0,
    reviews: reviews ?? 0,
    releases: (proposals ?? []).map((p: any) => ({ version: p.version, at: p.reviewed_at }))
  });
}
