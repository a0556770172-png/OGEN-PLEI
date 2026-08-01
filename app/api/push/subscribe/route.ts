import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// שומר מנוי Push חדש (endpoint + מפתחות הצפנה) עבור המשתמש המחובר, כדי שאפשר יהיה לשלוח
// לו התראות דפדפן אמיתיות גם כשהוא לא נמצא באתר.
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "מנוי לא תקין" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("push_subscriptions")
    .upsert({ user_id: user.id, endpoint, p256dh, auth }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: "שמירת המנוי נכשלה" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
