import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

const MAX_FREE_PAUSE_DAYS = 3;

// המפתח (או צוות) יכול להשהות זמנית את ההורדה של אפליקציה שלו.
// חשבון רגיל: מוגבל עד 3 ימים. חשבון PRO: יכול גם להשהות ללא הגבלת זמן (עד ביטול ידני).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const admin = createAdminSupabase();
  const { data: app } = await admin.from("apps").select("*").eq("id", params.id).single();
  if (!app) return NextResponse.json({ error: "האפליקציה לא נמצאה" }, { status: 404 });

  const isOwner = app.developer_id === user.id;
  if (!isOwner && !isStaff(profile)) {
    return NextResponse.json({ error: "אין הרשאה לאפליקציה זו" }, { status: 403 });
  }

  const { action, days } = await request.json().catch(() => ({}));

  if (action === "unpause") {
    const { error } = await admin
      .from("apps")
      .update({ download_paused: false, download_paused_until: null })
      .eq("id", app.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidatePath(`/apps/${app.id}`);
    return NextResponse.json({ ok: true });
  }

  if (action === "pause") {
    // אפשרות "ללא הגבלת זמן" מותרת רק לחשבון PRO (או מנהל/צוות)
    if (days === undefined || days === null) {
      if (!profile.is_pro && profile.role !== "admin") {
        return NextResponse.json({ error: `חשבון רגיל יכול להשהות הורדה לעד ${MAX_FREE_PAUSE_DAYS} ימים בלבד. שדרוג ל-PRO מאפשר השהיה ללא הגבלת זמן.` }, { status: 403 });
      }
      const { error } = await admin
        .from("apps")
        .update({ download_paused: true, download_paused_until: null })
        .eq("id", app.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      revalidatePath(`/apps/${app.id}`);
      return NextResponse.json({ ok: true });
    }

    const numDays = Number(days);
    if (!Number.isFinite(numDays) || numDays <= 0) {
      return NextResponse.json({ error: "מספר ימים לא חוקי" }, { status: 400 });
    }
    if (!profile.is_pro && profile.role !== "admin" && numDays > MAX_FREE_PAUSE_DAYS) {
      return NextResponse.json({ error: `חשבון רגיל יכול להשהות הורדה לעד ${MAX_FREE_PAUSE_DAYS} ימים בלבד. שדרוג ל-PRO מסיר את ההגבלה.` }, { status: 403 });
    }

    const until = new Date(Date.now() + numDays * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await admin
      .from("apps")
      .update({ download_paused: false, download_paused_until: until })
      .eq("id", app.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidatePath(`/apps/${app.id}`);
    return NextResponse.json({ ok: true, until });
  }

  return NextResponse.json({ error: "פעולה לא חוקית" }, { status: 400 });
}
