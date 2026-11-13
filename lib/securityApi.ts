import { isIP } from "net";
import { requireProfile } from "@/lib/auth-helpers";

// כלי עזר משותפים ל-API של מרכז האבטחה (app/api/admin/security/*). רק מנהל בפועל (role = admin).
export async function adminGuard(): Promise<{ username: string } | { error: string; status: number }> {
  const result = await requireProfile();
  if ("error" in result) return { error: result.error, status: result.status };
  if (result.profile.role !== "admin") return { error: "רק מנהל בפועל", status: 403 };
  return { username: (result.profile as any).username ?? "admin" };
}

// כתובת ציבורית תקינה (IPv4/IPv6) - לעולם לא מאפשרים לחסום כתובת פנימית/מקומית (למנוע נעילה עצמית).
export function parsePublicIp(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const ip = raw.trim();
  const v = isIP(ip);
  if (!v) return null;
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return null;
    return ip;
  }
  const l = ip.toLowerCase();
  if (l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80")) return null;
  return l;
}

export function isoAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

// רמת איום כללית מתוך האירועים של 10 הדקות האחרונות.
export function threatLevel(c: { critical: number; high: number; medium: number; blocks: number }): "calm" | "elevated" | "high" | "critical" {
  if (c.critical > 0 || c.blocks >= 5) return "critical";
  if (c.high >= 5 || c.blocks >= 1) return "high";
  if (c.high > 0 || c.medium >= 10) return "elevated";
  return "calm";
}
