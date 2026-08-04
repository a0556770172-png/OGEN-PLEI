import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// אישור/חתימה על "חוקי האתר" - שער חובה חד-פעמי לכל חשבון (רשום או שנרשם עכשיו), ראו
// components/SiteRulesGate.tsx ו-app/site-rules/page.tsx. בניגוד להסכם צוות הפיקוח, זה
// רלוונטי לכל משתמש ולא רק לצוות.
export async function POST() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;

  const admin = createAdminSupabase();
  const { data: settings } = await admin.from("site_settings").select("site_rules_version").eq("id", true).single();

  const { error } = await admin
    .from("profiles")
    .update({
      site_rules_accepted_at: new Date().toISOString(),
      site_rules_seen_version: settings?.site_rules_version ?? 1
    })
    .eq("id", profile.id);

  if (error) return NextResponse.json({ error: "שגיאה בשמירת האישור" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
