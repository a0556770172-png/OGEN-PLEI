import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = ["/dashboard"];

// כתובת ה-Vercel הישנה (מלפני המעבר לאורקל+דומיין עצמאי) - עדיין יש קישורי הורדה ישנים
// ששותפו על ידי מפתחים ומצביעים לכאן. מפנים כל בקשה משם, בכל נתיב (כולל /apps/[id] לאפליקציה
// ספציפית), לאותו נתיב בדיוק בדומיין החדש - כדי שקישורים ישנים ימשיכו לעבוד לצמיתות.
const OLD_VERCEL_HOSTNAME = "ogen-plei-qype.vercel.app";
const NEW_SITE_ORIGIN = "https://ogenplay.com";

// עמודים שמשתמש חסום עדיין חייב להיות מסוגל להגיע אליהם - במיוחד /banned עצמו (אחרת הוא
// לעולם לא יראה את הסיבה/משך החסימה או יוכל לכתוב ערעור), וגם /login כדי שיוכל להתחבר בכלל.
const BANNED_ALLOWED_PREFIXES = ["/banned", "/login", "/signup", "/auth"];

// חייב להיות זהה לשם הקבוע ב-lib/supabase/client.ts - ראו ההסבר שם.
const AUTH_COOKIE = "sb-ogenplay-auth-token";

// ה-middleware רץ על כל ניווט בעמוד. קודם הוא פנה בכל פעם גם לשרת האימות וגם לטבלת הפרופילים.
// עכשיו: תוצאת הבדיקה של משתמש מחובר נשמרת בזיכרון לכמה שניות (לפי עוגיית ההתחברות), אורחים
// לא עוברים בדיקה בכלל, ובקשות prefetch של קישורים (שנשלחות בעשרות לכל עמוד) מדלגות עליו.
// משתמש שנחסם מועבר ל-/banned תוך שניות בודדות (BanWatcher בודק גם הוא ברקע).
type Verdict = { banned: boolean; exp: number };
const verdicts = new Map<string, Verdict>();
const OK_TTL_MS = 45_000;
const BANNED_TTL_MS = 10_000;
const MAX_VERDICTS = 5000;

export async function middleware(request: NextRequest) {
  if (request.nextUrl.hostname === OLD_VERCEL_HOSTNAME) {
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, NEW_SITE_ORIGIN);
    return NextResponse.redirect(target, 308);
  }

  // טעינה מקדימה של קישור (Link prefetch) - לא ניווט אמיתי; הבדיקה המלאה תרוץ בניווט עצמו.
  const headers = request.headers;
  if (headers.get("next-router-prefetch") || headers.get("purpose") === "prefetch") {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isBannedAllowedPath = BANNED_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const authCookies = request.cookies.getAll().filter((c) => c.name.startsWith(AUTH_COOKIE));

  // אורח - אין עוגיית התחברות, אין מה לבדוק מול Supabase
  if (authCookies.length === 0) {
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request: { headers: request.headers } });
  }

  // משתמש מחובר שכבר נבדק לאחרונה - משתמשים בתוצאה השמורה
  const cacheKey = authCookies.map((c) => `${c.name}=${c.value}`).join(";");
  const hit = verdicts.get(cacheKey);
  if (hit && hit.exp > Date.now()) {
    if (hit.banned && !isBannedAllowedPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/banned";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request: { headers: request.headers } });
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    (process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!,
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
      },
      cookieOptions: { name: AUTH_COOKIE }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // חסימת גישה לכל האתר (לא רק /dashboard) למשתמש חסום, מלבד עמודי /banned, /login וכו' -
  // כדי שהוא תמיד ינחת על /banned ויראה שם את הסיבה/משך החסימה ויוכל לכתוב ערעור, בלי
  // קשר לאיזה עמוד הוא ניסה לפתוח. ה-API עצמו כבר חסום ברמת lib/auth-helpers.ts בנפרד.
  if (user && !isBannedAllowedPath) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("banned, ban_expires_at")
      .eq("id", user.id)
      .single();

    // אם משך החסימה כבר פג - לא חוסמים כאן את הניווט; הביטול בפועל של החסימה קורה
    // אוטומטית ב-lib/auth-helpers.ts בפעם הראשונה שהמשתמש מבצע פעולה אמיתית באתר.
    const stillBanned =
      !!profile?.banned && (!profile.ban_expires_at || new Date(profile.ban_expires_at).getTime() > Date.now());

    if (verdicts.size >= MAX_VERDICTS) verdicts.clear();
    verdicts.set(cacheKey, { banned: stillBanned, exp: Date.now() + (stillBanned ? BANNED_TTL_MS : OK_TTL_MS) });

    if (stillBanned) {
      const url = request.nextUrl.clone();
      url.pathname = "/banned";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"]
};
