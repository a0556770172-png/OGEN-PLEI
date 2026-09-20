import { NextRequest, NextResponse } from "next/server";
import { BUCKETS, createDownloadUrl } from "@/lib/r2";

// מגיש תמונות/אייקונים ציבוריים מדלי ה-assets ב-R2 דרך אותו origin (ogenplay.com) במקום
// תת-דומיין נפרד (cdn.ogenplay.com) שעלול להיות חסום ע"י מסנני תוכן (כמו NetFree) גם כשהדומיין
// הראשי כבר אושר - ראו lib/r2.ts publicAssetUrl(). יוצר URL חתום קצר-טווח לכל בקשה
// ומעביר את התוכן הלאה - התוכן עצמו ממילא ציבורי, הקישור החתום הוא רק מנגנון הגישה ל-R2.
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const key = params.path.join("/");
  const signedUrl = await createDownloadUrl(BUCKETS.assets, key, undefined, 60);

  const upstream = await fetch(signedUrl);
  if (!upstream.ok) {
    return new NextResponse(null, { status: upstream.status === 404 ? 404 : 502 });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("content-length", contentLength);
  // תוכן ציבורי קבוע (אייקונים/אווטארים) - בטוח לשמור ב-cache הן בדפדפן והן בקצה של Cloudflare.
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new NextResponse(upstream.body, { status: 200, headers });
}
