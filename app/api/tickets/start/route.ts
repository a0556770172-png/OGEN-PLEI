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

  const { targetUserId, subject, message, attachmentKey, attachmentName, attachmentType } = await request.json().catch(() => ({}));
  if (!targetUserId || !subject?.trim() || (!message?.trim() && !attachmentKey)) {
    return NextResponse.json({ error: "חובה לבחור משתמש, נושא ותוכן הודעה" }, { status: 400 });
  }
  if (attachmentKey && profile.role !== "admin" && !profile.can_send_attachments) {
    return NextResponse.json({ error: "אין לך הרשאה לשלוח קבצים מצורפים" }, { status: 403 });
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
    body: message?.trim() || "",
    attachment_key: attachmentKey ?? null,
    attachment_name: attachmentName ?? null,
    attachment_type: attachmentType ?? null
  });

  // התראת דחיפה למשתמש/מפתח שהצוות פתח אליו שיחה - כדי שהוא ידע מיד וילחץ ישר אל השיחה
  // (ראו components/NotificationBell.tsx לתג ההתראה בתוך האתר עצמו).
  sendPushToUser(targetUserId, {
    title: `הודעה חדשה מהצוות: ${subject.trim()}`,
    body: (message?.trim() || "[קובץ מצורף]").slice(0, 120),
    url: "/support"
  }).catch(() => {});

  return NextResponse.json({ ticket });
}
