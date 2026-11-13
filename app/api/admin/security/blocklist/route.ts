import { NextResponse } from "next/server";
import { adminGuard, parsePublicIp } from "@/lib/securityApi";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// משך חסימה ידנית בדקות (0 = קבועה, 10 שנים). רק ערכים מוכרים.
const DURATIONS = new Set([15, 60, 360, 1440, 10080, 0]);

export async function GET() {
  const g = await adminGuard();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const { data, error } = await createAdminSupabase()
    .from("security_blocklist")
    .select("ip,status,until,reason,source,note,updated_at")
    .or(`and(status.eq.blocked,until.gt.${new Date().toISOString()}),status.eq.allowed`)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: "שגיאה בטעינת הרשימה" }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

// POST { action: "block" | "release" | "allow", ip, minutes?, reason? }
//  block   - חסימה ידנית (ה-sentinel מחיל תוך כ-5 שניות)
//  release - שחרור חסימה (איפוס ציון הסיכון)
//  allow   - רשימה לבנה קבועה לכתובת (לא תיחסם לעולם ע"י המערכת)
export async function POST(request: Request) {
  const g = await adminGuard();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await request.json().catch(() => ({}));
  const ip = parsePublicIp(body.ip);
  if (!ip) return NextResponse.json({ error: "כתובת IP ציבורית לא תקינה (כתובות פנימיות/מקומיות אי אפשר לחסום)" }, { status: 400 });
  const action = body.action;
  const now = new Date();
  const note = `by:${g.username}`.slice(0, 80);
  const reason = (typeof body.reason === "string" ? body.reason.trim() : "").slice(0, 200) || null;
  const db = createAdminSupabase();

  let row: Record<string, any>;
  if (action === "block") {
    const minutes = Number(body.minutes ?? 60);
    if (!DURATIONS.has(minutes)) return NextResponse.json({ error: "משך חסימה לא חוקי" }, { status: 400 });
    const until = new Date(now.getTime() + (minutes === 0 ? 3650 * 86400e3 : minutes * 60e3));
    row = { ip, status: "blocked", until: until.toISOString(), reason: reason ?? "חסימה ידנית", source: "manual", note, updated_at: now.toISOString() };
  } else if (action === "release") {
    row = { ip, status: "released", until: null, reason: reason ?? "שוחרר ידנית", source: "manual", note, updated_at: now.toISOString() };
  } else if (action === "allow") {
    row = { ip, status: "allowed", until: null, reason: reason ?? "רשימה לבנה", source: "manual", note, updated_at: now.toISOString() };
  } else {
    return NextResponse.json({ error: "פעולה לא חוקית" }, { status: 400 });
  }

  const { error } = await db.from("security_blocklist").upsert(row, { onConflict: "ip" });
  if (error) return NextResponse.json({ error: "שגיאה בשמירה" }, { status: 500 });
  return NextResponse.json({ ok: true, appliedWithinSeconds: 6 });
}
