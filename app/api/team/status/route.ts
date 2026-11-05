import { NextResponse } from "next/server";
import { getCachedUser } from "@/lib/auth-cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isTeamRecruitOpen } from "@/lib/team";
import { isStaff } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

// מצב הגיוס לצוות הפיקוח עבור הגולש: האם הגיוס פתוח, האם הוא כבר צוות, והאם הגיש מועמדות (לבאנר ולעמוד ההגשה).
export async function GET() {
  const open = await isTeamRecruitOpen();
  const user = await getCachedUser();
  if (!user) return NextResponse.json({ open, loggedIn: false, isStaff: false, application: null });

  const admin = createAdminSupabase();
  const [{ data: profile }, { data: app }] = await Promise.all([
    admin.from("profiles").select("role, is_moderator").eq("id", user.id).maybeSingle(),
    admin
      .from("team_applications")
      .select("status, created_at, reviewed_at, admin_note")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  return NextResponse.json({
    open,
    loggedIn: true,
    isStaff: profile ? isStaff(profile) : false,
    application: app ? { status: app.status, createdAt: app.created_at, reviewedAt: app.reviewed_at } : null
  });
}
