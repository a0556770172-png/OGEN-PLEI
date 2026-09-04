import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// לייק/ביטול לייק על ביקורת אתר (toggle).
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const admin = createAdminSupabase();
  const { data: review } = await admin.from("site_reviews").select("id").eq("id", params.id).maybeSingle();
  if (!review) return NextResponse.json({ error: "הביקורת לא נמצאה" }, { status: 404 });

  const { data: existing } = await admin
    .from("site_review_likes")
    .select("id")
    .eq("review_id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await admin.from("site_review_likes").delete().eq("id", existing.id);
    return NextResponse.json({ ok: true, liked: false });
  }
  await admin.from("site_review_likes").insert({ review_id: params.id, user_id: user.id });
  return NextResponse.json({ ok: true, liked: true });
}
