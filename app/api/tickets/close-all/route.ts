import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// סגירת כל הפניות הפתוחות בבת אחת - מנהל בפועל בלבד (לא צוות פיקוח).
export async function POST() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.profile.role !== "admin") return NextResponse.json({ error: "רק מנהל בפועל" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("tickets")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("status", "open")
    .select("id");
  if (error) return NextResponse.json({ error: `שגיאה: ${error.message}` }, { status: 500 });

  const closed = data?.length ?? 0;
  if (closed > 0) {
    await logAudit({
      actorId: result.user.id,
      action: "close_all_tickets",
      targetType: "tickets",
      targetLabel: `${closed} פניות`,
      meta: { count: closed }
    });
  }

  return NextResponse.json({ ok: true, closed });
}
