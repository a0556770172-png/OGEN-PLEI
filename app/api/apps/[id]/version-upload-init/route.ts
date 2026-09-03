import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createUploadUrl, BUCKETS } from "@/lib/r2";
import { LIMITS } from "@/lib/constants";
import { effectiveMaxUploadMb } from "@/lib/uploadQuota";

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
}

// שלב 1 בהעלאת גרסה חדשה לאפליקציה קיימת: מייצר קישור חתום להעלאת קובץ ה-APK החדש.
// בניגוד ל-upload-init הרגיל, כאן לא בודקים מכסת מספר אפליקציות (זו לא אפליקציה נוספת, רק גרסה חדשה לאותה אחת).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const admin = createAdminSupabase();
  const { data: app } = await admin.from("apps").select("*").eq("id", params.id).single();
  if (!app) return NextResponse.json({ error: "האפליקציה לא נמצאה" }, { status: 404 });
  if (app.developer_id !== user.id) {
    return NextResponse.json({ error: "אין הרשאה לאפליקציה זו" }, { status: 403 });
  }
  // אפליקציה שמקורה בהצעה ציבורית שאושרה לא ניתנת לעדכון גרסה ע"י מי שהציע אותה.
  if (app.source === "public_suggestion") {
    return NextResponse.json({ error: "אפליקציה שפורסמה מהצעה ציבורית אינה ניתנת לעריכה/עדכון גרסה." }, { status: 403 });
  }

  const { fileName, fileSize, contentType } = await request.json().catch(() => ({}));
  if (!fileName || !fileSize || !contentType) {
    return NextResponse.json({ error: "חסרים פרטי קובץ" }, { status: 400 });
  }

  const plan = profile.is_pro ? LIMITS.pro : LIMITS.free;
  // תקרה אפקטיבית - כוללת הרשאת גודל חד-פעמית שאדמין נתן וקרדיט חריגת 150MB מהפניות.
  const effectiveMaxMb = effectiveMaxUploadMb(profile, plan.maxFileMb);
  const maxBytes = effectiveMaxMb * 1024 * 1024;
  if (fileSize > maxBytes) {
    return NextResponse.json({ error: `גודל הקובץ חורג מהמותר (מקסימום ${effectiveMaxMb}MB)` }, { status: 400 });
  }

  const fileKey = `apps/${user.id}/${crypto.randomUUID()}-${sanitize(fileName)}`;
  const uploadUrl = await createUploadUrl(BUCKETS.apps, fileKey, contentType);

  return NextResponse.json({ uploadUrl, fileKey });
}
