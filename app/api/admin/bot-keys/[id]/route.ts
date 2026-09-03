import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// עדכון מפתח: הפעלה/כיבוי, שם, ניקוי קירור, מיקום. או מחיקה.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.profile.role !== "admin") return NextResponse.json({ error: "רק מנהל בפועל" }, { status: 403 });

  const { action, label, sortOrder } = await request.json().catch(() => ({}));
  const admin = createAdminSupabase();
  const patch: Record<string, any> = {};

  if (action === "enable") {
    patch.enabled = true;
    patch.cooldown_until = null;
    patch.last_error = null;
  } else if (action === "disable") {
    patch.enabled = false;
  } else if (action === "clear_cooldown") {
    patch.cooldown_until = null;
  } else if (action === "rename" && typeof label === "string") {
    patch.label = label.trim().slice(0, 60);
  } else if (action === "reorder" && Number.isFinite(sortOrder)) {
    patch.sort_order = Math.round(sortOrder);
  } else {
    return NextResponse.json({ error: "פעולה לא חוקית" }, { status: 400 });
  }

  const { error } = await admin.from("bot_api_keys").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: `שגיאה: ${error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.profile.role !== "admin") return NextResponse.json({ error: "רק מנהל בפועל" }, { status: 403 });

  const admin = createAdminSupabase();
  const { error } = await admin.from("bot_api_keys").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: `שגיאה: ${error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true });
}
