import { cookies } from "next/headers";
import { createServerSupabase } from "./supabase/server";

// auth.getUser() הוא קריאת רשת לשרת האימות של Supabase, והיא רצה בכל בקשת API ובכל רינדור עמוד
// של משתמש מחובר (פעמים רבות בכל ניווט). כאן התוצאה נשמרת בזיכרון ל-30 שניות לפי עוגיית
// ההתחברות עצמה: אותו אסימון שכבר אומת בחצי הדקה האחרונה לא נשלח שוב. אסימון אחר/פג תוקף/ללא
// עוגייה - נבדק מחדש מול Supabase כרגיל. אין כאן הרחבת הרשאות: זה רק מונע בדיקה חוזרת של אותו אסימון.
const AUTH_COOKIE = "sb-ogenplay-auth-token";
const TTL_MS = 30_000;
const MAX_ENTRIES = 3000;

type CachedUser = NonNullable<Awaited<ReturnType<ReturnType<typeof createServerSupabase>["auth"]["getUser"]>>["data"]["user"]>;
const store = new Map<string, { user: CachedUser; exp: number }>();

export async function getCachedUser(): Promise<CachedUser | null> {
  const key = cookies()
    .getAll()
    .filter((c) => c.name.startsWith(AUTH_COOKIE))
    .map((c) => `${c.name}=${c.value}`)
    .join(";");
  if (!key) return null;

  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) return hit.user;

  const supabase = createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    store.delete(key);
    return null;
  }
  if (store.size >= MAX_ENTRIES) store.clear();
  store.set(key, { user, exp: Date.now() + TTL_MS });
  return user;
}
