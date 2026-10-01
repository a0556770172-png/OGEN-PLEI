import { NextResponse } from "next/server";
import { requireProfile, isStaff } from "@/lib/auth-helpers";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// תור "גרסאות חדשות ממתינות" לצוות (מנהל/פיקוח) - ראו components/VersionProposalsQueue.tsx.
export async function GET() {
  const result = await requireProfile();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!isStaff(result.profile)) {
    return NextResponse.json({ error: "רק צוות ניהול/פיקוח יכול לצפות בזה" }, { status: 403 });
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("app_version_proposals")
    .select(
      "*, uploader:profiles!app_version_proposals_uploader_id_fkey(username), app:apps!app_version_proposals_app_id_fkey(id, name, version, file_name, file_size_bytes, developer_id, source, developer:profiles!apps_developer_id_fkey(username))"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ proposals: data ?? [] });
}
