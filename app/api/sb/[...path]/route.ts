import { NextRequest, NextResponse } from "next/server";

// פרוקסי שקוף מהדפדפן (דרך ogenplay.com עצמו) לשרת ה-Supabase האמיתי. קיים כדי שקריאות
// Auth/REST מהלקוח לא יעברו דרך תת-דומיין נפרד (api.ogenplay.com) שעלול להיות חסום ע"י
// מסנני תוכן (כמו NetFree) גם כשהדומיין הראשי כבר אושר - ראו lib/supabase/client.ts.
// היעד עצמו (NEXT_PUBLIC_SUPABASE_URL) הוא אותו ערך שקוד השרת כבר משתמש בו כרגיל
// (lib/supabase/admin.ts, lib/supabase/server.ts, middleware.ts) - כאן זו רק קריאת שרת
// לשרת נוספת, לא חשופה לחסימת רשת בצד הלקוח.
export const dynamic = "force-dynamic";

const TARGET_BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");

// כותרות שאסור להעביר כמו שהן בין השרתים - חלקן ספציפיות לחיבור עצמו (hop-by-hop),
// וחלקן (host) יבלבלו את שרת היעד לגבי לאיזה דומיין הבקשה מיועדת.
const STRIP_HEADERS = new Set([
  "host", "connection", "content-length", "transfer-encoding", "keep-alive",
  "upgrade", "te", "trailer", "proxy-authenticate", "proxy-authorization",
  "content-encoding"
]);

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  if (!TARGET_BASE) {
    return NextResponse.json({ error: "Supabase upstream not configured" }, { status: 500 });
  }

  const targetUrl = `${TARGET_BASE}/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!STRIP_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  const hasBody = !["GET", "HEAD"].includes(req.method);

  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    redirect: "manual"
  });

  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIP_HEADERS.has(key.toLowerCase())) resHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, { status: upstream.status, headers: resHeaders });
}

type RouteParams = { params: { path: string[] } };

export async function GET(req: NextRequest, { params }: RouteParams) {
  return proxy(req, params.path);
}
export async function POST(req: NextRequest, { params }: RouteParams) {
  return proxy(req, params.path);
}
export async function PUT(req: NextRequest, { params }: RouteParams) {
  return proxy(req, params.path);
}
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  return proxy(req, params.path);
}
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  return proxy(req, params.path);
}
export async function OPTIONS(req: NextRequest, { params }: RouteParams) {
  return proxy(req, params.path);
}
export async function HEAD(req: NextRequest, { params }: RouteParams) {
  return proxy(req, params.path);
}
