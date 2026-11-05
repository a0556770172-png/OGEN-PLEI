import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { notifyUsers } from "@/lib/notifications";
import { memoInvalidate } from "@/lib/memo";
import { isTeamRecruitOpen } from "@/lib/team";

export const dynamic = "force-dynamic";

const STATUSES = ["pending", "interview", "approved", "rejected"] as const;

async function adminOnly() {
  const result = await requireProfile();
  if ("error" in result) return { res: NextResponse.json({ error: result.error }, { status: result.status }) };
  if (result.profile.role !== "admin") return { res: NextResponse.json({ error: "רק מנהל בפועל" }, { status: 403 }) };
  return { ok: result };
}

// רשימת המועמדויות (החדשות קודם) + האם הגיוס פתוח.
export async function GET() {
  const a = await adminOnly();
  if (a.res) return a.res;
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("team_applications")
    .select("id, user_id, answers, status, admin_note, reviewed_at, created_at, user:profiles!team_applications_user_id_fkey(username, email, points, is_moderator, created_at)")
    .order("created_at", { ascending: false })
    .limit(300);
  return NextResponse.json({ applications: data ?? [], open: await isTeamRecruitOpen() });
}

// עדכון סטטוס/הערה של מועמדות. מתריעים למועמד על שינוי סטטוס.
export async function PATCH(request: Request) {
  const a = await adminOnly();
  if (a.res) return a.res;
  const { id, status, note } = await request.json().catch(() => ({}));
  if (typeof id !== "string") return NextResponse.json({ error: "חסר מזהה" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: app } = await admin.from("team_applications").select("id, user_id, status").eq("id", id).maybeSingle();
  if (!app) return NextResponse.json({ error: "המועמדות לא נמצאה" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (typeof note === "string") patch.admin_note = note.trim().slice(0, 1000) || null;
  const statusChanged = typeof status === "string" && status !== app.status;
  if (typeof status === "string") {
    if (!(STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: "סטטוס לא תקין" }, { status: 400 });
    patch.status = status;
    patch.reviewed_by = a.ok!.user.id;
    patch.reviewed_at = new Date().toISOString();
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "אין מה לעדכן" }, { status: 400 });

  const { error } = await admin.from("team_applications").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: `שגיאה: ${error.message}` }, { status: 500 });

  if (statusChanged) {
    const msgs: Record<string, { title: string; body: string }> = {
      interview: { title: "המועמדות שלך לצוות הפיקוח התקדמה", body: "נשמח לשוחח איתך - נפנה אליך בהקדם" },
      approved: { title: "ברוך הבא לצוות הפיקוח! 🎉", body: "המועמדות שלך אושרה. פרטים נוספים יישלחו אליך" },
      rejected: { title: "לגבי המועמדות לצוות הפיקוח", body: "תודה על ההתעניינות. כרגע לא נוכל לקבל אותך, ואפשר להגיש שוב בעתיד" },
      pending: { title: "", body: "" }
    };
    const m = msgs[status as string];
    if (m?.title) await notifyUsers([app.user_id], { kind: "team_application", title: m.title, body: m.body, url: "/join-team" }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}

// פתיחה/סגירה של הגיוס (מסתיר את הבאנר וחוסם הגשות חדשות).
export async function PUT(request: Request) {
  const a = await adminOnly();
  if (a.res) return a.res;
  const { open } = await request.json().catch(() => ({}));
  if (typeof open !== "boolean") return NextResponse.json({ error: "ערך לא תקין" }, { status: 400 });
  const admin = createAdminSupabase();
  const { error } = await admin.from("site_settings").update({ team_recruit_open: open }).eq("id", true);
  if (error) return NextResponse.json({ error: `שגיאה: ${error.message}` }, { status: 500 });
  memoInvalidate("team-recruit-open");
  return NextResponse.json({ ok: true, open });
}
