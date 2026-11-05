import { NextRequest, NextResponse } from "next/server";
import { BUCKETS, createDownloadUrl } from "@/lib/r2";

// מגיש תמונות/אייקונים ציבוריים מדלי ה-assets ב-R2 דרך אותו origin (ogenplay.com) במקום
// תת-דומיין נפרד (cdn.ogenplay.com) שעלול להיות חסום ע"י מסנני תוכן (כמו NetFree) גם כשהדומיין
// הראשי כבר אושר - ראו lib/r2.ts publicAssetUrl(). יוצר URL חתום קצר-טווח לכל בקשה
// ומעביר את התוכן הלאה - התוכן עצמו ממילא ציבורי, הקישור החתום הוא רק מנגנון הגישה ל-R2.
export const dynamic = "force-dynamic";

// מטמון זיכרון לקבצים קטנים (אייקונים, אווטארים, צילומי מסך קטנים): אותו אייקון מוצג שוב ושוב
// לכל גולש, ובלי מטמון כל בקשה הלכה עד R2 והחזירה את הקובץ מחדש. המפתחות לא משתנים (מפתח חדש
// לכל העלאה), אז אין בעיית רעננות. סרטונים ובקשות טווח לא נשמרים כאן.
const CACHE_MAX_BYTES = 64 * 1024 * 1024;
const CACHE_MAX_ITEM = 600 * 1024;
const CACHE_TTL_MS = 10 * 60 * 1000;
type Entry = { buf: Buffer; type: string | null; etag: string | null; exp: number };
const cache = new Map<string, Entry>();
let cacheBytes = 0;

function remember(key: string, entry: Entry) {
  const old = cache.get(key);
  if (old) {
    cacheBytes -= old.buf.length;
    cache.delete(key);
  }
  cache.set(key, entry);
  cacheBytes += entry.buf.length;
  // פינוי הישנים ביותר (סדר ההכנסה במפה) עד שחוזרים מתחת לתקרה
  for (const [k, e] of cache) {
    if (cacheBytes <= CACHE_MAX_BYTES) break;
    cache.delete(k);
    cacheBytes -= e.buf.length;
  }
}

function cachedResponse(entry: Entry, ifNoneMatch: string | null) {
  const headers: Record<string, string> = {
    "cache-control": "public, max-age=31536000, immutable",
    "accept-ranges": "bytes"
  };
  if (entry.etag) headers.etag = entry.etag;
  if (entry.etag && ifNoneMatch && ifNoneMatch === entry.etag) return new NextResponse(null, { status: 304, headers });
  if (entry.type) headers["content-type"] = entry.type;
  headers["content-length"] = String(entry.buf.length);
  return new NextResponse(new Uint8Array(entry.buf), { status: 200, headers });
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const key = params.path.join("/");
  const range = req.headers.get("range");
  const ifNoneMatch = req.headers.get("if-none-match");

  if (!range) {
    const hit = cache.get(key);
    if (hit && hit.exp > Date.now()) return cachedResponse(hit, ifNoneMatch);
  }

  const signedUrl = await createDownloadUrl(BUCKETS.assets, key, undefined, 60);

  // סרטונים: מעבירים את בקשת הטווח (Range) ל-R2 כדי שהנגן יוכל לדלג ולהתחיל לנגן לפני שהקובץ ירד כולו
  const upstreamHeaders: Record<string, string> = {};
  if (range) upstreamHeaders.range = range;
  if (ifNoneMatch) upstreamHeaders["if-none-match"] = ifNoneMatch;
  const upstream = await fetch(signedUrl, { headers: upstreamHeaders });
  if (upstream.status === 304) {
    return new NextResponse(null, { status: 304, headers: { "cache-control": "public, max-age=31536000, immutable" } });
  }
  if (!upstream.ok) {
    return new NextResponse(null, { status: upstream.status === 404 ? 404 : 502 });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const etag = upstream.headers.get("etag");
  if (etag) headers.set("etag", etag);
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("content-length", contentLength);
  headers.set("accept-ranges", "bytes");
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("content-range", contentRange);
  // תוכן ציבורי קבוע (אייקונים/אווטארים) - בטוח לשמור ב-cache הן בדפדפן והן בקצה של Cloudflare.
  headers.set("cache-control", "public, max-age=31536000, immutable");

  // קובץ קטן ללא טווח - שומרים בזיכרון להבאות הבאות
  const size = Number(contentLength ?? 0);
  const isVideo = (contentType ?? "").startsWith("video/");
  if (upstream.status === 200 && !range && !isVideo && size > 0 && size <= CACHE_MAX_ITEM) {
    const buf = Buffer.from(await upstream.arrayBuffer());
    remember(key, { buf, type: contentType, etag, exp: Date.now() + CACHE_TTL_MS });
    return new NextResponse(new Uint8Array(buf), { status: 200, headers });
  }

  return new NextResponse(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
}
