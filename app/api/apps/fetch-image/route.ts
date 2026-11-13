import { NextResponse } from "next/server";
import { lookup } from "dns/promises";
import net from "net";
import { requireProfile } from "@/lib/auth-helpers";
import { isImagesBanned, IMAGES_BANNED_MESSAGE } from "@/lib/imageBan";
import { isPrivateIp, safeGet, UnsafeAddressError } from "@/lib/safeHttp";

export const runtime = "nodejs";

// הבאת תמונה מקישור (להדבקת קישור לאייקון/צילום מסך בטופס ההעלאה). הדפדפן לא יכול להביא
// תמונה מאתר אחר בגלל CORS, ולכן השרת מביא אותה ומחזיר אותה לטופס.
// הגנות: רק http/https, חסימת כתובות פנימיות/פרטיות (SSRF) גם אחרי הפעלה מחדש של DNS (בדיקה ברגע החיבור,
// ראו lib/safeHttp.ts) וגם אחרי הפניות, רק תמונות, עד 5MB.
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;

// בדיקה מוקדמת (הודעת שגיאה מהירה + כתובות IP גולמיות שלא עוברות lookup). ההגנה האמיתית נגד DNS rebinding
// היא בתוך safeGet, ברגע החיבור.
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
  if (isImagesBanned(profile)) return NextResponse.json({ error: IMAGES_BANNED_MESSAGE }, { status: 403 });
  if (profile.role !== "developer" && profile.role !== "admin") {
    return NextResponse.json({ error: "רק חשבון מפתח יכול להעלות אפליקציות" }, { status: 403 });
  }

  const { url: rawUrl } = await request.json().catch(() => ({ url: "" }));
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return NextResponse.json({ error: "חסר קישור" }, { status: 400 });
  }

  try {
    let current = await assertPublicUrl(rawUrl.trim());
    let res: Awaited<ReturnType<typeof safeGet>> | null = null;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      res = await safeGet(current, { timeoutMs: 8000, maxBytes: MAX_BYTES, headers: { "User-Agent": "OgenPlay-ImageFetch/1.0" } });
      const location = res.headers.location;
      if (res.status >= 300 && res.status < 400 && location) {
        current = await assertPublicUrl(new URL(location, current).toString());
        continue;
      }
      break;
    }
    if (!res || res.status < 200 || res.status >= 300) return NextResponse.json({ error: "לא הצלחנו להוריד את התמונה מהקישור" }, { status: 400 });

    const type = String(res.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    if (!type.startsWith("image/") || type.includes("svg")) {
      return NextResponse.json({ error: "הקישור אינו מצביע על תמונה (PNG/JPG/WEBP)" }, { status: 400 });
    }
    if (res.body.length > MAX_BYTES) return NextResponse.json({ error: "התמונה גדולה מדי (מעל 5MB)" }, { status: 400 });

    return new NextResponse(new Uint8Array(res.body), { status: 200, headers: { "Content-Type": type, "Cache-Control": "no-store" } });
  } catch (err: any) {
    if (err?.code === "TOO_LARGE") return NextResponse.json({ error: "התמונה גדולה מדי (מעל 5MB)" }, { status: 400 });
    const unsafe = err instanceof UnsafeAddressError || err?.cause instanceof UnsafeAddressError || err?.message === "כתובת לא מורשית";
    return NextResponse.json({ error: unsafe || err?.message?.startsWith("רק קישורי") ? "כתובת לא מורשית" : "הקישור אינו תקין או שהתמונה לא זמינה" }, { status: 400 });
  }
}
