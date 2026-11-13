import { NextResponse } from "next/server";
import { isIP } from "net";
import { adminGuard } from "@/lib/securityApi";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await adminGuard();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const { data } = await createAdminSupabase().from("security_settings").select("*").eq("id", 1).maybeSingle();
  return NextResponse.json({ settings: data ?? { mode: "observe", block_score: 100, whitelist: [] } });
}

// PATCH { mode?: "observe"|"enforce", blockScore?: 40..1000, whitelist?: string[] (כתובות IP או טווחי CIDR) }
export async function PATCH(request: Request) {
  const g = await adminGuard();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (body.mode !== undefined) {
    if (body.mode !== "observe" && body.mode !== "enforce") return NextResponse.json({ error: "מצב לא חוקי" }, { status: 400 });
    patch.mode = body.mode;
  }
  if (body.blockScore !== undefined) {
    const n = Math.round(Number(body.blockScore));
    if (!Number.isFinite(n) || n < 40 || n > 1000) return NextResponse.json({ error: "סף חסימה בין 40 ל-1000" }, { status: 400 });
    patch.block_score = n;
  }
  if (body.whitelist !== undefined) {
    if (!Array.isArray(body.whitelist) || body.whitelist.length > 100) return NextResponse.json({ error: "רשימה לבנה לא תקינה" }, { status: 400 });
    const clean: string[] = [];
    for (const raw of body.whitelist) {
      const s = String(raw).trim();
      const [addr, mask] = s.split("/");
      const v = isIP(addr);
      const maxMask = v === 4 ? 32 : 128;
      if (!v || (mask !== undefined && !(Number(mask) >= 0 && Number(mask) <= maxMask))) {
        return NextResponse.json({ error: `כתובת/טווח לא תקין: ${s.slice(0, 50)}` }, { status: 400 });
      }
      clean.push(s);
    }
    patch.whitelist = clean;
  }
  const { error } = await createAdminSupabase().from("security_settings").upsert({ id: 1, ...patch });
  if (error) return NextResponse.json({ error: "שגיאה בשמירה" }, { status: 500 });
  return NextResponse.json({ ok: true, appliedWithinSeconds: 6 });
}
