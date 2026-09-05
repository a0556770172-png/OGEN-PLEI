import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// חסימה / ביטול חסימה של משתמש מכתיבה בפורום - צוות (מנהל/פיקוח) בלבד.
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;
  if (!isStaff(profile)) return NextResponse.json({ error: "רק צוות" }, { status: 403 });

  const { userId, banned, reason } = await request.json().catch(() => ({}));
  if (typeof userId !== "string" || !userId || typeof banned !== "boolean") {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }
  if (userId === user.id) return NextResponse.json({ error: "אי אפשר לחסום את עצמך" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: target } = await admin.from("profiles").select("id, username, role").eq("id", userId).maybeSingle();
  if (!target) return NextResponse.json({ error: "המשתמש לא נמצא" }, { status: 404 });
  if (target.role === "admin") return NextResponse.json({ error: "אי אפשר לחסום מנהל" }, { status: 400 });

  const { error } = await admin
    .from("profiles")
    .update({ forum_banned: banned, forum_ban_reason: banned ? (reason || "").toString().slice(0, 300) || null : null })
    .eq("id", userId);
  if (error) return NextResponse.json({ error: `שגיאה: ${error.message}` }, { status: 500 });

  await logAudit({
    actorId: user.id,
    action: banned ? "forum_ban_user" : "forum_unban_user",
    targetType: "user",
    targetId: userId,
    targetLabel: target.username
  });

  return NextResponse.json({ ok: true, banned });
}
