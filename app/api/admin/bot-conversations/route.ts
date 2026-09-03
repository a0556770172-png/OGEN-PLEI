import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// כל שיחות הבוט - לצוות (מנהל/פיקוח), לצורך מעקב ושיפור הבוט. הכי חדש קודם.
export async function GET(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isStaff(result.profile)) return NextResponse.json({ error: "רק צוות" }, { status: 403 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();

  const admin = createAdminSupabase();
  const { data } = await admin
    .from("bot_conversations")
    .select("id, title, created_at, updated_at, user:profiles!bot_conversations_user_id_fkey(username)")
    .order("updated_at", { ascending: false })
    .limit(300);

  let rows = (data ?? []) as any[];
  if (q) {
    rows = rows.filter(
      (r) => (r.title ?? "").toLowerCase().includes(q) || (r.user?.username ?? "").toLowerCase().includes(q)
    );
  }

  return NextResponse.json({ conversations: rows });
}
