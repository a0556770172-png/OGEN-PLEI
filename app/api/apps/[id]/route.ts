import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { deleteObject, createUploadUrl, BUCKETS } from "@/lib/r2";

// עריכת פרטי הפרסום (שם/תיאור/קטגוריה/אייקון) - הבעלים של האפליקציה בלבד, או צוות.
// שינוי פרטים בלבד (לא קובץ) לא מאפס את הבדיקה - זה נשאר כפי שהיה (מאושר/ממתין/וכו').
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const admin = createAdminSupabase();
  const { data: app } = await admin.from("apps").select("*").eq("id", params.id).single();
  if (!app) return NextResponse.json({ error: "האפליקציה לא נמצאה" }, { status: 404 });

  const isOwner = app.developer_id === user.id;
  if (!isOwner && !isStaff(profile)) {
    return NextResponse.json({ error: "אין הרשאה לערוך אפליקציה זו" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, shortDescription, descriptionHtml, category, iconFileName, iconContentType } = body;

  const updates: Record<string, any> = {};
  if (typeof name === "string" && name.trim()) updates.name = name.trim();
  if (typeof shortDescription === "string") updates.short_description = shortDescription;
  if (typeof descriptionHtml === "string") updates.description_html = descriptionHtml;
  if (typeof category === "string") {
    const { count } = await admin.from("categories").select("id", { count: "exact", head: true }).eq("value", category);
    if ((count ?? 0) > 0) updates.category = category;
  }

  let iconUploadUrl: string | undefined;
  let iconKey: string | undefined;
  if (iconFileName && iconContentType) {
    iconKey = `icons/${app.developer_id}/${crypto.randomUUID()}-${iconFileName.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80)}`;
    iconUploadUrl = await createUploadUrl(BUCKETS.assets, iconKey, iconContentType);
    updates.icon_key = iconKey;
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();
    const { error } = await admin.from("apps").update(updates).eq("id", app.id);
    if (error) {
      return NextResponse.json({ error: `שגיאה בעדכון האפליקציה: ${error.message}` }, { status: 500 });
    }
  }

  revalidatePath("/");
  revalidatePath(`/apps/${app.id}`);

  return NextResponse.json({ ok: true, iconUploadUrl, iconKey });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const admin = createAdminSupabase();
  const { data: app } = await admin.from("apps").select("*").eq("id", params.id).single();
  if (!app) return NextResponse.json({ error: "האפליקציה לא נמצאה" }, { status: 404 });

  const isOwner = app.developer_id === user.id;
  const canDelete = (isOwner && app.status !== "approved") || profile.role === "admin";
  if (!canDelete) return NextResponse.json({ error: "אין הרשאה למחוק אפליקציה זו" }, { status: 403 });

  await deleteObject(BUCKETS.apps, app.file_key).catch(() => {});
  if (app.icon_key) await deleteObject(BUCKETS.assets, app.icon_key).catch(() => {});
  await admin.from("apps").delete().eq("id", app.id);

  revalidatePath("/");
  revalidatePath(`/apps/${app.id}`);

  return NextResponse.json({ ok: true });
}
