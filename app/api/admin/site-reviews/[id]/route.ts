import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// ניהול ביקורת על האתר - צוות (מנהל/פיקוח): הסתרה/הצגה או מחיקה.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isStaff(result.profile)) return NextResponse.json({ error: "רק צוות" }, { status: 403 });

  const { hidden } = await request.json().catch(() => ({}));
  const admin = createAdminSupabase();
  const { error } = await admin.from("site_reviews").update({ hidden: !!hidden }).eq("id", params.id);
  if (error) return NextResponse.json({ error: `שגיאה: ${error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isStaff(result.profile)) return NextResponse.json({ error: "רק צוות" }, { status: 403 });

  const admin = createAdminSupabase();
  await admin.from("site_reviews").delete().eq("id", params.id);
  return NextResponse.json({ ok: true });
}
