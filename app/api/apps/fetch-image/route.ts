import { NextResponse } from "next/server";
import { lookup } from "dns/promises";
import net from "net";
import { requireProfile } from "@/lib/auth-helpers";

export const runtime = "nodejs";

// הבאת תמונה מקישור (להדבקת קישור לאייקון/צילום מסך בטופס ההעלאה). הדפדפן לא יכול להביא
// תמונה מאתר אחר בגלל CORS, ולכן השרת מביא אותה ומחזיר אותה לטופס.
// הגנות: רק http/https, חסימת כתובות פנימיות/פרטיות (SSRF) גם אחרי הפניות, רק תמונות, עד 5MB.
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === "::1" || l === "::") return true;
    if (l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80")) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(l);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return true;
}

async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("רק קישורי http/https נתמכים");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) throw new Error("כתובת לא מורשית");
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("כתובת לא מורשית");
  return url;
}

export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;
  if (profile.role !== "developer" && profile.role !== "admin") {
    return NextResponse.json({ error: "רק חשבון מפתח יכול להעלות אפליקציות" }, { status: 403 });
  }

  const { url: rawUrl } = await request.json().catch(() => ({ url: "" }));
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return NextResponse.json({ error: "חסר קישור" }, { status: 400 });
  }

  try {
    let current = await assertPublicUrl(rawUrl.trim());
    let res: Response | null = null;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      res = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(8000), headers: { "User-Agent": "OgenPlay-ImageFetch/1.0" } });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = await assertPublicUrl(new URL(res.headers.get("location")!, current).toString());
        continue;
      }
      break;
    }
    if (!res || !res.ok) return NextResponse.json({ error: "לא הצלחנו להוריד את התמונה מהקישור" }, { status: 400 });

    const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!type.startsWith("image/") || type.includes("svg")) {
      return NextResponse.json({ error: "הקישור אינו מצביע על תמונה (PNG/JPG/WEBP)" }, { status: 400 });
    }
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) return NextResponse.json({ error: "התמונה גדולה מדי (מעל 5MB)" }, { status: 400 });

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return NextResponse.json({ error: "התמונה גדולה מדי (מעל 5MB)" }, { status: 400 });

    return new NextResponse(buf, { status: 200, headers: { "Content-Type": type, "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message === "כתובת לא מורשית" || err?.message?.startsWith("רק קישורי") ? err.message : "הקישור אינו תקין או שהתמונה לא זמינה" }, { status: 400 });
  }
}
