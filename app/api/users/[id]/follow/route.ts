import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// מעקב / ביטול מעקב אחרי משתמש (toggle).
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  if (params.id === user.id) return NextResponse.json({ error: "אי אפשר לעקוב אחרי עצמך" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: target } = await admin.from("profiles").select("id").eq("id", params.id).maybeSingle();
  if (!target) return NextResponse.json({ error: "המשתמש לא נמצא" }, { status: 404 });

  const { data: existing } = await admin
    .from("user_follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", params.id)
    .maybeSingle();

  if (existing) {
    await admin.from("user_follows").delete().eq("follower_id", user.id).eq("following_id", params.id);
    return NextResponse.json({ ok: true, following: false });
  }

  await admin.from("user_follows").insert({ follower_id: user.id, following_id: params.id });
  return NextResponse.json({ ok: true, following: true });
}
