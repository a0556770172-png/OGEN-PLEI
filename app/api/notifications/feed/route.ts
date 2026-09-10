import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// מרכז ההתראות של המשתמש - 30 האחרונות + כמה לא נקראו.
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const admin = createAdminSupabase();
  const [{ data: items }, { count: unread }] = await Promise.all([
    admin
      .from("user_notifications")
      .select("id, kind, title, body, url, seen_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    admin.from("user_notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("seen_at", null)
  ]);

  return NextResponse.json({ items: items ?? [], unread: unread ?? 0 });
}

// סימון כל ההתראות כנקראו.
export async function POST() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const admin = createAdminSupabase();
  await admin.from("user_notifications").update({ seen_at: new Date().toISOString() }).eq("user_id", user.id).is("seen_at", null);
  return NextResponse.json({ ok: true });
}

// "סמן הכל כנפתר" - מוחק את כל ההתראות שלי מהפיד. מנהל בפועל בלבד.
export async function DELETE() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.profile.role !== "admin") return NextResponse.json({ error: "רק מנהל בפועל" }, { status: 403 });

  const admin = createAdminSupabase();
  await admin.from("user_notifications").delete().eq("user_id", result.user.id);
  return NextResponse.json({ ok: true });
}
