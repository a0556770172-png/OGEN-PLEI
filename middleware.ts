import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = ["/dashboard"];

// עמודים שמשתמש חסום עדיין חייב להיות מסוגל להגיע אליהם - במיוחד /banned עצמו (אחרת הוא
// לעולם לא יראה את הסיבה/משך החסימה או יוכל לכתוב ערעור), וגם /login כדי שיוכל להתחבר בכלל.
const BANNED_ALLOWED_PREFIXES = ["/banned", "/login", "/signup", "/auth"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: "", ...options });
        }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // חסימת גישה לכל האתר (לא רק /dashboard) למשתמש חסום, מלבד עמודי /banned, /login וכו' -
  // כדי שהוא תמיד ינחת על /banned ויראה שם את הסיבה/משך החסימה ויוכל לכתוב ערעור, בלי
  // קשר לאיזה עמוד הוא ניסה לפתוח. ה-API עצמו כבר חסום ברמת lib/auth-helpers.ts בנפרד.
  const isBannedAllowedPath = BANNED_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (user && !isBannedAllowedPath) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("banned, ban_expires_at")
      .eq("id", user.id)
      .single();

    if (profile?.banned) {
      const stillBanned = !profile.ban_expires_at || new Date(profile.ban_expires_at).getTime() > Date.now();
      if (stillBanned) {
        const url = request.nextUrl.clone();
        url.pathname = "/banned";
        return NextResponse.redirect(url);
      }
      // אם משך החסימה כבר פג - לא חוסמים כאן את הניווט; הביטול בפועל של החסימה קורה
      // אוטומטית ב-lib/auth-helpers.ts בפעם הראשונה שהמשתמש מבצע פעולה אמיתית באתר.
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"]
};
