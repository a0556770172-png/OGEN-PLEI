import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// לקוח "אנונימי" אמיתי - בלי כל סשן/עוגיות, בדיוק כמו מבקר אקראי באתר שלא מחובר.
// זה קריטי לבדיקה הזו: אם היינו בודקים דרך הסשן של המנהל עצמו, מדיניות ה-RLS
// "apps_select_staff" הייתה מראה את האפליקציה בכל מקרה (גם אם היא לא מאושרת),
// כי לצוות יש הרשאת צפייה מיוחדת. רק לקוח אנונימי אמיתי בודק את מה שמשתמש רגיל רואה בפועל.
function createAnonSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

// בדיקת פרסום "בוודאות" - קריאה ישירה וטרייה למסד הנתונים (לא דרך שום שכבת cache),
// שמדמה בדיוק את מה שמשתמש אנונימי בחנות היה רואה ברגע זה ממש.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;

  if (!isStaff(profile)) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const admin = createAdminSupabase();
  const { data: app } = await admin
    .from("apps")
    .select("id, name, status, category, updated_at, reviewed_at, reviewed_by")
    .eq("id", params.id)
    .single();

  if (!app) return NextResponse.json({ error: "האפליקציה לא נמצאה" }, { status: 404 });

  const anon = createAnonSupabase();
  const { data: publicRow, error: anonError } = await anon
    .from("apps")
    .select("id")
    .eq("id", params.id)
    .maybeSingle();

  return NextResponse.json({
    id: app.id,
    name: app.name,
    status: app.status,
    updatedAt: app.updated_at,
    reviewedAt: app.reviewed_at,
    visibleToPublic: !!publicRow && !anonError
  });
}
