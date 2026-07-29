import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// יצירת פנייה חדשה למנהל. כל משתמש מחובר (רגיל/מפתח) יכול לפתוח פנייה.
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;

  const { subject, message } = await request.json().catch(() => ({}));
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "חובה למלא נושא ותוכן לפנייה" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: ticket, error } = await admin
    .from("tickets")
    .insert({ user_id: user.id, subject: subject.trim() })
    .select()
    .single();

  if (error || !ticket) {
    return NextResponse.json(
      { error: error?.message ? `שגיאה ביצירת הפנייה: ${error.message}` : "שגיאה ביצירת הפנייה" },
      { status: 500 }
    );
  }

  await admin.from("ticket_messages").insert({
    ticket_id: ticket.id,
    sender_id: user.id,
    sender_role: isStaff(profile) ? "staff" : "user",
    body: message.trim()
  });

  return NextResponse.json({ ticket });
}
