import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// מסמן שיחה/פנייה מסויימת כ"נקראה עד עכשיו" עבור המשתמש המחובר - נקרא בכל פעם שהוא פותח
// אותה, כדי שספירת ההודעות שלא נקראו תהיה מדוייקת לכל שיחה בנפרד.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const admin = createAdminSupabase();

  // רק מי שבאמת יכול לראות את השיחה הזו (הבעלים שלה, או צוות ששוייכה אליו/לא שוייכה עדיין)
  // מורשה לסמן אותה כנקראה - אחרת כל משתמש היה יכול "לזהם" את מונה ההודעות שלא נקראו
  // של שיחה שאינה שלו רק על ידי ניחוש מזהה.
  const { data: ticket } = await admin.from("tickets").select("user_id, assigned_staff_id").eq("id", params.id).single();
  if (!ticket) return NextResponse.json({ error: "הפנייה לא נמצאה" }, { status: 404 });
  const staff = isStaff(profile);
  const isOwner = ticket.user_id === user.id;
  if (!staff && !isOwner) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  if (staff && profile.role !== "admin" && ticket.assigned_staff_id && ticket.assigned_staff_id !== user.id) {
    return NextResponse.json({ error: "שיחה זו משוייכת לחבר צוות אחר" }, { status: 403 });
  }

  const { error } = await admin
    .from("ticket_reads")
    .upsert({ user_id: user.id, ticket_id: params.id, last_read_at: new Date().toISOString() }, { onConflict: "user_id,ticket_id" });
  if (error) return NextResponse.json({ error: "עדכון הקריאה נכשל" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
