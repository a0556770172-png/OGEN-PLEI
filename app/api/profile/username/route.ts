import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// בחירת שם משתמש למי שנרשם עם Google. בהרשמה רגילה המשתמש כותב שם משתמש בטופס, אבל ב-Google
// ה-trigger בבסיס הנתונים נותן אוטומטית את החלק שלפני ה-@ במייל. לכן מיד אחרי ההרשמה
// app/auth/callback/route.ts מפנה לעמוד /welcome/username, שמשתמש ב-API הזה.
// שם משתמש לא ניתן לשינוי בשאר האתר - לכן מאפשרים את הבחירה רק פעם אחת, וסמוך להרשמה.
const CHOICE_WINDOW_MS = 24 * 60 * 60 * 1000;
const USERNAME_RE = /^[\p{L}\p{N} _.\-]{3,30}$/u;

function canChoose(user: any) {
  const isGoogle = (user.app_metadata?.providers ?? [user.app_metadata?.provider]).includes("google");
  const isNew = Date.now() - new Date(user.created_at).getTime() < CHOICE_WINDOW_MS;
  return isGoogle && isNew && !user.user_metadata?.username_chosen;
}

async function markChosen(user: any) {
  const admin = createAdminSupabase();
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, username_chosen: true }
  });
}

export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ username: result.profile.username, canChoose: canChoose(result.user) });
}

export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  if (!canChoose(user)) {
    return NextResponse.json({ error: "לא ניתן לשנות את שם המשתמש" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username.trim().replace(/\s+/g, " ") : "";

  if (username !== profile.username) {
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        { error: "שם המשתמש חייב להכיל 3-30 תווים: אותיות, מספרים, רווח, נקודה, מקף או קו תחתון" },
        { status: 400 }
      );
    }

    const admin = createAdminSupabase();
    // בדיקת כפילות בלי תלות באותיות גדולות/קטנות (ilike עם בריחה של תווים מיוחדים)
    const escaped = username.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: taken } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", escaped)
      .neq("id", user.id)
      .limit(1)
      .maybeSingle();
    if (taken) return NextResponse.json({ error: "שם המשתמש הזה כבר תפוס, נסה שם אחר" }, { status: 409 });

    const { error } = await admin.from("profiles").update({ username }).eq("id", user.id);
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "שם המשתמש הזה כבר תפוס, נסה שם אחר" }, { status: 409 });
      }
      return NextResponse.json({ error: "שגיאה בשמירת שם המשתמש" }, { status: 500 });
    }
  }

  await markChosen(user);
  return NextResponse.json({ ok: true, username });
}
