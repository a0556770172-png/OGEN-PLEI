import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

// מעדכן "ביקור אחרון" של המשתמש המחובר - נקרא מה-Navbar בכל טעינת עמוד/ניווט.
// לא קריטי אם זה נכשל בשקט (לא חוסם שום דבר במסך).
export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false });

  const admin = createAdminSupabase();
  await admin.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);

  return NextResponse.json({ ok: true });
}
