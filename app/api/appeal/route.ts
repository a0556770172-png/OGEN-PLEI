import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

// נתיב מיוחד: בניגוד לכל שאר ה-API באתר (שמשתמשים ב-requireProfile, שחוסם משתמשים חסומים
// לגמרי), כאן אנחנו בכוונה *לא* חוסמים משתמש חסום - זו בדיוק הפעולה שמותרת לו: לכתוב
// ערעור על החסימה שלו, גם כשהוא חסום. ראו גם app/banned/page.tsx.

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return NextResponse.json({ error: "פרופיל לא נמצא" }, { status: 404 });

  const { data: appeal } = await admin
    .from("ban_appeals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ profile, appeal: appeal ?? null });
}

export async function POST(request: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return NextResponse.json({ error: "פרופיל לא נמצא" }, { status: 404 });
  if (!profile.banned) return NextResponse.json({ error: "החשבון שלך אינו חסום" }, { status: 400 });

  const { message } = await request.json();
  const trimmed = typeof message === "string" ? message.trim() : "";
  if (trimmed.length < 5) return NextResponse.json({ error: "יש לכתוב הודעה (לפחות 5 תווים)" }, { status: 400 });
  if (trimmed.length > 3000) return NextResponse.json({ error: "ההודעה ארוכה מדי (עד 3000 תווים)" }, { status: 400 });

  const { data: existing } = await admin
    .from("ban_appeals")
    .select("id, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // כל עוד המשתמש עדיין חסום, מאפשרים לו להמשיך לכתוב - גם אם הצוות כבר הגיב לערעור
  // הקודם שלו (למשל דחה אותו) והוא רוצה להוסיף עוד טיעון. כל הודעה חדשה "פותחת מחדש"
  // את הערעור (status חוזר ל-pending) כדי שהצוות יראה שיש עליו תגובה חדשה שממתינה לו.
  if (existing) {
    const { error } = await admin
      .from("ban_appeals")
      .update({ message: trimmed, status: "pending", updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: "שגיאה בשליחת הערעור" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await admin.from("ban_appeals").insert({ user_id: user.id, message: trimmed, status: "pending" });
  if (error) return NextResponse.json({ error: "שגיאה בשליחת הערעור" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
