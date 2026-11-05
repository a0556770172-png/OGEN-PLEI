import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { deleteObject, createUploadUrl, BUCKETS } from "@/lib/r2";
import { logAudit } from "@/lib/audit";
import { sanitizeUserHtml } from "@/lib/sanitizeHtml";
import { isImagesBanned, IMAGES_BANNED_MESSAGE } from "@/lib/imageBan";
import { validateVideoRequest, isValidVideoKey } from "@/lib/media";

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

  if (isImagesBanned(profile) && ((iconFileName && iconContentType) || Array.isArray(body.screenshotUploadRequests) || body.videoUploadRequest)) {
    return NextResponse.json({ error: IMAGES_BANNED_MESSAGE }, { status: 403 });
  }

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

  // שיוך ידני לאנדרואיד/תוכנות - צוות פיקוח ומנהל, למקרים שהסיווג האוטומטי (לפי סיומת
  // הקובץ) לא מתאים. null מחזיר לסיווג האוטומטי.
  if ("platformOverride" in body && isStaff(profile)) {
    const v = body.platformOverride;
    if (v === "apk" || v === "software" || v === null) updates.platform_override = v;
  }

  let iconUploadUrl: string | undefined;
  let iconKey: string | undefined;
  let removedIconKey: string | null = null;
  if (iconFileName && iconContentType) {
    iconKey = `icons/${app.developer_id}/${crypto.randomUUID()}-${iconFileName.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80)}`;
    iconUploadUrl = await createUploadUrl(BUCKETS.assets, iconKey, iconContentType);
    updates.icon_key = iconKey;
  } else if (body.removeIcon === true && isStaff(profile) && app.icon_key) {
    // מחיקת אייקון - צוות בלבד (טאב "תמונות")
    updates.icon_key = null;
    removedIconKey = app.icon_key;
  }

  // צילומי מסך (עד 8): שלב 1 - בקשת כתובות העלאה (לא נשמר כלום עדיין);
  // שלב 2 - שמירת הרשימה הסופית (screenshotKeys), והסרת מה שנמחק מהאחסון.
  const screenshotUploads: { key: string; uploadUrl: string }[] = [];
  const existingShots: string[] = Array.isArray(app.screenshot_keys) ? app.screenshot_keys : [];
  let removedShots: string[] = [];
  if (Array.isArray(body.screenshotUploadRequests)) {
    const room = Math.max(0, 8 - existingShots.length);
    for (const s of body.screenshotUploadRequests.slice(0, room)) {
      if (!s?.fileName || !String(s?.contentType).startsWith("image/")) continue;
      const safeName = String(s.fileName).replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
      const key = `screenshots/${app.developer_id}/${crypto.randomUUID()}-${safeName}`;
      screenshotUploads.push({ key, uploadUrl: await createUploadUrl(BUCKETS.assets, key, s.contentType) });
    }
  }
  if (Array.isArray(body.screenshotKeys)) {
    const final = Array.from(
      new Set(
        body.screenshotKeys.filter(
          (k: unknown): k is string =>
            typeof k === "string" && !k.includes("..") && (existingShots.includes(k) || k.startsWith(`screenshots/${app.developer_id}/`))
        )
      )
    ).slice(0, 8) as string[];
    updates.screenshot_keys = final;
    removedShots = existingShots.filter((k) => !final.includes(k));
  }

  // סרטון הסבר: שלב 1 - בקשת כתובת העלאה (videoUploadRequest); שלב 2 - שמירת המפתח (videoKey) או מחיקה (videoKey: null)
  let videoUpload: { key: string; uploadUrl: string } | undefined;
  let removedVideoKey: string | null = null;
  if (body.videoUploadRequest) {
    const videoErr = validateVideoRequest(body.videoUploadRequest);
    if (videoErr) return NextResponse.json({ error: videoErr }, { status: 400 });
    const vr = body.videoUploadRequest;
    const safeVideoName = String(vr.fileName).replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
    const key = `videos/${app.developer_id}/${crypto.randomUUID()}-${safeVideoName}`;
    videoUpload = { key, uploadUrl: await createUploadUrl(BUCKETS.assets, key, vr.contentType) };
  }
  if ("videoKey" in body) {
    if (body.videoKey === null) {
      if (app.video_key) {
        updates.video_key = null;
        removedVideoKey = app.video_key;
      }
    } else if (isValidVideoKey(body.videoKey, app.developer_id)) {
      updates.video_key = body.videoKey;
      if (app.video_key && app.video_key !== body.videoKey) removedVideoKey = app.video_key;
    } else {
      return NextResponse.json({ error: "מפתח סרטון לא תקין" }, { status: 400 });
    }
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();
    const { error } = await admin.from("apps").update(updates).eq("id", app.id);
    if (error) {
      return NextResponse.json({ error: `שגיאה בעדכון האפליקציה: ${error.message}` }, { status: 500 });
    }
  }

  for (const k of removedShots) await deleteObject(BUCKETS.assets, k).catch(() => {});
  if (removedIconKey) await deleteObject(BUCKETS.assets, removedIconKey).catch(() => {});
  if (removedVideoKey) await deleteObject(BUCKETS.assets, removedVideoKey).catch(() => {});

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

  if ("platform_override" in updates) {
    await logAudit({
      actorId: user.id,
      action: "change_app_platform",
      targetType: "app",
      targetId: app.id,
      targetLabel: app.name,
      meta: { from: app.platform_override, to: updates.platform_override },
      undoable: true
    });
  }

  revalidatePath("/");
  revalidatePath(`/apps/${app.id}`);
  revalidatePath(`/users/${app.developer_id}`);

  return NextResponse.json({ ok: true, iconUploadUrl, iconKey, screenshotUploads, videoUpload });
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
  for (const k of Array.isArray(app.screenshot_keys) ? app.screenshot_keys : []) await deleteObject(BUCKETS.assets, k).catch(() => {});
  if (app.video_key) await deleteObject(BUCKETS.assets, app.video_key).catch(() => {});
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
