import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// בקשות הסלמה לאיפוס סיסמה - לצוות (מנהל/פיקוח).
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isStaff(result.profile)) return NextResponse.json({ error: "רק צוות" }, { status: 403 });

  const admin = createAdminSupabase();
  let rows: any[] = [];
  try {
    const { data } = await admin
      .from("password_reset_requests")
      .select("id, email, claimed_username, details, ip, status, handled_at, created_at")
      .eq("kind", "escalation")
      .order("created_at", { ascending: false })
      .limit(200);
    rows = data ?? [];
  } catch {
    // מיגרציה 0051 עוד לא רצה
  }

  // התאמה לחשבונות קיימים לפי המייל / שם המשתמש שנמסרו
  for (const r of rows) {
    const or: string[] = [];
    if (r.email && r.email !== "(לא סופק)") or.push(`email.ilike.${r.email}`);
    if (r.claimed_username) or.push(`username.ilike.${r.claimed_username}`);
    if (or.length) {
      const { data: match } = await admin
        .from("profiles")
        .select("id, username, email, created_at, role")
        .or(or.join(","))
        .limit(3);
      r.matches = match ?? [];
    } else {
      r.matches = [];
    }
  }

  return NextResponse.json({ requests: rows });
}
