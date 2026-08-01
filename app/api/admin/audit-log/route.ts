import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// רשימת כל פעולות הניהול/פיקוח - מנהל בפועל בלבד. מציג מי עשה מה, למי/מה, ומתי,
// כדי שהמנהל יוכל לפקח על צוות הפיקוח.
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;
  if (profile.role !== "admin") return NextResponse.json({ error: "רק מנהל בפועל יכול לצפות בלוג הביקורת" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data } = await admin
    .from("audit_log")
    .select("*, actor:profiles!audit_log_actor_id_fkey(username)")
    .order("created_at", { ascending: false })
    .limit(300);

  return NextResponse.json({ items: data ?? [] });
}
