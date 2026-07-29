import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// משמש למשתמש שכבר רשום ומאומת (למשל נרשם קודם כ"משתמש רגיל") ורוצה גם להפוך למפתח.
// חשוב: לא קוראים כאן ל-supabase.auth.signUp() שוב, כי כשמדובר במייל שכבר קיים ומאומת,
// Supabase (מטעמי אבטחה נגד חשיפת מיילים קיימים - anti-enumeration) פשוט מחזיר "הצלחה" בלי
// לשלוח מייל ובלי לשנות כלום - וזה בדיוק מה שגרם לבאג "כאילו הצליח אבל שום דבר לא קרה".
// לכן כאן פשוט משדרגים את הפרופיל הקיים ישירות במסד הנתונים.
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  // שים לב: היות פיקוח (is_moderator) לא חוסם הפיכה למפתח - אפשר להיות גם פיקוח וגם מפתח יחד.
  if (profile.role === "developer" || profile.role === "admin") {
    return NextResponse.json({ alreadyDeveloper: true });
  }

  const { fullName, phone } = await request.json().catch(() => ({ fullName: "", phone: "" }));

  const admin = createAdminSupabase();

  // מעדכנים גם את המטא-דאטה של המשתמש (auth.users) כדי לשמור שם וטלפון, בדומה להרשמת מפתח רגילה
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata || {}),
      full_name: fullName || user.user_metadata?.full_name,
      phone: phone || user.user_metadata?.phone
    }
  });

  const { error } = await admin
    .from("profiles")
    .update({ role: "developer", accepted_terms_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "שדרוג החשבון נכשל, נסה שוב" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
