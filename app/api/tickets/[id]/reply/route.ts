import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { sendPushToUser, notifyAdmins } from "@/lib/push";

// הוספת הודעה לפנייה קיימת - הבעלים של הפנייה, או צוות (מנהל/פיקוח)
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const { message, attachmentKey, attachmentName, attachmentType, replyToId } = await request.json().catch(() => ({}));
  if (!message?.trim() && !attachmentKey) {
    return NextResponse.json({ error: "אי אפשר לשלוח הודעה ריקה" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: ticket } = await admin.from("tickets").select("*").eq("id", params.id).single();
  if (!ticket) return NextResponse.json({ error: "הפנייה לא נמצאה" }, { status: 404 });

  const staff = isStaff(profile);
  if (!staff && ticket.user_id !== user.id) {
    return NextResponse.json({ error: "אין הרשאה לפנייה זו" }, { status: 403 });
  }
  // פרטיות בין חברי צוות: שיחה ששוייכה לחבר צוות אחר (לא מנהל) אינה נגישה לצוות פיקוח אחר.
  if (staff && profile.role !== "admin" && ticket.assigned_staff_id && ticket.assigned_staff_id !== user.id) {
    return NextResponse.json({ error: "שיחה זו משוייכת לחבר צוות אחר" }, { status: 403 });
  }

  // צירוף קבצים למשתמשים אסור לגמרי; לצוות מותר רק למנהל בפועל או למי שקיבל הרשאה מפורשת.
  if (attachmentKey) {
    if (!staff) {
      return NextResponse.json({ error: "לא ניתן לצרף קבצים" }, { status: 403 });
    }
    if (profile.role !== "admin" && !profile.can_send_attachments) {
      return NextResponse.json({ error: "אין לך הרשאה לשלוח קבצים מצורפים" }, { status: 403 });
    }
  }

  const { error } = await admin.from("ticket_messages").insert({
    ticket_id: ticket.id,
    sender_id: user.id,
    sender_role: staff ? "staff" : "user",
    body: message?.trim() || "",
    attachment_key: attachmentKey ?? null,
    attachment_name: attachmentName ?? null,
    attachment_type: attachmentType ?? null,
    reply_to_id: replyToId ?? null
  });
  if (error) {
    return NextResponse.json({ error: `שגיאה בשליחת ההודעה: ${error.message}` }, { status: 500 });
  }

  // תגובת משתמש פותחת מחדש פנייה סגורה. תגובת צוות לא סוגרת אוטומטית - יש כפתור נפרד לסגירה.
  // תגובת צוות ראשונה "משייכת" את השיחה אליו - מאותו רגע חברי צוות אחרים (חוץ מהמנהל) לא רואים אותה.
  await admin
    .from("tickets")
    .update({
      status: !staff && ticket.status === "closed" ? "open" : ticket.status,
      assigned_staff_id: staff && !ticket.assigned_staff_id ? user.id : ticket.assigned_staff_id,
      updated_at: new Date().toISOString()
    })
    .eq("id", ticket.id);

  // התראת דחיפה (Web Push) לצד השני של השיחה - כדי שהוא ידע מיד שיש הודעה חדשה, גם אם
  // הוא לא נמצא באתר כרגע, ויוכל ללחוץ ולעבור ישר לשיחה (ראו components/NotificationBell.tsx
  // ו-public/sw.js לטיפול בלחיצה על ההתראה).
  const preview = (message?.trim() || "[קובץ מצורף]").slice(0, 120);
  if (staff) {
    sendPushToUser(ticket.user_id, {
      title: `הודעה חדשה מהצוות: ${ticket.subject}`,
      body: preview,
      url: "/support"
    }).catch(() => {});
  } else {
    const notifyStaffId = ticket.assigned_staff_id as string | null;
    if (notifyStaffId) {
      sendPushToUser(notifyStaffId, {
        title: `הודעה חדשה מ-${profile.username}: ${ticket.subject}`,
        body: preview,
        url: "/dashboard/admin?tab=tickets"
      }).catch(() => {});
    } else {
      notifyAdmins({
        title: `הודעה חדשה מ-${profile.username}: ${ticket.subject}`,
        body: preview,
        url: "/dashboard/admin?tab=tickets"
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
