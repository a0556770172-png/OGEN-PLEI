import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { deleteObject, BUCKETS } from "@/lib/r2";

// שלב 2: אחרי שהקובץ החדש עלה ל-R2 בהצלחה, מעדכנים את רשומת האפליקציה ומחזירים אותה לבדיקה מחדש -
// זו גרסה חדשה, וכל גרסה חדשה (בדיוק כמו אפליקציה חדשה) עוברת בדיקה ידנית לפני שהיא מתפרסמת.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const admin = createAdminSupabase();
  const { data: app } = await admin.from("apps").select("*").eq("id", params.id).single();
  if (!app) return NextResponse.json({ error: "האפליקציה לא נמצאה" }, { status: 404 });
  if (app.developer_id !== user.id) {
    return NextResponse.json({ error: "אין הרשאה לאפליקציה זו" }, { status: 403 });
  }

  const { fileKey, fileName, fileSize, version } = await request.json().catch(() => ({}));
  if (!fileKey || !fileName || !fileSize) {
    return NextResponse.json({ error: "חסרים פרטי קובץ" }, { status: 400 });
  }

  const previousFileKey = app.file_key as string;

  const { error } = await admin
    .from("apps")
    .update({
      file_key: fileKey,
      file_name: fileName,
      file_size_bytes: fileSize,
      version: version?.trim() || app.version,
      status: "pending",
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", app.id);

  if (error) {
    return NextResponse.json({ error: `שגיאה בשמירת הגרסה החדשה: ${error.message}` }, { status: 500 });
  }

  // מנקים את קובץ הגרסה הקודמת מהאחסון כדי לא לצבור קבצים מיותרים (לא קריטי אם נכשל)
  if (previousFileKey && previousFileKey !== fileKey) {
    await deleteObject(BUCKETS.apps, previousFileKey).catch(() => {});
  }

  revalidatePath("/");
  revalidatePath(`/apps/${app.id}`);

  return NextResponse.json({ ok: true });
}
