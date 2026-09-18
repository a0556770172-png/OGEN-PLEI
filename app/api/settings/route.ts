import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// נתיב ציבורי - נדרש כדי שדף הכניסה (קליינט) ידע האם אימות מייל חובה כרגע
export async function GET() {
  const admin = createAdminSupabase();
  const { data } = await admin.from("site_settings").select("require_email_verification, forum_button_visible").eq("id", true).single();
  return NextResponse.json({
    requireEmailVerification: data?.require_email_verification ?? false,
    forumButtonVisible: data?.forum_button_visible ?? false
  });
}
