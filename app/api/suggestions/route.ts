import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

// כל משתמש מחובר (רגיל או מפתח) יכול להציע אפליקציה פופולרית להוספה למאגר
export async function POST(request: Request) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { user } = result;

  const { appName, note, fileKey, fileName, fileSize } = await request.json().catch(() => ({}));
  if (!appName?.trim()) {
    return NextResponse.json({ error: "חובה למלא את שם האפליקציה/התוכנה" }, { status: 400 });
  }
  if (!fileKey || !fileName || !fileSize) {
    return NextResponse.json({ error: "חובה להעלות את קובץ ההתקנה של האפליקציה/התוכנה" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { error } = await admin.from("app_suggestions").insert({
    suggested_by: user.id,
    app_name: appName.trim(),
    note: note?.trim() || null,
    file_key: fileKey,
    file_name: fileName,
    file_size_bytes: fileSize
  });

  if (error) {
    return NextResponse.json({ error: `שגיאה בשליחת ההצעה: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
