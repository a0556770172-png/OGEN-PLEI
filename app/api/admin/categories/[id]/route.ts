import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;
  if (profile.role !== "admin") return NextResponse.json({ error: "רק מנהל יכול לנהל קטגוריות" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) return NextResponse.json({ error: "יש להזין שם קטגוריה" }, { status: 400 });

  const admin = createAdminSupabase();
  // משנים רק את השם המוצג (label) - את ה-value (המזהה הפנימי) לא נוגעים בו, כדי לא
  // "לייתם" אפליקציות שכבר משויכות לקטגוריה הזו לפי המזהה הישן.
  const { data, error } = await admin
    .from("categories")
    .update({ label })
    .eq("id", params.id)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message || "הקטגוריה לא נמצאה" }, { status: 400 });
  return NextResponse.json({ category: data });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;
  if (profile.role !== "admin") return NextResponse.json({ error: "רק מנהל יכול לנהל קטגוריות" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data: category } = await admin.from("categories").select("*").eq("id", params.id).single();
  if (!category) return NextResponse.json({ error: "הקטגוריה לא נמצאה" }, { status: 404 });

  const { count } = await admin
    .from("apps")
    .select("id", { count: "exact", head: true })
    .eq("category", category.value);

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `אי אפשר למחוק - יש ${count} אפליקציות המשויכות לקטגוריה "${category.label}". שנו קודם את הקטגוריה שלהן.` },
      { status: 400 }
    );
  }

  const { error } = await admin.from("categories").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
