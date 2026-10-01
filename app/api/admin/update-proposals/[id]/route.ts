import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createDownloadUrl, BUCKETS } from "@/lib/r2";
import { approveVersionProposal, rejectVersionProposal } from "@/lib/versionProposals";

async function requireStaff() {
  const result = await requireProfile();
  if ("error" in result) return { response: NextResponse.json({ error: result.error }, { status: result.status }) };
  if (!isStaff(result.profile)) {
    return { response: NextResponse.json({ error: "רק צוות ניהול/פיקוח יכול לבצע פעולה זו" }, { status: 403 }) };
  }
  return { user: result.user };
}

// הורדת הקובץ המוצע לבדיקה (קישור חתום קצר-מועד)
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireStaff();
  if ("response" in auth) return auth.response;

  const { data: p } = await createAdminSupabase()
    .from("app_version_proposals")
    .select("file_key, file_name")
    .eq("id", params.id)
    .single();
  if (!p) return NextResponse.json({ error: "הגרסה לא נמצאה" }, { status: 404 });

  const url = await createDownloadUrl(BUCKETS.apps, p.file_key, p.file_name);
  return NextResponse.json({ url });
}

// אישור / דחייה של גרסה חדשה
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireStaff();
  if ("response" in auth) return auth.response;

  const { action, note } = await request.json().catch(() => ({}));
  let res: { error?: string };
  if (action === "approve") res = await approveVersionProposal(params.id, auth.user.id);
  else if (action === "reject") res = await rejectVersionProposal(params.id, auth.user.id, note ? String(note).slice(0, 1000) : null);
  else return NextResponse.json({ error: "פעולה לא חוקית" }, { status: 400 });

  if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
