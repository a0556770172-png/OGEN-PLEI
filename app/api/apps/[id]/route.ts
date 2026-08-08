import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { deleteObject, createUploadUrl, BUCKETS } from "@/lib/r2";
import { logAudit } from "@/lib/audit";
import { sanitizeUserHtml } from "@/lib/sanitizeHtml";

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

  // אפליקציה שמקורה בהצעה ציבורית שאושרה (לא הועלתה ישירות מהדשבורד הפרטי) לא ניתנת
  // לעריכה ע"י מי שהציע אותה - רק צוות (מנהל/פיקוח) יכול לתקן פרטים כאלה במידת הצורך.
  if (isOwner && !isStaff(profile) && app.source === "public_suggestion") {
    return NextResponse.json(
      { error: "אפליקציה שפורסמה מהצעה ציבורית אינה ניתנת לעריכה - רק אפליקציות שהעלית ישירות מהדשבורד הפרטי ניתנות לעריכה." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { name, shortDescription, descriptionHtml, category, iconFileName, iconContentType, adminNote } = body;

  const updates: Record<string, any> = {};
  if (typeof name === "string" && name.trim()) updates.name = name.trim();
  if (typeof shortDescription === "string") updates.short_description = shortDescription;
  if (typeof descriptionHtml === "string") updates.description_html = sanitizeUserHtml(descriptionHtml);
  if (typeof category === "string") {
    const { count } = await admin.from("categories").select("id", { count: "exact", head: true }).eq("value", category);
    if ((count ?? 0) > 0) updates.category = category;
  }
  // הערת צוות למפתח (למשל "חסר אייקון, נא להוסיף") - רק צוות יכול לקבוע הערה חדשה;
  // הבעלים של האפליקציה יכול רק לנקות אותה (adminNote === null) אחרי שטיפל בעניין.
  if (typeof adminNote === "string" && isStaff(profile)) {
    updates.admin_note = adminNote.trim() || null;
    updates.admin_note_at = new Date().toISOString();
  } else if (adminNote === null) {
    updates.admin_note = null;
  }

  // נעיצה/קידום (פיצ'ר 6): מנהל בפועל בלבד יכול לנעוץ אפליקציה כדי שתוצג בראש העמוד הראשי.
  if (typeof body.pinned === "boolean" && profile.role === "admin") {
    updates.pinned = body.pinned;
    updates.pinned_at = body.pinned ? new Date().toISOString() : null;
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

  if (typeof updates.category === "string" && updates.category !== app.category && isStaff(profile)) {
    await logAudit({
      actorId: user.id,
      action: "change_app_category",
      targetType: "app",
      targetId: app.id,
      targetLabel: app.name,
      meta: { from: app.category, to: updates.category },
      undoable: true
    });
  }

  if (typeof updates.pinned === "boolean") {
    await logAudit({
      actorId: user.id,
      action: updates.pinned ? "pin_app" : "unpin_app",
      targetType: "app",
      targetId: app.id,
      targetLabel: app.name,
      undoable: true
    });
  }

  revalidatePath("/");
  revalidatePath(`/apps/${app.id}`);
  revalidatePath(`/users/${app.developer_id}`);

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
  // צוות פיקוח (לא רק מנהל בפועל) יכול גם הוא למחוק אפליקציות - זה חלק מהרשאות הפיקוח הרגילות.
  const canDelete = (isOwner && app.status !== "approved") || isStaff(profile);
  if (!canDelete) return NextResponse.json({ error: "אין הרשאה למחוק אפליקציה זו" }, { status: 403 });

  await deleteObject(BUCKETS.apps, app.file_key).catch(() => {});
  if (app.icon_key) await deleteObject(BUCKETS.assets, app.icon_key).catch(() => {});
  await admin.from("apps").delete().eq("id", app.id);

  if (isStaff(profile)) {
    // מחיקה לא ניתנת לביטול (הקבצים כבר נמחקו בפועל מ-R2) - נרשמת ללוג לצורך שקיפות בלבד.
    await logAudit({
      actorId: user.id,
      action: "delete_app",
      targetType: "app",
      targetId: app.id,
      targetLabel: app.name,
      meta: { wasOwner: isOwner },
      undoable: false
    });
  }

  revalidatePath("/");
  revalidatePath(`/apps/${app.id}`);
  revalidatePath(`/users/${app.developer_id}`);

  return NextResponse.json({ ok: true });
}
