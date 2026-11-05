import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { memo } from "@/lib/memo";

export const dynamic = "force-dynamic";

// מחזיר את מזהי כל המשתמשים שנחשבים "מחוברים כרגע" (ביקור אחרון ב-5 הדקות האחרונות).
// למה זה צריך endpoint נפרד: רשימת המשתמשים ב-/users נטענת פעם אחת בצד השרת (SSR) בזמן
// הניווט לעמוד - וה"heartbeat" שמעדכן last_seen_at רץ בצד הלקוח *אחרי* שהעמוד כבר נשלף,
// כך שהתמונה שרואים לא תמיד תואמת את מי שבאמת מחובר ברגע זה, ולא מתעדכנת בלי רענון ידני.
// UsersDirectoryList קורא לזה בפולינג קליינטי (כל כמה שניות) כדי שהתג "מחובר" והמונה
// יתעדכנו בלייב, בלי תלות בתמונת המצב הישנה מה-SSR.
export async function GET() {
  // התשובה זהה לכל הגולשים - שאילתה אחת לכל 10 שניות במקום אחת לכל גולש בכל פולינג
  const onlineIds = await memo("online-ids", 10_000, async () => {
    const admin = createAdminSupabase();
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data, error } = await admin.from("profiles").select("id").gte("last_seen_at", fiveMinAgo);
    if (error) return [] as string[];
    return (data ?? []).map((p) => p.id as string);
  });
  return NextResponse.json({ onlineIds });
}
