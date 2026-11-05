import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { memo } from "@/lib/memo";

export const dynamic = "force-dynamic";

// חיפוש טקסט מלא באפליקציות המאושרות (שם, תיאור קצר וכל פוסט הפרסום). רשימת הכרטיסים בעמוד הבית
// כבר לא נושאת את הטקסט המלא של כל פוסט (זה היה רוב משקל הדף), ולכן ההתאמה לפי תוכן הפוסט נעשית כאן.
// מחזיר רק מזהים. התשובה משותפת בין גולשים למשך כמה שניות.
export async function GET(request: Request) {
  const raw = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 60);
  // תווים שמשמשים את תחביר הסינון של PostgREST / התאמות ilike - מסירים כדי שלא ישבשו את השאילתה
  const q = raw.replace(/[%_\\,()*"']/g, " ").replace(/\s+/g, " ").trim();
  if (q.length < 2) return NextResponse.json({ ids: [] });

  const ids = await memo(`apps-search:${q}`, 30_000, async () => {
    const admin = createAdminSupabase();
    const { data } = await admin
      .from("apps")
      .select("id")
      .eq("status", "approved")
      .or(`name.ilike.%${q}%,short_description.ilike.%${q}%,description_html.ilike.%${q}%`)
      .limit(500);
    return (data ?? []).map((r: any) => r.id as string);
  });
  return NextResponse.json({ ids });
}
