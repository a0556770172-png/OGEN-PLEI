import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createUploadUrl, BUCKETS } from "@/lib/r2";
import { LIMITS } from "@/lib/constants";

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
}

export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  if (profile.role !== "developer" && profile.role !== "admin") {
    return NextResponse.json({ error: "רק חשבון מפתח יכול להעלות אפליקציות" }, { status: 403 });
  }

  const body = await request.json();
  const { fileName, fileSize, contentType, iconFileName, iconContentType } = body as {
    fileName: string; fileSize: number; contentType: string; iconFileName?: string; iconContentType?: string;
  };

  if (!fileName || !fileSize || !contentType) {
    return NextResponse.json({ error: "חסרים פרטי קובץ" }, { status: 400 });
  }

  const plan = profile.is_pro ? LIMITS.pro : LIMITS.free;
  // הרשאת גודל חד-פעמית שמנהל נתן למשתמש הזה (ראו app/api/admin/users/[id]/route.ts) -
  // חייבים לבדוק אותה כבר כאן, לפני שנוצר קישור ההעלאה, אחרת קובץ חריג ייחסם עוד לפני
  // שמגיע ל-finalize.
  const sizeOverrideMb = profile.size_override_mb ?? null;
  const effectiveMaxMb = sizeOverrideMb && sizeOverrideMb > plan.maxFileMb ? sizeOverrideMb : plan.maxFileMb;
  const maxBytes = effectiveMaxMb * 1024 * 1024;
  if (fileSize > maxBytes) {
    return NextResponse.json({ error: `גודל הקובץ חורג מהמותר (מקסימום ${effectiveMaxMb}MB)` }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { count } = await admin
    .from("apps")
    .select("id", { count: "exact", head: true })
    .eq("developer_id", user.id)
    .neq("status", "archived");

  if ((count ?? 0) >= plan.maxApps) {
    return NextResponse.json({ error: `הגעת למכסת האפליקציות המקסימלית (${plan.maxApps})` }, { status: 400 });
  }

  const uuid = crypto.randomUUID();
  const fileKey = `apps/${user.id}/${uuid}-${sanitize(fileName)}`;
  const uploadUrl = await createUploadUrl(BUCKETS.apps, fileKey, contentType);

  let iconKey: string | undefined;
  let iconUploadUrl: string | undefined;
  if (iconFileName && iconContentType) {
    iconKey = `icons/${user.id}/${uuid}-${sanitize(iconFileName)}`;
    iconUploadUrl = await createUploadUrl(BUCKETS.assets, iconKey, iconContentType);
  }

  return NextResponse.json({ uploadUrl, fileKey, iconUploadUrl, iconKey });
}
