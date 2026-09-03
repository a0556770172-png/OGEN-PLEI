import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

const TYPES = ["developer", "category", "new_public", "all_new"] as const;

function normalize(type: string, targetId: unknown): { type: string; target: string } | null {
  if (!TYPES.includes(type as any)) return null;
  if (type === "developer" || type === "category") {
    const t = typeof targetId === "string" ? targetId.trim() : "";
    if (!t) return null;
    return { type, target: t.slice(0, 100) };
  }
  return { type, target: "" };
}

// הרשמה למנוי התראות.
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const { type, targetId } = await request.json().catch(() => ({}));
  const n = normalize(type, targetId);
  if (!n) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("notification_subscriptions")
    .upsert({ user_id: user.id, type: n.type, target_id: n.target }, { onConflict: "user_id,type,target_id" });
  if (error) return NextResponse.json({ error: `שגיאה: ${error.message}` }, { status: 500 });

  return NextResponse.json({ ok: true, subscribed: true });
}

// ביטול מנוי.
export async function DELETE(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const { type, targetId } = await request.json().catch(() => ({}));
  const n = normalize(type, targetId);
  if (!n) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });

  const admin = createAdminSupabase();
  await admin
    .from("notification_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("type", n.type)
    .eq("target_id", n.target);

  return NextResponse.json({ ok: true, subscribed: false });
}
