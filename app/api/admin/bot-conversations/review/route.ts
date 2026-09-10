import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// סימון שיחות בוט כ"נקראו ע"י הצוות" (או ביטול). { ids: [...] } או { all: true }.
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isStaff(result.profile)) return NextResponse.json({ error: "רק צוות" }, { status: 403 });

  const { ids, all, reviewed } = await request.json().catch(() => ({}));
  const value = reviewed === false ? null : new Date().toISOString();

  const admin = createAdminSupabase();
  let query = admin.from("bot_conversations").update({ staff_reviewed_at: value });
  if (all === true) {
    if (value === null) query = query.not("staff_reviewed_at", "is", null);
    else query = query.is("staff_reviewed_at", null);
  } else if (Array.isArray(ids) && ids.length > 0) {
    query = query.in("id", ids.slice(0, 500));
  } else {
    return NextResponse.json({ error: "לא צוינו שיחות" }, { status: 400 });
  }

  const { error } = await query;
  if (error) return NextResponse.json({ error: `שגיאה: ${error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true });
}
