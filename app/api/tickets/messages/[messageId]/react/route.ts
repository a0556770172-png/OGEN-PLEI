import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// הוספה/הסרה (toggle) של תגובת אימוג'י להודעה - מותר למי שיכול לראות את השיחה: בעל הפנייה,
// או חבר צוות ששוייכה אליו השיחה (או שהיא עדיין לא שוייכה), או המנהל שרואה הכל.
export async function POST(request: Request, { params }: { params: { messageId: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const { emoji } = await request.json().catch(() => ({}));
  if (!emoji || typeof emoji !== "string") {
    return NextResponse.json({ error: "חסר אימוג'י" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: message } = await admin.from("ticket_messages").select("*, ticket:tickets(*)").eq("id", params.messageId).single();
  if (!message) return NextResponse.json({ error: "ההודעה לא נמצאה" }, { status: 404 });

  const ticket = (message as any).ticket;
  const staff = isStaff(profile);
  const isOwner = ticket?.user_id === user.id;
  if (!staff && !isOwner) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  if (staff && profile.role !== "admin" && ticket?.assigned_staff_id && ticket.assigned_staff_id !== user.id) {
    return NextResponse.json({ error: "שיחה זו משוייכת לחבר צוות אחר" }, { status: 403 });
  }

  const reactions: Record<string, string[]> = { ...(message.reactions ?? {}) };
  const current = new Set(reactions[emoji] ?? []);
  if (current.has(user.id)) current.delete(user.id);
  else current.add(user.id);
  if (current.size > 0) reactions[emoji] = [...current];
  else delete reactions[emoji];

  const { error } = await admin.from("ticket_messages").update({ reactions }).eq("id", params.messageId);
  if (error) return NextResponse.json({ error: "שגיאה בעדכון התגובה" }, { status: 500 });

  return NextResponse.json({ reactions });
}
