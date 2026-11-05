import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { memo } from "@/lib/memo";

export const dynamic = "force-dynamic";

// פוסט הפרסום (description_html) של אפליקציה מאושרת - נטען רק כשהחלונית של האפליקציה נפתחת,
// במקום להיות מוטבע ברשימת הכרטיסים של עמוד הבית. התיאור כבר עבר ניקוי בעת השמירה.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const detail = await memo(`app-desc:${params.id}`, 60_000, async () => {
    const admin = createAdminSupabase();
    const { data } = await admin
      .from("apps")
      .select("description_html, screenshot_keys, video_key")
      .eq("id", params.id)
      .eq("status", "approved")
      .maybeSingle();
    if (!data) return null;
    return {
      html: (data.description_html as string) ?? "",
      screenshotKeys: (data.screenshot_keys as string[] | null) ?? [],
      videoKey: (data.video_key as string | null) ?? null
    };
  });
  if (detail === null) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  return NextResponse.json(detail, { headers: { "Cache-Control": "public, max-age=60" } });
}
