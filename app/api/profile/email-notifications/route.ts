import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// מתג אישי בפרופיל: קבלת התראות (מעקב אחרי מפתח/קטגוריה, אפליקציה ציבורית חדשה,
// תגובות ופוסטים בפורום וכו') גם במייל, בנוסף לפעמון באתר - ראו lib/emailNotifications.ts.
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ enabled: !!result.profile.email_notifications_enabled });
}

export async function PATCH(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { enabled } = await request.json().catch(() => ({}));
  if (typeof enabled !== "boolean") return NextResponse.json({ error: "ערך לא תקין" }, { status: 400 });

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("profiles")
    .update({ email_notifications_enabled: enabled })
    .eq("id", result.user.id);
  if (error) return NextResponse.json({ error: "שגיאה בעדכון ההגדרה" }, { status: 500 });

  return NextResponse.json({ ok: true, enabled });
}
