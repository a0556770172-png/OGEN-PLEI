import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// רשימת כל ערעורי החסימה - צוות (מנהל/פיקוח) בלבד. אותו צוות שיכול לחסום משתמשים
// (ראו app/api/admin/users/[id]/route.ts, action "ban") יכול גם לראות ולהגיב לערעורים.
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;
  if (!isStaff(profile)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data: appeals } = await admin
    .from("ban_appeals")
    .select("*, user:profiles!ban_appeals_user_id_fkey(*)")
    .order("updated_at", { ascending: false });

  return NextResponse.json({ appeals: appeals ?? [] });
}
