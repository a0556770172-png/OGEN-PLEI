import { NextResponse } from "next/server";
import { adminGuard, parsePublicIp } from "@/lib/securityApi";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SEVERITIES = new Set(["low", "medium", "high", "critical"]);

// זרם אירועים חי. ?after=<id> מחזיר רק חדשים יותר (הלוח שואל כל כמה שניות), ?ip=... מסנן לתוקף אחד,
// ?before=<id> לדפדוף אחורה, ?severity=high,critical לסינון.
export async function GET(request: Request) {
  const g = await adminGuard();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const url = new URL(request.url);
  const after = Number(url.searchParams.get("after") ?? 0);
  const before = Number(url.searchParams.get("before") ?? 0);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 60) || 60));
  const ipRaw = url.searchParams.get("ip");
  const sev = (url.searchParams.get("severity") ?? "").split(",").filter((s) => SEVERITIES.has(s));

  let q = createAdminSupabase()
    .from("security_events")
    .select("id,ts,ip,type,severity,path,method,status,ua,details,count,blocked")
    .order("id", { ascending: false })
    .limit(limit);
  if (Number.isFinite(after) && after > 0) q = q.gt("id", after);
  if (Number.isFinite(before) && before > 0) q = q.lt("id", before);
  if (ipRaw) {
    // כתובת פנימית אי אפשר לחפש כאן, אבל סינון לפי IP תקין בלבד מונע הזרקה/שאילתה חריגה
    const ip = parsePublicIp(ipRaw);
    if (!ip) return NextResponse.json({ events: [] });
    q = q.eq("ip", ip);
  }
  if (sev.length) q = q.in("severity", sev);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "שגיאה בטעינת האירועים" }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}
