import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// כל שיחות הבוט - לצוות (מנהל/פיקוח), לצורך מעקב ושיפור הבוט.
// sort=interest -> לפי דירוג העניין של ה-AI (הכי מעניין קודם); אחרת לפי זמן.
export async function GET(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isStaff(result.profile)) return NextResponse.json({ error: "רק צוות" }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const sort = params.get("sort") === "interest" ? "interest" : "recent";

  const admin = createAdminSupabase();

  // עמודות flagged_at / interest_* עשויות לא להתקיים אם המיגרציות עוד לא רצו - ננסה עם, וניפול בלי.
  const fullCols =
    "id, title, created_at, updated_at, flagged_at, interest_score, interest_note, user:profiles!bot_conversations_user_id_fkey(username)";
  const plainCols = "id, title, created_at, updated_at, user:profiles!bot_conversations_user_id_fkey(username)";

  let data: any[] = [];
  const full = await admin.from("bot_conversations").select(fullCols).limit(400);
  if (full.error) {
    const plain = await admin
      .from("bot_conversations")
      .select(plainCols)
      .order("updated_at", { ascending: false })
      .limit(400);
    data = plain.data ?? [];
  } else {
    data = full.data ?? [];
  }

  let rows = data as any[];
  if (q) {
    rows = rows.filter(
      (r) => (r.title ?? "").toLowerCase().includes(q) || (r.user?.username ?? "").toLowerCase().includes(q)
    );
  }

  rows.sort((a, b) => {
    if (sort === "interest") {
      const sa = a.interest_score ?? -1;
      const sb = b.interest_score ?? -1;
      if (sa !== sb) return sb - sa;
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return NextResponse.json({ conversations: rows.slice(0, 300) });
}
