import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const { endpoint } = await request.json().catch(() => ({}));
  if (!endpoint) return NextResponse.json({ error: "חסרה כתובת מנוי" }, { status: 400 });

  const admin = createAdminSupabase();
  await admin.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
