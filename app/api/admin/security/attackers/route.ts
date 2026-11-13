import { NextResponse } from "next/server";
import { adminGuard, isoAgo } from "@/lib/securityApi";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// רשימת תוקפים עם פרופיל. ?sort=score|last_seen , ?hours=24 , ?blocked=1 (רק חסומים כרגע)
export async function GET(request: Request) {
  const g = await adminGuard();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const url = new URL(request.url);
  const hours = Math.min(24 * 30, Math.max(1, Number(url.searchParams.get("hours") ?? 24) || 24));
  const sort = url.searchParams.get("sort") === "last_seen" ? "last_seen" : "score";
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));

  let q = createAdminSupabase()
    .from("security_attackers")
    .select("*")
    .gte("last_seen", isoAgo(hours * 3600e3))
    .order(sort, { ascending: false })
    .limit(limit);
  if (url.searchParams.get("blocked") === "1") q = q.gt("blocked_until", new Date().toISOString());

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "שגיאה בטעינת התוקפים" }, { status: 500 });
  const now = Date.now();
  return NextResponse.json({
    attackers: (data ?? []).map((a: any) => ({
      ip: a.ip, firstSeen: a.first_seen, lastSeen: a.last_seen, hits: a.hits, score: Math.round(Number(a.score)), types: a.attack_types,
      typeCounts: a.type_counts, profile: a.profile, blockCount: a.block_count,
      blockedUntil: a.blocked_until && new Date(a.blocked_until).getTime() > now ? a.blocked_until : null
    }))
  });
}
