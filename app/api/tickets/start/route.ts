import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";

// פתיחת שיחה/פנייה ביוזמת הצוות (מנהל או פיקוח) למשתמש ספציפי - לא רק כשהמשתמש פונה ראשון.
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  if (!isStaff(profile)) {
    return NextResponse.json({ error: "רק צוות יכול לפתוח שיחה יזומה" }, { status: 403 });
  }

  // ההודעה הפותחת היא טקסט בלבד - קובץ מצורף שולחים בהודעה הבאה, אחרי שהפנייה כבר קיימת
  // (כך attachment-init/reply יכולים לוודא שהקובץ הועלה לפנייה הזו בדיוק).
  const { targetUserId, subject, message } = await request.json().catch(() => ({}));
  if (!targetUserId || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "חובה לבחור משתמש, נושא ותוכן הודעה" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: targetProfile } = await admin.from("profiles").select("id").eq("id", targetUserId).single();
  if (!targetProfile) return NextResponse.json({ error: "המשתמש לא נמצא" }, { status: 404 });

  // השיחה משוייכת מיד למי שיזם אותה - חברי צוות אחרים (חוץ מהמנהל) לא יראו אותה.
  const { data: ticket, error } = await admin
    .from("tickets")
    .insert({ user_id: targetUserId, subject: subject.trim(), started_by_staff: true, assigned_staff_id: user.id })
    .select()
    .single();
  if (error || !ticket) {
    return NextResponse.json({ error: "שגיאה בפתיחת השיחה" }, { status: 500 });
  }

  await admin.from("ticket_messages").insert({
    ticket_id: ticket.id,
    sender_id: user.id,
    sender_role: "staff",
    body: message.trim()
  });

  // התראת דחיפה למשתמש/מפתח שהצוות פתח אליו שיחה - כדי שהוא ידע מיד וילחץ ישר אל השיחה
  // (ראו components/NotificationBell.tsx לתג ההתראה בתוך האתר עצמו).
  sendPushToUser(targetUserId, {
    title: `הודעה חדשה מהצוות: ${subject.trim()}`,
    body: message.trim().slice(0, 120),
    url: "/support"
  }).catch(() => {});

  return NextResponse.json({ ticket });
}
