import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/push";

const UUID_IN_APP_URL = /\/apps\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

// "דווח על כפילות" - משתמש מחובר מדווח שראה עוד אפליקציה זהה / שעושה את אותה פעולה.
// קישור לאפליקציה השנייה הוא חובה. הדיווח נשלח ללשונית "כפילויות" של הצוות.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const { otherUrl, note } = await request.json().catch(() => ({}));
  const url = typeof otherUrl === "string" ? otherUrl.trim() : "";
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    parsed = null;
  }
  if (!parsed || !["http:", "https:"].includes(parsed.protocol) || url.length > 500) {
    return NextResponse.json({ error: "יש להדביק קישור תקין לאפליקציה השנייה (מתחיל ב-https://)" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: app } = await admin.from("apps").select("id, name").eq("id", params.id).single();
  if (!app) return NextResponse.json({ error: "האפליקציה לא נמצאה" }, { status: 404 });

  // קישור לאפליקציה בעוגן פליי עצמו - מזהים אותה, כדי שהצוות יראה ישר את שתיהן זו מול זו.
  let otherAppId: string | null = null;
  const m = parsed.pathname.match(UUID_IN_APP_URL);
  if (m) {
    const otherId = m[1].toLowerCase();
    if (otherId === app.id) {
      return NextResponse.json({ error: "הקישור מוביל לאותה אפליקציה עצמה - יש להדביק קישור לאפליקציה השנייה" }, { status: 400 });
    }
    const { data: other } = await admin.from("apps").select("id").eq("id", otherId).maybeSingle();
    otherAppId = other?.id ?? null;
  }

  const row = {
    app_id: app.id,
    reported_by: user.id,
    other_url: url,
    other_app_id: otherAppId,
    note: typeof note === "string" && note.trim() ? note.trim().slice(0, 500) : null
  };

  // משתמש שכבר דיווח על האפליקציה הזו ועוד ממתין - מעדכנים את הדיווח הקיים במקום כפילות בתור.
  const { data: existing } = await admin
    .from("duplicate_reports")
    .select("id")
    .eq("app_id", app.id)
    .eq("reported_by", user.id)
    .eq("status", "pending")
    .maybeSingle();
  const { error } = existing
    ? await admin.from("duplicate_reports").update(row).eq("id", existing.id)
    : await admin.from("duplicate_reports").insert(row);
  if (error) {
    return NextResponse.json({ error: `שליחת הדיווח נכשלה: ${error.message}` }, { status: 500 });
  }

  if (!isStaff(profile)) {
    notifyAdmins({ title: "דיווח כפילות חדש", body: `${profile.username} דיווח על כפילות של "${app.name}"`, url: "/dashboard/admin" }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
