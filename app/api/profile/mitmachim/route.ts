import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { parseMitmachimUrl } from "@/lib/mitmachim";

// עדכון/הסרת הקישור לפרופיל של המשתמש בפורום "מתמחים טופ".
export async function PATCH(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const { url } = await request.json().catch(() => ({}));
  const raw = typeof url === "string" ? url.trim() : "";

  let value: string | null = null;
  if (raw) {
    const parsed = parseMitmachimUrl(raw);
    if (!parsed.valid) {
      return NextResponse.json(
        { error: "הקישור חייב להיות כתובת של פרופיל ב-mitmachim.top (למשל https://mitmachim.top/user/שם-המשתמש)" },
        { status: 400 }
      );
    }
    value = parsed.url;
  }

  const admin = createAdminSupabase();
  const { error } = await admin.from("profiles").update({ mitmachim_url: value }).eq("id", user.id);
  if (error) return NextResponse.json({ error: `שגיאה בעדכון: ${error.message}` }, { status: 500 });

  return NextResponse.json({ ok: true, url: value });
}
