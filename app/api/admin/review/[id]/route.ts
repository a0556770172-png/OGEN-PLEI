import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { notifyForApprovedApp } from "@/lib/notifications";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  if (!isStaff(profile)) {
    return NextResponse.json({ error: "רק צוות ניהול/פיקוח יכול לבצע פעולה זו" }, { status: 403 });
  }

  const { action, note } = await request.json();
  const admin = createAdminSupabase();

  const validActions: Record<string, string> = {
    approve: "approved",
    reject: "rejected",
    archive: "archived",
    restore: "pending"
  };
  const newStatus = validActions[action];
  if (!newStatus) return NextResponse.json({ error: "פעולה לא חוקית" }, { status: 400 });

  const { data: app } = await admin.from("apps").select("*").eq("id", params.id).single();
  if (!app) return NextResponse.json({ error: "האפליקציה לא נמצאה" }, { status: 404 });

  await admin
    .from("apps")
    .update({
      status: newStatus,
      review_note: note ?? null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", params.id);

  // אפליקציה שאושרה (חדשה או גרסה חדשה) - שולחים התראות למנויים.
  if (action === "approve" && app.status !== "approved") {
    try {
      await notifyForApprovedApp(params.id);
    } catch {
      // התראות לא אמורות להכשיל את האישור
    }
  }

  if (action === "approve" || action === "reject") {
    await logAudit({
      actorId: user.id,
      action: action === "approve" ? "approve_app" : "reject_app",
      targetType: "app",
      targetId: params.id,
      targetLabel: app.name,
      meta: { previousStatus: app.status, note: note ?? null },
      undoable: true
    });
  }

  // חשוב: דף הבית (וכל דף שמציג את רשימת האפליקציות/פרטי האפליקציה) הוא force-dynamic,
  // כלומר תמיד שולף נתונים טריים בבקשה חדשה מהשרת - אבל דפדפן שמנווט אליו בניווט צד-לקוח
  // (קליק על לינק בתוך האתר, לא רענון מלא) עלול לקבל עותק שמור מה-Router Cache הפנימי של
  // Next.js למשך עד כ-30 שניות. זה בדיוק הגורם לבאג שדווח: "אישרתי והאפליקציה לא מופיעה
  // בחנות/בפרופיל הציבורי" - היא בעצם כן אושרה, רק שהדף שהוצג היה גרסה ישנה שנשמרה מקומית.
  // revalidatePath מנקה את זה באופן יזום ברגע האישור. באג ספציפי שתוקן כאן: הפרופיל הציבורי
  // (/users/[id]) לא היה ברשימת הנתיבים שמתנקים - רק "/users" (רשימת המשתמשים הכללית).
  revalidatePath("/");
  revalidatePath(`/apps/${params.id}`);
  revalidatePath("/users");
  revalidatePath(`/users/${app.developer_id}`);

  return NextResponse.json({ ok: true });
}
