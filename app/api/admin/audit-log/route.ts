import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// רשימת כל פעולות הניהול/פיקוח - גלוי לכל הצוות (מנהל בפועל + צוות פיקוח). מציג מי עשה
// מה, למי/מה, ומתי - שקיפות מלאה בתוך הצוות. הביטול של פעולה (undo) נשאר בסמכות מנהל
// בפועל בלבד (ראו app/api/admin/audit-log/[id]/undo/route.ts) - צוות פיקוח רואה אך לא מבטל.
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;
  if (!isStaff(profile)) return NextResponse.json({ error: "רק צוות יכול לצפות בלוג הביקורת" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data } = await admin
    .from("audit_log")
    .select("*, actor:profiles!audit_log_actor_id_fkey(username)")
    .order("created_at", { ascending: false })
    .limit(300);

  return NextResponse.json({ items: data ?? [] });
}
