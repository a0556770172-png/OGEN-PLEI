import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// סגירה/פתיחה מחדש של דיון ועדה - כל חבר צוות יכול (זה ערוץ משותף, לא פרטי כמו הודעות רגילות).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;

  if (!isStaff(profile)) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { status } = await request.json().catch(() => ({}));
  if (status !== "open" && status !== "closed") {
    return NextResponse.json({ error: "סטטוס לא חוקי" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: thread } = await admin.from("council_threads").select("id").eq("id", params.id).single();
  if (!thread) return NextResponse.json({ error: "הוועדה לא נמצאה" }, { status: 404 });

  await admin.from("council_threads").update({ status, updated_at: new Date().toISOString() }).eq("id", params.id);

  return NextResponse.json({ ok: true });
}
