import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

// שימוש פנימי בלבד ע"י תהליך ההרשמה כמפתח: בדיקה האם כבר יש חשבון עם המייל הזה,
// כדי למנוע קריאה ל-supabase.auth.signUp() עם מייל קיים ומאומת - קריאה כזו "מצליחה"
// שקט בלי לשלוח שום מייל אמיתי (הגנת אנטי-אנומרציה של Supabase), וזה בדיוק הבאג
// שדווח: משתמש שכבר נרשם כ"משתמש רגיל" מנסה להירשם גם כמפתח ולא מקבל מייל אימות.
export async function POST(request: Request) {
  const { email } = await request.json().catch(() => ({}));
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "חובה לספק כתובת מייל" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email.trim())
    .maybeSingle();

  return NextResponse.json({ exists: !!data });
}
