import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const admin = createAdminSupabase();
  const { data: thread } = await admin.from("dm_threads").select("id, user_a, user_b").eq("id", params.id).single();
  if (!thread || (thread.user_a !== user.id && thread.user_b !== user.id)) {
    return NextResponse.json({ error: "שיחה לא נמצאה" }, { status: 404 });
  }

  await admin.from("dm_thread_reads").upsert({ user_id: user.id, thread_id: params.id, last_read_at: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
