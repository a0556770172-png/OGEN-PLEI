import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isStaff } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

// התחברות וחידוש טוקן עבור תוסף הכרום של הצוות (chrome-extension/). התוסף מדבר רק עם
// כתובת האתר עצמה, ולא ישירות עם Supabase - כך הוא לא צריך לדעת את כתובת/מפתח ה-Supabase
// (שהשתנו במעבר מהענן לשרת העצמאי ושברו את התוסף), וגם עובר דרך הדומיין הראשי שמאושר
// במסנני תוכן. הטוקן שחוזר משמש מול /api/staff/notifications-summary.
// body: { grant: "password", email, password } או { grant: "refresh", refreshToken }
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let session: { access_token: string; refresh_token: string } | null = null;
  let userId: string | null = null;

  if (body.grant === "password") {
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) return json({ error: "יש להזין אימייל וסיסמה" }, 400);
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session) return json({ error: "פרטי התחברות שגויים" }, 401);
    session = data.session;
    userId = data.user.id;
  } else if (body.grant === "refresh") {
    const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken : "";
    if (!refreshToken) return json({ error: "חסר טוקן רענון" }, 400);
    const { data, error } = await anon.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user) return json({ error: "יש להתחבר מחדש" }, 401);
    session = data.session;
    userId = data.user.id;
  } else {
    return json({ error: "בקשה לא תקינה" }, 400);
  }

  // התוסף מיועד לצוות בלבד - לחשבון רגיל לא מחזירים טוקן בכלל.
  const admin = createAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("role, is_moderator, banned").eq("id", userId).single();
  if (!profile || profile.banned || !isStaff(profile)) {
    return json({ error: "רק צוות פיקוח או ניהול יכולים להתחבר לתוסף" }, 403);
  }

  return json({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    role: profile.role,
    isModerator: !!profile.is_moderator
  });
}
