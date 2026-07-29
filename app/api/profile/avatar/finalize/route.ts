import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { deleteObject, BUCKETS } from "@/lib/r2";
import { getAvatarUrl } from "@/lib/avatar";

export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const { avatarKey } = await request.json().catch(() => ({}));
  if (!avatarKey) return NextResponse.json({ error: "חסר מזהה קובץ" }, { status: 400 });

  const admin = createAdminSupabase();
  const oldAvatarKey = profile.avatar_key;

  const { error } = await admin.from("profiles").update({ avatar_key: avatarKey }).eq("id", user.id);
  if (error) return NextResponse.json({ error: `שגיאה בשמירת תמונת הפרופיל: ${error.message}` }, { status: 500 });

  // מוחקים את התמונה הישנה מה-R2 (best-effort - לא קריטי אם זה נכשל)
  if (oldAvatarKey && oldAvatarKey !== avatarKey) {
    await deleteObject(BUCKETS.assets, oldAvatarKey).catch(() => {});
  }

  const url = await getAvatarUrl(avatarKey);
  return NextResponse.json({ ok: true, url });
}
