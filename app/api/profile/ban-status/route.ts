import { NextResponse } from "next/server";
import { getCachedUser } from "@/lib/auth-cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { memo } from "@/lib/memo";

export const dynamic = "force-dynamic";

// בדיקה קלה שרצה ברקע אצל כל משתמש מחובר (components/BanWatcher.tsx): האם החשבון נחסם
// עכשיו. כך משתמש שנחסם בזמן שהוא באתר מועבר מיד לעמוד /banned, בלי לחכות לניווט/רענון.
export async function GET() {
  const supabase = createServerSupabase();
  const user = await getCachedUser();
  if (!user) return NextResponse.json({ guest: true }, { headers: { "Cache-Control": "no-store" } });

  const profile = await memo(`ban-status:${user.id}`, 10_000, async () => {
    const { data } = await createAdminSupabase()
      .from("profiles")
      .select("banned, ban_expires_at")
      .eq("id", user.id)
      .maybeSingle();
    return data;
  });

  const banned =
    !!profile?.banned && (!profile.ban_expires_at || new Date(profile.ban_expires_at).getTime() > Date.now());
  return NextResponse.json({ banned }, { headers: { "Cache-Control": "no-store" } });
}
