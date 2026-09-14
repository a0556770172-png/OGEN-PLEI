import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// פרטי בעל שיחת בוט (לצורך כפתור חסימה בפאנל הניהול) - צוות בלבד.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isStaff(result.profile)) return NextResponse.json({ error: "רק צוות" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data: conv } = await admin.from("bot_conversations").select("user_id").eq("id", params.id).maybeSingle();
  if (!conv) return NextResponse.json({ error: "השיחה לא נמצאה" }, { status: 404 });

  const { data: owner } = await admin
    .from("profiles")
    .select("id, username, role, bot_banned, bot_ban_reason")
    .eq("id", conv.user_id)
    .maybeSingle();
  if (!owner) return NextResponse.json({ error: "המשתמש לא נמצא" }, { status: 404 });

  return NextResponse.json({
    userId: owner.id,
    username: owner.username,
    isAdmin: owner.role === "admin",
    botBanned: !!owner.bot_banned,
    botBanReason: owner.bot_ban_reason ?? null
  });
}
