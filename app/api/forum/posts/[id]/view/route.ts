import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

// מונה צפיות לסרטון בפוסט בפורום. פתוח גם לאורחים. כדי שלא יספרו צפיות מזויפות בלולאה:
// אותה כתובת IP נספרת פעם אחת לפוסט בכל 6 שעות (בזיכרון של המופע; הדפדפן מגביל גם הוא ב-localStorage).
const WINDOW_MS = 6 * 60 * 60 * 1000;
const seen = new Map<string, number>();

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NextResponse.json({ error: "מזהה לא תקין" }, { status: 400 });

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const key = `${ip}|${params.id}`;
  const now = Date.now();
  if (seen.size > 5000) {
    for (const [k, t] of seen) if (now - t > WINDOW_MS) seen.delete(k);
  }

  const admin = createAdminSupabase();
  const last = seen.get(key);
  if (last && now - last < WINDOW_MS) {
    const { data } = await admin.from("forum_posts").select("video_views").eq("id", params.id).maybeSingle();
    return NextResponse.json({ views: Number(data?.video_views ?? 0), counted: false });
  }
  seen.set(key, now);

  const { data, error } = await admin.rpc("increment_forum_video_views", { p_post: params.id });
  if (error) return NextResponse.json({ error: "לא ניתן לעדכן" }, { status: 500 });
  return NextResponse.json({ views: Number(data ?? 0), counted: true });
}
