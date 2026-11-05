import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { validateTeamAnswers, TEAM_COOLDOWN_DAYS } from "@/lib/teamQuestions";
import { isTeamRecruitOpen } from "@/lib/team";
import { notifyAdminsInApp } from "@/lib/notifications";

// הגשת מועמדות לצוות הפיקוח (משתמש מחובר, פעם אחת; אחרי דחייה אפשר להגיש שוב אחרי TEAM_COOLDOWN_DAYS ימים).
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  if (!(await isTeamRecruitOpen())) return NextResponse.json({ error: "הגיוס לצוות סגור כרגע" }, { status: 403 });
  if (isStaff(profile)) return NextResponse.json({ error: "אתה כבר חלק מהצוות" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const checked = validateTeamAnswers(body?.answers);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: last } = await admin
    .from("team_applications")
    .select("status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last) {
    if (last.status !== "rejected") {
      return NextResponse.json({ error: "כבר הגשת מועמדות - נחזור אליך בקרוב" }, { status: 409 });
    }
    const days = (Date.now() - new Date(last.created_at).getTime()) / 86_400_000;
    if (days < TEAM_COOLDOWN_DAYS) {
      return NextResponse.json({ error: `אפשר להגיש שוב רק אחרי ${TEAM_COOLDOWN_DAYS} ימים מהבקשה הקודמת` }, { status: 429 });
    }
  }

  const { error } = await admin.from("team_applications").insert({ user_id: user.id, answers: checked.answers });
  if (error) return NextResponse.json({ error: "שגיאה בשמירת הבקשה" }, { status: 500 });

  notifyAdminsInApp({
    kind: "team_application",
    title: `${profile.username} הגיש מועמדות לצוות הפיקוח`,
    body: (checked.answers.whyJoin || "").slice(0, 90),
    url: "/dashboard/admin?tab=teamApps"
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
