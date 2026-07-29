import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createDownloadUrl, BUCKETS } from "@/lib/r2";

// הורדת קובץ ה-APK שהמציע העלה - צוות (מנהל/פיקוח) בלבד
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { profile } = result;
  if (!isStaff(profile)) return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });

  const admin = createAdminSupabase();
  const { data: suggestion } = await admin.from("app_suggestions").select("*").eq("id", params.id).single();
  if (!suggestion?.file_key) return NextResponse.json({ error: "אין קובץ מצורף להצעה זו" }, { status: 404 });

  const url = await createDownloadUrl(BUCKETS.apps, suggestion.file_key, suggestion.file_name ?? undefined);
  return NextResponse.json({ url });
}
