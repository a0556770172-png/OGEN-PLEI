import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createDownloadUrl, BUCKETS } from "@/lib/r2";
import { addPoints } from "@/lib/points";

export async function POST(request: Request, { params }: { params: { appId: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר כדי להוריד" }, { status: 401 });

  const admin = createAdminSupabase();

  const { data: profile } = await admin.from("profiles").select("banned").eq("id", user.id).single();
  if (profile?.banned) return NextResponse.json({ error: "החשבון שלך חסום" }, { status: 403 });

  const { data: app, error: appErr } = await admin.from("apps").select("*").eq("id", params.appId).single();
  if (appErr || !app) return NextResponse.json({ error: "האפליקציה לא נמצאה" }, { status: 404 });

  const isOwner = app.developer_id === user.id;
  let isStaffUser = false;
  if (!isOwner) {
    const { data: reqProfile } = await admin.from("profiles").select("role, is_moderator").eq("id", user.id).single();
    isStaffUser = !!reqProfile && (reqProfile.role === "admin" || !!reqProfile.is_moderator);
  }
  const isOwnerOrStaff = isOwner || isStaffUser;

  if (app.status !== "approved" && !isOwnerOrStaff) {
    return NextResponse.json({ error: "האפליקציה אינה זמינה להורדה" }, { status: 403 });
  }

  // המפתח (או צוות) יכולים להוריד גם כשההורדה מושהית, כדי לבדוק את הקובץ - זה חוסם רק הורדות של אחרים
  if (!isOwnerOrStaff) {
    const pausedIndefinitely = app.download_paused;
    const pausedUntil = app.download_paused_until ? new Date(app.download_paused_until) : null;
    const pausedTemporarily = pausedUntil && pausedUntil.getTime() > Date.now();
    if (pausedIndefinitely || pausedTemporarily) {
      return NextResponse.json({ error: "המפתח השהה זמנית את ההורדה של האפליקציה הזו. נסו שוב מאוחר יותר." }, { status: 403 });
    }
  }

  // הגבלת 15 הורדות ביום למשתמש (על כל האפליקציות יחד) - מונע זיוף נקודות ע"י הורדות
  // חוזרות ונשנות. צוות ובעלי אפליקציה על האפליקציה שלהם לא מוגבלים - הם לא מקבלים
  // נקודות מהורדה כזו ממילא (רק מהורדה של משתמשים אחרים).
  const DAILY_DOWNLOAD_LIMIT = 15;
  if (!isOwnerOrStaff) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentDownloads } = await admin
      .from("download_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since);
    if ((recentDownloads ?? 0) >= DAILY_DOWNLOAD_LIMIT) {
      return NextResponse.json(
        { error: `הגעת למכסת ${DAILY_DOWNLOAD_LIMIT} ההורדות היומית. נסו שוב מחר.` },
        { status: 429 }
      );
    }
  }

  const url = await createDownloadUrl(BUCKETS.apps, app.file_key, app.file_name);

  await admin.from("apps").update({ downloads_count: app.downloads_count + 1 }).eq("id", app.id);
  await admin.from("download_events").insert({ user_id: user.id, app_id: app.id });

  if (app.status === "approved" && !isOwnerOrStaff) {
    const POINTS_PER_DOWNLOAD = 2;
    await admin.from("points_log").insert({
      profile_id: app.developer_id,
      delta: POINTS_PER_DOWNLOAD,
      reason: "download",
      app_id: app.id
    });
    await addPoints(app.developer_id, POINTS_PER_DOWNLOAD);
  }

  return NextResponse.json({ url });
}
