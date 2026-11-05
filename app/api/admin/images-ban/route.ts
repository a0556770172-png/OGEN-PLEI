import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// חסימת משתמש מהעלאת תמונות (אייקון, צילומי מסך, תמונת פרופיל, תמונות בפניות) - מנהל ופיקוח.
// בפועל האכיפה נעשית בנתיבי ההעלאה עצמם (ראו lib/imageBan.ts).
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isStaff(result.profile)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data } = await admin
    .from("profiles")
    .select("id, username, images_ban_reason, images_banned_at")
    .eq("images_banned", true)
    .order("images_banned_at", { ascending: false });
  return NextResponse.json({ users: data ?? [] });
}

export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user, profile } = result;
  if (!isStaff(profile)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const { username, banned, reason } = await request.json().catch(() => ({}));
  if (typeof username !== "string" || !username.trim() || typeof banned !== "boolean") {
    return NextResponse.json({ error: "חסר שם משתמש" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const name = username.trim();
  let { data: target } = await admin.from("profiles").select("id, username, role, is_moderator").eq("username", name).maybeSingle();
  if (!target) {
    // התאמה ללא הבדל אותיות גדולות/קטנות (בלי תווי wildcard)
    const escaped = name.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data } = await admin.from("profiles").select("id, username, role, is_moderator").ilike("username", escaped).limit(1);
    target = data?.[0] ?? null;
  }
  if (!target) return NextResponse.json({ error: `לא נמצא משתמש בשם "${name}"` }, { status: 404 });

  if (banned && (target.role === "admin" || target.is_moderator)) {
    return NextResponse.json({ error: "לא ניתן לחסום חבר צוות מהעלאת תמונות" }, { status: 400 });
  }

  const cleanReason = typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 300) : null;
  const { error } = await admin
    .from("profiles")
    .update(
      banned
        ? { images_banned: true, images_ban_reason: cleanReason, images_banned_at: new Date().toISOString() }
        : { images_banned: false, images_ban_reason: null, images_banned_at: null }
    )
    .eq("id", target.id);
  if (error) return NextResponse.json({ error: `שגיאה בעדכון: ${error.message}` }, { status: 500 });

  await logAudit({
    actorId: user.id,
    action: banned ? "ban_images" : "unban_images",
    targetType: "user",
    targetId: target.id,
    targetLabel: target.username,
    meta: cleanReason ? { reason: cleanReason } : undefined,
    undoable: false
  });

  return NextResponse.json({ ok: true, username: target.username });
}
