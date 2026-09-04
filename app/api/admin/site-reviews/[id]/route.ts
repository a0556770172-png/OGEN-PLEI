import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// ניהול ביקורת על האתר - צוות (מנהל/פיקוח): הסתרה/הצגה או מחיקה.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isStaff(result.profile)) return NextResponse.json({ error: "רק צוות" }, { status: 403 });

  const { hidden } = await request.json().catch(() => ({}));
  const admin = createAdminSupabase();
  // כשמפרסמים ביקורת שנחסמה ע"י ה-AI - מנקים גם את הדגל האוטומטי כדי שלא תיראה כ"נחסם".
  const patch: Record<string, any> = { hidden: !!hidden };
  if (!hidden) {
    patch.auto_hidden = false;
    patch.moderation_reason = null;
  }
  const { data: before } = await admin
    .from("site_reviews")
    .select("user:profiles!site_reviews_user_id_fkey(username)")
    .eq("id", params.id)
    .maybeSingle();
  const { error } = await admin.from("site_reviews").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: `שגיאה: ${error.message}` }, { status: 500 });
  await logAudit({
    actorId: result.user.id,
    action: hidden ? "hide_site_review" : "unhide_site_review",
    targetType: "site_review",
    targetId: params.id,
    targetLabel: (before?.user as any)?.username ?? null
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isStaff(result.profile)) return NextResponse.json({ error: "רק צוות" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data: before } = await admin
    .from("site_reviews")
    .select("user:profiles!site_reviews_user_id_fkey(username)")
    .eq("id", params.id)
    .maybeSingle();
  await admin.from("site_reviews").delete().eq("id", params.id);
  await logAudit({
    actorId: result.user.id,
    action: "delete_site_review",
    targetType: "site_review",
    targetId: params.id,
    targetLabel: (before?.user as any)?.username ?? null
  });
  return NextResponse.json({ ok: true });
}
