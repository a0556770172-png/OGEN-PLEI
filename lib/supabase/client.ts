"use client";
import { createBrowserClient } from "@supabase/ssr";

// חשוב: בכוונה *לא* משתמשים כאן ב-NEXT_PUBLIC_SUPABASE_URL (api.ogenplay.com) - תת-דומיין
// נפרד עלול להיות חסום ע"י מסנני תוכן (כמו NetFree) גם כשהדומיין הראשי מאושר, כי מסננים
// כאלה מאשרים/חוסמים per-hostname. במקום זה, כל קריאות ה-Auth/REST מהדפדפן עוברות דרך
// /api/sb/* באותו origin (ogenplay.com) - ראו app/api/sb/[...path]/route.ts שמעביר אותן
// פנימית לשרת ה-Supabase האמיתי. "http://localhost" הוא רק בסיס תקין-מבחינה-תחבירית לזמן
// ה-render בשרת (SSR) שבו אין window - לעולם לא באמת נפנה אליו, כי שום קריאת רשת לא
// מתבצעת עד שרכיב הלקוח פעיל בפועל בדפדפן.
//
// cookieOptions.name קבוע בכוונה (זהה בכל שימושי Supabase באתר - ראו גם lib/supabase/server.ts
// ו-middleware.ts): ברירת המחדל של הספרייה גוזרת את שם העוגייה מה-hostname של הכתובת
// (sb-<hostname הראשון>-auth-token). מכיוון שהלקוח כאן משתמש ב-ogenplay.com/api/sb בעוד
// שהשרת ממשיך להשתמש ב-api.ogenplay.com, שני הצדדים היו מקבלים שמות עוגייה שונים לגמרי -
// והשרת (middleware, Server Components) לעולם לא היה מוצא את החיבור שהדפדפן שמר, מה שגרם
// ללולאת הפניה חוזרת ל-login בכל כניסה לעמוד מוגן.
export function createClient() {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  return createBrowserClient(
    `${origin}/api/sb`,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookieOptions: { name: "sb-ogenplay-auth-token" } }
  );
}
