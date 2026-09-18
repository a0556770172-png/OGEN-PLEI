import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// עדכון הגדרות האתר הגלובליות - מנהל בלבד
export async function PATCH(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;

  if (profile.role !== "admin") {
    return NextResponse.json({ error: "רק מנהל יכול לשנות הגדרות אתר" }, { status: 403 });
  }

  const { requireEmailVerification, forumButtonVisible } = await request.json().catch(() => ({}));
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (typeof requireEmailVerification === "boolean") patch.require_email_verification = requireEmailVerification;
  if (typeof forumButtonVisible === "boolean") patch.forum_button_visible = forumButtonVisible;
  if (!("require_email_verification" in patch) && !("forum_button_visible" in patch)) {
    return NextResponse.json({ error: "ערך לא תקין" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("site_settings")
    .update(patch)
    .eq("id", true);

  if (error) return NextResponse.json({ error: "שגיאה בעדכון ההגדרות" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
