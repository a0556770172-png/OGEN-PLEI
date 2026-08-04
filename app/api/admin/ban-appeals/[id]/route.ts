import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// תגובת צוות לערעור חסימה - כתיבת תשובה, וסימון "נפתר" (resolved, בד"כ אחרי ביטול החסימה
// בפועל דרך טאב "משתמשים") או "נדחה" (rejected, החסימה נשארת בתוקף). המשתמש עצמו עדיין
// יכול לכתוב עוד הודעה אחרי זה אם הוא עדיין חסום (ראו app/api/appeal/route.ts).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;
  if (!isStaff(profile)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { adminReply, status } = await request.json().catch(() => ({}));
  if (status !== "resolved" && status !== "rejected" && status !== "pending") {
    return NextResponse.json({ error: "סטטוס לא חוקי" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: appeal } = await admin.from("ban_appeals").select("*").eq("id", params.id).single();
  if (!appeal) return NextResponse.json({ error: "הערעור לא נמצא" }, { status: 404 });

  const updates: Record<string, any> = { status, updated_at: new Date().toISOString() };
  if (typeof adminReply === "string" && adminReply.trim()) {
    updates.admin_reply = adminReply.trim();
    updates.replied_by = user.id;
    updates.replied_at = new Date().toISOString();
  }

  const { error } = await admin.from("ban_appeals").update(updates).eq("id", appeal.id);
  if (error) return NextResponse.json({ error: "שגיאה בשמירת התגובה" }, { status: 500 });

  await logAudit({
    actorId: user.id,
    action: "reply_ban_appeal",
    targetType: "user",
    targetId: appeal.user_id,
    meta: { status, hasReply: !!(updates.admin_reply) },
    undoable: false
  });

  revalidatePath("/banned");
  return NextResponse.json({ ok: true });
}
