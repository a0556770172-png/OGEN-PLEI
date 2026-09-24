import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

// מונה קליקים על הפרסומת (גם ההורדה-ביניים וגם הבאדג' הצף) - לא קריטי, נכשל בשקט.
export async function POST() {
  const admin = createAdminSupabase();
  try {
    const { data } = await admin.from("site_ad_config").select("click_count").eq("id", true).maybeSingle();
    await admin
      .from("site_ad_config")
      .update({ click_count: (data?.click_count ?? 0) + 1 })
      .eq("id", true);
  } catch {
    // ignore
  }
  return NextResponse.json({ ok: true });
}
