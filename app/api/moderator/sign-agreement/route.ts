import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// חתימת חבר צוות הפיקוח על הסכם התפקיד - חסימת שער חובה לפני כניסה לממשק הפיקוח.
// רק חברי צוות פיקוח בפועל (is_moderator) חותמים על זה - מנהל בפועל לא צריך.
export async function POST() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;

  if (!profile.is_moderator) {
    return NextResponse.json({ error: "הסכם זה רלוונטי רק לחברי צוות פיקוח" }, { status: 403 });
  }

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("profiles")
    .update({ moderator_agreement_signed_at: new Date().toISOString() })
    .eq("id", profile.id);

  if (error) return NextResponse.json({ error: "שגיאה בשמירת החתימה" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
