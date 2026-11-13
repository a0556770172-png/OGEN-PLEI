import { NextResponse } from "next/server";
import { adminGuard, isoAgo, threatLevel } from "@/lib/securityApi";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// תמונת מצב של מרכז האבטחה: מדדי תנועה, רמת איום, פילוח התקפות, תוקפים מובילים והגדרות.
// הנתונים נכתבים ע"י שירות ה-sentinel בשרת (deploy/sentinel) - כאן רק קוראים, בשאילתות קלות עם אינדקסים.
export async function GET() {
  const g = await adminGuard();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const db = createAdminSupabase();
  const now = Date.now();
  const [settings, metrics, events24, activeBlocks, attackers24, top] = await Promise.all([
    db.from("security_settings").select("*").eq("id", 1).maybeSingle(),
    db.from("security_metrics").select("*").gte("minute", isoAgo(65 * 60e3)).order("minute", { ascending: true }),
    db.from("security_events").select("type,severity,ts,blocked").gte("ts", isoAgo(24 * 3600e3)).order("ts", { ascending: false }).limit(6000),
    db.from("security_attackers").select("ip", { count: "exact", head: true }).gt("blocked_until", new Date(now).toISOString()),
    db.from("security_attackers").select("ip", { count: "exact", head: true }).gte("last_seen", isoAgo(24 * 3600e3)),
    db.from("security_attackers").select("*").gte("last_seen", isoAgo(24 * 3600e3)).order("score", { ascending: false }).limit(15)
  ]);

  // הטבלאות עוד לא קיימות (המיגרציה 0083 לא רצה) - הלוח יציג הוראות התקנה
  if (settings.error && /relation .* does not exist|schema cache|security_/i.test(settings.error.message || "")) {
    return NextResponse.json({ setup: false });
  }

  const ev = events24.data ?? [];
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  const hourly: Record<number, { low: number; medium: number; high: number; critical: number }> = {};
  const c10 = { critical: 0, high: 0, medium: 0, blocks: 0 };
  for (const e of ev) {
    byType[e.type] = (byType[e.type] ?? 0) + 1;
    bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;
    const t = new Date(e.ts).getTime();
    const hourIdx = Math.floor((now - t) / 3600e3);
    (hourly[hourIdx] ??= { low: 0, medium: 0, high: 0, critical: 0 })[e.severity as "low"]++;
    if (now - t < 10 * 60e3) {
      if (e.type === "blocked") c10.blocks++;
      else if (e.severity === "critical") c10.critical++;
      else if (e.severity === "high") c10.high++;
      else if (e.severity === "medium") c10.medium++;
    }
  }

  const series = (metrics.data ?? []).map((m: any) => ({
    minute: m.minute, req: m.req, s4xx: m.s4xx, s5xx: m.s5xx, r429: m.r429, waf: m.waf_blocked, blocked: m.blocked_hits,
    ips: m.unique_ips, authFail: m.auth_failures, p95: Number(m.p95_rt_ms), avg: Number(m.avg_rt_ms)
  }));
  const last5 = series.slice(-5);
  const sum = (k: "req" | "s5xx" | "r429" | "waf" | "blocked" | "authFail") => last5.reduce((s, m) => s + (m[k] as number), 0);
  const p95s = last5.map((m) => m.p95).filter((x) => x > 0);

  return NextResponse.json({
    setup: true,
    settings: settings.data ?? { mode: "observe", block_score: 100, whitelist: [] },
    threat: threatLevel(c10),
    last10min: c10,
    kpis: {
      rpsNow: last5.length ? Math.round((last5[last5.length - 1].req / 60) * 10) / 10 : 0,
      req5m: sum("req"), s5xx5m: sum("s5xx"), r4295m: sum("r429"), waf5m: sum("waf"), blockedHits5m: sum("blocked"), authFail5m: sum("authFail"),
      p95ms: p95s.length ? Math.round(p95s.reduce((a, b) => a + b, 0) / p95s.length) : 0,
      activeBlocks: activeBlocks.count ?? 0,
      attackers24h: attackers24.count ?? 0,
      events24h: ev.length,
      high24h: bySeverity.high + bySeverity.critical
    },
    series,
    byType,
    bySeverity,
    hourly: Array.from({ length: 24 }, (_, i) => ({ hoursAgo: 23 - i, ...(hourly[23 - i] ?? { low: 0, medium: 0, high: 0, critical: 0 }) })),
    topAttackers: (top.data ?? []).map((a: any) => ({
      ip: a.ip, firstSeen: a.first_seen, lastSeen: a.last_seen, hits: a.hits, score: Math.round(Number(a.score)), types: a.attack_types, typeCounts: a.type_counts,
      profile: a.profile, blockedUntil: a.blocked_until && new Date(a.blocked_until).getTime() > now ? a.blocked_until : null, blockCount: a.block_count
    })),
    serverTime: new Date(now).toISOString()
  });
}
