import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;
  if (!isStaff(profile)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("council_thread_reads")
    .upsert({ user_id: user.id, thread_id: params.id, last_read_at: new Date().toISOString() }, { onConflict: "user_id,thread_id" });
  if (error) return NextResponse.json({ error: "עדכון הקריאה נכשל" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
